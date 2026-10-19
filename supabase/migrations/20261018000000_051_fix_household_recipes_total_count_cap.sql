-- Migration 051: Fix get_household_recipes() total count silently capped at p_limit
--
-- get_household_recipes() (migration 025) computed COUNT(*) over the same
-- subquery that OFFSET/LIMIT had already applied, so `total` in the
-- { recipes, total } response was never the true household recipe count --
-- it was min(true_total, p_limit), silently capping at 50 for any household
-- with more than 50 household-visible recipes. Found 2026-10-18 while
-- wiring a sidebar nav-item recipe count that reads this field directly.
--
-- Fix: split into two queries -- one COUNT(*) over the unbounded WHERE
-- clause for `total`, one bounded SELECT (unchanged OFFSET/LIMIT/ORDER BY)
-- for `recipes`. No signature change, no caller changes required.

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

  -- True total, unbounded by LIMIT/OFFSET.
  SELECT COUNT(*) INTO v_count
  FROM recipes r
  WHERE r.user_id IN (
    SELECT hm2.user_id
    FROM household_members hm2
    WHERE hm2.household_id = v_household_id
  )
  AND r.visibility = 'household';

  -- Page of recipes, same shape/order as before.
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  INTO v_recipes
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
