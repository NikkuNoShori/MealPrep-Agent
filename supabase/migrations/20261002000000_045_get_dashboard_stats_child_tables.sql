-- Migration 045: Rewrite get_dashboard_stats() to JOIN child tables (MOP-0011)
-- Replaces jsonb_each / jsonb_array_elements gymnastics in the this_week,
-- grocery_progress, and most_cooked sections with JOINs on meal_plan_entries
-- and grocery_list_items (created in migration 044).
-- All other sections (recipe_counts, reactions_given, top_cuisines) unchanged.

CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_household_id UUID;

  -- Recipe counts
  v_own_count INTEGER;
  v_household_count INTEGER;
  v_public_visible_count INTEGER;
  v_collection_shared_count INTEGER;

  -- This week's meals
  v_week_plan_id UUID;
  v_today_meals JSON;

  -- Active plan count
  v_active_plan_count INTEGER;

  -- Grocery progress
  v_grocery_plan_id UUID;
  v_grocery_checked INTEGER;
  v_grocery_total INTEGER;
  v_grocery_categories JSON;

  -- Reactions given
  v_reactions_given INTEGER;

  -- Most cooked this month
  v_most_cooked JSON;

  -- Top cuisines
  v_top_cuisines JSON;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Caller's household (if any)
  SELECT hm.household_id INTO v_household_id
  FROM household_members hm
  WHERE hm.user_id = v_user_id
  LIMIT 1;

  -- ── Recipe counts ────────────────────────────────────────────────────────────
  SELECT COUNT(*) INTO v_own_count
  FROM recipes r
  WHERE r.user_id = v_user_id;

  SELECT COUNT(*) INTO v_household_count
  FROM recipes r
  WHERE r.visibility = 'household'
    AND r.user_id != v_user_id
    AND v_household_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.user_id = r.user_id
      AND hm.household_id = v_household_id
    );

  SELECT COUNT(*) INTO v_public_visible_count
  FROM recipes r
  WHERE r.visibility = 'public'
    AND r.user_id != v_user_id;

  SELECT COUNT(*) INTO v_collection_shared_count
  FROM recipes r
  WHERE r.user_id != v_user_id
    AND NOT (
      r.visibility = 'household'
      AND v_household_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM household_members hm
        WHERE hm.user_id = r.user_id
        AND hm.household_id = v_household_id
      )
    )
    AND r.visibility != 'public'
    AND EXISTS (
      SELECT 1 FROM collection_recipes cr
      JOIN recipe_collections rc ON cr.collection_id = rc.id
      WHERE cr.recipe_id = r.id
      AND (
        rc.visibility = 'public'
        OR (rc.visibility = 'household' AND v_household_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM household_members hm
          WHERE hm.user_id = rc.user_id
          AND hm.household_id = v_household_id
        ))
      )
    );

  -- ── This week's meals ────────────────────────────────────────────────────────
  -- Find the plan overlapping today; fall back to the most recently created plan.
  SELECT mp.id INTO v_week_plan_id
  FROM meal_plans mp
  WHERE mp.user_id = v_user_id
    AND mp.start_date <= CURRENT_DATE
    AND mp.end_date >= CURRENT_DATE
  ORDER BY mp.start_date DESC
  LIMIT 1;

  IF v_week_plan_id IS NULL THEN
    SELECT mp.id INTO v_week_plan_id
    FROM meal_plans mp
    WHERE mp.user_id = v_user_id
    ORDER BY mp.created_at DESC
    LIMIT 1;
  END IF;

  IF v_week_plan_id IS NOT NULL THEN
    -- Build today's meals as DayMealSlots: { slot: PlannedMealEntry[] }
    -- Aggregate each slot into an array to match the DayMealSlots frontend type.
    SELECT COALESCE(
      (SELECT json_object_agg(s.slot, s.entries)
       FROM (
         SELECT mpe.slot,
                json_agg(json_build_object(
                  'id',          mpe.id,
                  'recipeId',    mpe.recipe_id,
                  'recipeName',  mpe.recipe_name,
                  'recipeImage', mpe.recipe_image,
                  'servings',    mpe.servings
                ) ORDER BY mpe.position) AS entries
         FROM meal_plan_entries mpe
         WHERE mpe.meal_plan_id = v_week_plan_id
           AND mpe.date = CURRENT_DATE
           AND mpe.slot IS NOT NULL
         GROUP BY mpe.slot
       ) s),
      NULL
    )
    INTO v_today_meals;
  ELSE
    v_today_meals := NULL;
  END IF;

  -- ── Active plan count ────────────────────────────────────────────────────────
  SELECT COUNT(*) INTO v_active_plan_count
  FROM meal_plans mp
  WHERE mp.user_id = v_user_id
    AND mp.status = 'active';

  -- ── Grocery progress ─────────────────────────────────────────────────────────
  -- Prefer the active plan; otherwise the most-recently-created plan.
  SELECT mp.id INTO v_grocery_plan_id
  FROM meal_plans mp
  WHERE mp.user_id = v_user_id
    AND mp.status = 'active'
  ORDER BY mp.created_at DESC
  LIMIT 1;

  IF v_grocery_plan_id IS NULL THEN
    SELECT mp.id INTO v_grocery_plan_id
    FROM meal_plans mp
    WHERE mp.user_id = v_user_id
    ORDER BY mp.created_at DESC
    LIMIT 1;
  END IF;

  IF v_grocery_plan_id IS NOT NULL THEN
    SELECT
      COUNT(*) FILTER (WHERE gli.is_checked = true),
      COUNT(*)
    INTO v_grocery_checked, v_grocery_total
    FROM grocery_list_items gli
    WHERE gli.meal_plan_id = v_grocery_plan_id
      AND gli.is_removed = false;

    SELECT COALESCE(json_agg(json_build_object(
      'category', cat.category,
      'checked',  cat.checked,
      'total',    cat.total
    ) ORDER BY cat.category), '[]'::json)
    INTO v_grocery_categories
    FROM (
      SELECT
        COALESCE(gli.category, 'other') AS category,
        COUNT(*) FILTER (WHERE gli.is_checked = true) AS checked,
        COUNT(*) AS total
      FROM grocery_list_items gli
      WHERE gli.meal_plan_id = v_grocery_plan_id
        AND gli.is_removed = false
      GROUP BY COALESCE(gli.category, 'other')
    ) cat;
  ELSE
    v_grocery_checked    := 0;
    v_grocery_total      := 0;
    v_grocery_categories := '[]'::json;
  END IF;

  -- ── Reactions given ──────────────────────────────────────────────────────────
  SELECT COUNT(*) INTO v_reactions_given
  FROM recipe_reactions rr
  WHERE rr.user_id = v_user_id
     OR EXISTS (
       SELECT 1 FROM family_members fm
       WHERE fm.id = rr.family_member_id
       AND fm.managed_by = v_user_id
     );

  -- ── Most-cooked this month ───────────────────────────────────────────────────
  -- JOIN meal_plan_entries directly — no more JSONB unnest gymnastics.
  SELECT COALESCE(json_agg(json_build_object(
    'recipeId', mc.recipe_id,
    'title',    r.title,
    'count',    mc.cook_count
  ) ORDER BY mc.cook_count DESC, r.title ASC), '[]'::json)
  INTO v_most_cooked
  FROM (
    SELECT mpe.recipe_id, COUNT(*) AS cook_count
    FROM meal_plan_entries mpe
    JOIN meal_plans mp ON mp.id = mpe.meal_plan_id
    WHERE mp.user_id = v_user_id
      AND mp.start_date >= date_trunc('month', CURRENT_DATE)::DATE
      AND mpe.recipe_id IS NOT NULL
      AND mpe.date IS NOT NULL     -- calendar entries only (not plan-level lists)
    GROUP BY mpe.recipe_id
    ORDER BY cook_count DESC
    LIMIT 10
  ) mc
  JOIN recipes r ON r.id = mc.recipe_id;

  -- ── Top cuisines ─────────────────────────────────────────────────────────────
  SELECT COALESCE(json_agg(json_build_object(
    'cuisine', tc.cuisine,
    'count',   tc.cnt
  ) ORDER BY tc.cnt DESC, tc.cuisine ASC), '[]'::json)
  INTO v_top_cuisines
  FROM (
    SELECT lower(trim(r.cuisine)) AS cuisine, COUNT(*) AS cnt
    FROM recipes r
    WHERE (
      r.user_id = v_user_id
      OR (r.visibility = 'household' AND v_household_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM household_members hm
        WHERE hm.user_id = r.user_id
        AND hm.household_id = v_household_id
      ))
      OR r.visibility = 'public'
      OR EXISTS (
        SELECT 1 FROM collection_recipes cr
        JOIN recipe_collections rc ON cr.collection_id = rc.id
        WHERE cr.recipe_id = r.id
        AND (
          rc.visibility = 'public'
          OR (rc.visibility = 'household' AND v_household_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM household_members hm
            WHERE hm.user_id = rc.user_id
            AND hm.household_id = v_household_id
          ))
        )
      )
    )
    AND r.cuisine IS NOT NULL
    AND trim(r.cuisine) != ''
    GROUP BY lower(trim(r.cuisine))
    ORDER BY cnt DESC
    LIMIT 10
  ) tc;

  RETURN json_build_object(
    'recipe_counts', json_build_object(
      'own_count',                v_own_count,
      'household_count',          v_household_count,
      'public_visible_count',     v_public_visible_count,
      'collection_shared_count',  v_collection_shared_count
    ),
    'this_week', json_build_object(
      'plan_id',     v_week_plan_id,
      'today_meals', v_today_meals
    ),
    'active_plan_count', v_active_plan_count,
    'grocery_progress', json_build_object(
      'plan_id',    v_grocery_plan_id,
      'checked',    v_grocery_checked,
      'total',      v_grocery_total,
      'categories', v_grocery_categories
    ),
    'reactions_given',        v_reactions_given,
    'most_cooked_this_month', v_most_cooked,
    'top_cuisines',           v_top_cuisines
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO authenticated;
