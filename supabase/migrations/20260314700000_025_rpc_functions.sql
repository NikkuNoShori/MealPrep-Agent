-- ============================================================================
-- Migration 025: RPC Functions for Multi-Query API Methods
--
-- Converts 5 frontend API methods from multiple round trips into single
-- database function calls. All functions use SECURITY DEFINER to bypass
-- RLS for cross-user profile reads, and validate auth.uid() internally.
-- ============================================================================

-- ============================================================================
-- 1. get_my_household()
--    Replaces: getMyHousehold() — 4 queries → 1
--    Returns: { household, my_role, members, dependents, pending_invites }
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

  -- Household info
  SELECT json_build_object(
    'id', h.id,
    'name', h.name,
    'created_by', h.created_by,
    'created_at', h.created_at,
    'updated_at', h.updated_at
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

GRANT EXECUTE ON FUNCTION get_my_household() TO authenticated;

-- ============================================================================
-- 2. toggle_recipe_reaction(p_recipe_id, p_reaction, p_family_member_id)
--    Replaces: toggleRecipeReaction() — 2-3 queries → 1
--    Atomic check-then-write eliminates race conditions.
--    Returns: { action: 'added' | 'removed' | 'updated' }
-- ============================================================================

CREATE OR REPLACE FUNCTION toggle_recipe_reaction(
  p_recipe_id UUID,
  p_reaction VARCHAR(20),
  p_family_member_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_existing RECORD;
  v_is_dependent BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  v_is_dependent := p_family_member_id IS NOT NULL;

  -- Check existing reaction
  IF v_is_dependent THEN
    SELECT id, reaction INTO v_existing
    FROM recipe_reactions
    WHERE recipe_id = p_recipe_id
      AND family_member_id = p_family_member_id;
  ELSE
    SELECT id, reaction INTO v_existing
    FROM recipe_reactions
    WHERE recipe_id = p_recipe_id
      AND user_id = v_user_id;
  END IF;

  IF v_existing.id IS NOT NULL THEN
    IF v_existing.reaction = p_reaction THEN
      -- Same reaction = toggle off
      DELETE FROM recipe_reactions WHERE id = v_existing.id;
      RETURN json_build_object('action', 'removed');
    ELSE
      -- Different reaction = update
      UPDATE recipe_reactions
      SET reaction = p_reaction, updated_at = NOW()
      WHERE id = v_existing.id;
      RETURN json_build_object('action', 'updated');
    END IF;
  ELSE
    -- Insert new reaction
    IF v_is_dependent THEN
      INSERT INTO recipe_reactions (recipe_id, family_member_id, reaction)
      VALUES (p_recipe_id, p_family_member_id, p_reaction);
    ELSE
      INSERT INTO recipe_reactions (recipe_id, user_id, reaction)
      VALUES (p_recipe_id, v_user_id, p_reaction);
    END IF;
    RETURN json_build_object('action', 'added');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION toggle_recipe_reaction(UUID, VARCHAR, UUID) TO authenticated;

-- ============================================================================
-- 3. get_household_recipes(p_limit, p_offset)
--    Replaces: getHouseholdRecipes() — 3 queries → 1
--    Returns: { recipes: [...with embedded profiles], total: number }
-- ============================================================================

CREATE OR REPLACE FUNCTION get_household_recipes(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_household_id UUID;
  v_recipes JSON;
  v_count INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  SELECT hm.household_id INTO v_household_id
  FROM household_members hm
  WHERE hm.user_id = v_user_id
  LIMIT 1;

  IF v_household_id IS NULL THEN
    RETURN json_build_object('recipes', '[]'::json, 'total', 0);
  END IF;

  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json), COUNT(*)
  INTO v_recipes, v_count
  FROM (
    SELECT r.*,
      json_build_object(
        'display_name', p.display_name,
        'username', p.username,
        'avatar_url', p.avatar_url
      ) AS profiles
    FROM recipes r
    JOIN profiles p ON p.id = r.user_id
    WHERE r.user_id IN (
      SELECT hm2.user_id
      FROM household_members hm2
      WHERE hm2.household_id = v_household_id
    )
    AND r.visibility = 'household'
    ORDER BY r.created_at DESC
    OFFSET p_offset
    LIMIT p_limit
  ) t;

  RETURN json_build_object('recipes', v_recipes, 'total', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION get_household_recipes(INTEGER, INTEGER) TO authenticated;

-- ============================================================================
-- 4. get_recipe_reactions(p_recipe_ids)
--    Replaces: getRecipeReactions() — 2 queries → 1
--    Merges profile name resolution into a single SQL JOIN.
--    Returns: [{ id, recipe_id, user_id, family_member_id, reaction, name }]
-- ============================================================================

CREATE OR REPLACE FUNCTION get_recipe_reactions(p_recipe_ids UUID[])
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  RETURN COALESCE((
    SELECT json_agg(json_build_object(
      'id', rr.id,
      'recipe_id', rr.recipe_id,
      'user_id', rr.user_id,
      'family_member_id', rr.family_member_id,
      'reaction', rr.reaction,
      'name', COALESCE(fm.name, p.display_name, 'Unknown')
    ))
    FROM recipe_reactions rr
    LEFT JOIN family_members fm ON fm.id = rr.family_member_id
    LEFT JOIN profiles p ON p.id = rr.user_id
    WHERE rr.recipe_id = ANY(p_recipe_ids)
  ), '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION get_recipe_reactions(UUID[]) TO authenticated;

-- ============================================================================
-- 5. get_my_pending_invites()
--    Replaces: getMyPendingInvites() — 2 queries → 1
--    Returns: [{ id, household_id, invited_email, ..., households: { id, name } }]
-- ============================================================================

CREATE OR REPLACE FUNCTION get_my_pending_invites()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  SELECT p.email INTO v_email
  FROM profiles p
  WHERE p.id = v_user_id;

  IF v_email IS NULL THEN
    RETURN '[]'::json;
  END IF;

  RETURN COALESCE((
    SELECT json_agg(json_build_object(
      'id', hi.id,
      'household_id', hi.household_id,
      'invited_email', hi.invited_email,
      'invited_by', hi.invited_by,
      'inviter_name', hi.inviter_name,
      'status', hi.status,
      'created_at', hi.created_at,
      'expires_at', hi.expires_at,
      'households', json_build_object('id', h.id, 'name', h.name)
    ))
    FROM household_invites hi
    JOIN households h ON h.id = hi.household_id
    WHERE LOWER(hi.invited_email) = LOWER(v_email)
      AND hi.status = 'pending'
  ), '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_pending_invites() TO authenticated;
