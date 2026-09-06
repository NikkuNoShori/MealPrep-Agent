-- ============================================================================
-- Migration 033: Expose RBAC permission flags from get_my_household() RPC
-- ADR-0005: The household object returned by the RPC was built with a hardcoded
-- field list that predates migration 032. Add allow_member_edits and
-- allow_member_child_edits so the frontend receives the live flag values.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_my_household()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_household_id UUID;
  v_role TEXT;
  v_household JSON;
  v_members JSON;
  v_dependents JSON;
  v_invites JSON;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Get user's membership
  SELECT hm.household_id, hm.role
  INTO v_household_id, v_role
  FROM household_members hm
  WHERE hm.user_id = v_user_id
  LIMIT 1;

  IF v_household_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Household info — includes RBAC flags added in migration 032
  SELECT json_build_object(
    'id', h.id,
    'name', h.name,
    'created_by', h.created_by,
    'created_at', h.created_at,
    'updated_at', h.updated_at,
    'allow_member_edits', h.allow_member_edits,
    'allow_member_child_edits', h.allow_member_child_edits
  ) INTO v_household
  FROM households h
  WHERE h.id = v_household_id;

  -- All members with profiles
  SELECT COALESCE(json_agg(json_build_object(
    'id', hm.id,
    'user_id', hm.user_id,
    'role', hm.role,
    'joined_at', hm.joined_at,
    'profiles', json_build_object(
      'id', p.id,
      'email', p.email,
      'display_name', p.display_name,
      'avatar_url', p.avatar_url
    )
  )), '[]'::json) INTO v_members
  FROM household_members hm
  JOIN profiles p ON p.id = hm.user_id
  WHERE hm.household_id = v_household_id;

  -- Active dependents (all columns)
  SELECT COALESCE(json_agg(row_to_json(fm)), '[]'::json) INTO v_dependents
  FROM family_members fm
  WHERE fm.household_id = v_household_id
    AND fm.is_active = true;

  -- Pending invites
  SELECT COALESCE(json_agg(json_build_object(
    'id', hi.id,
    'invited_email', hi.invited_email,
    'inviter_name', hi.inviter_name,
    'status', hi.status,
    'created_at', hi.created_at,
    'expires_at', hi.expires_at
  ) ORDER BY hi.created_at DESC), '[]'::json) INTO v_invites
  FROM household_invites hi
  WHERE hi.household_id = v_household_id
    AND hi.status = 'pending';

  RETURN json_build_object(
    'household', v_household,
    'my_role', v_role,
    'members', v_members,
    'dependents', v_dependents,
    'pending_invites', v_invites
  );
END;
$$;
