-- ============================================================================
-- Migration 042: get_dashboard_stats() RPC
--
-- MOP-0030: Dashboard Redesign — Real-Data Widgets.
-- Single SECURITY DEFINER function returning one JSON payload for the
-- dashboard, replacing the old pattern of fetching capped/paginated lists
-- client-side just to read `.length`. Follows the get_household_recipes()
-- pattern from migration 025 (true COUNT(*) totals, not page-limited fetches).
-- ============================================================================

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
  v_week_plan RECORD;
  v_today_meals JSON;

  -- Active plan count
  v_active_plan_count INTEGER;

  -- Grocery progress
  v_grocery_plan RECORD;
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

  -- Caller's household (if any) — mirrors get_my_household()'s lookup.
  SELECT hm.household_id INTO v_household_id
  FROM household_members hm
  WHERE hm.user_id = v_user_id
  LIMIT 1;

  -- ── Recipe counts ──
  -- Mirrors the OR-filter visibility rule from the LIVE "Users can view
  -- accessible recipes" RLS policy (migration 012, which superseded
  -- migration 009 — do not re-derive this from 009, it is stale): own,
  -- household-shared, public, OR shared via a visible collection
  -- (collection visibility acts as a floor regardless of the recipe's own
  -- visibility). Each bucket below excludes rows already counted by an
  -- earlier bucket so a recipe matching more than one OR-branch (e.g. a
  -- public recipe also sitting in a shared collection) is counted once.
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

  -- Collection-inheritance path (migration 012, 4th OR-branch): a recipe of
  -- ANY visibility (including 'private') becomes visible if it sits in a
  -- collection that is itself public, or household-visible within the
  -- caller's household. Excludes rows already in own/household/public above.
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

  -- ── This week's meals ──
  -- The caller's plan overlapping today; if none overlaps exactly, fall back
  -- to the most recently created plan (nearest-plan empty-state fallback).
  SELECT mp.id, mp.meals INTO v_week_plan
  FROM meal_plans mp
  WHERE mp.user_id = v_user_id
    AND mp.start_date <= CURRENT_DATE
    AND mp.end_date >= CURRENT_DATE
  ORDER BY mp.start_date DESC
  LIMIT 1;

  IF v_week_plan.id IS NULL THEN
    SELECT mp.id, mp.meals INTO v_week_plan
    FROM meal_plans mp
    WHERE mp.user_id = v_user_id
    ORDER BY mp.created_at DESC
    LIMIT 1;
  END IF;

  IF v_week_plan.id IS NOT NULL THEN
    v_today_meals := v_week_plan.meals -> (CURRENT_DATE::TEXT);
  ELSE
    v_today_meals := NULL;
  END IF;

  -- ── Active plan count ──
  SELECT COUNT(*) INTO v_active_plan_count
  FROM meal_plans mp
  WHERE mp.user_id = v_user_id
    AND mp.status = 'active';

  -- ── Grocery progress ──
  -- Prefer the active plan; otherwise the most-recently-created plan.
  SELECT mp.id, mp.grocery_list INTO v_grocery_plan
  FROM meal_plans mp
  WHERE mp.user_id = v_user_id
    AND mp.status = 'active'
  ORDER BY mp.created_at DESC
  LIMIT 1;

  IF v_grocery_plan.id IS NULL THEN
    SELECT mp.id, mp.grocery_list INTO v_grocery_plan
    FROM meal_plans mp
    WHERE mp.user_id = v_user_id
    ORDER BY mp.created_at DESC
    LIMIT 1;
  END IF;

  IF v_grocery_plan.id IS NOT NULL AND v_grocery_plan.grocery_list IS NOT NULL THEN
    -- checked/total counts over non-removed items (matches the !isRemoved
    -- filter used client-side in GroceryCart.tsx / MealPlanHistory.tsx).
    SELECT
      COUNT(*) FILTER (WHERE (item->>'isChecked')::boolean IS TRUE),
      COUNT(*)
    INTO v_grocery_checked, v_grocery_total
    FROM jsonb_array_elements(COALESCE(v_grocery_plan.grocery_list -> 'items', '[]'::jsonb)) AS item
    WHERE COALESCE((item->>'isRemoved')::boolean, false) = false;

    -- Per-category breakdown (checked/total), same item filter.
    SELECT COALESCE(json_agg(json_build_object(
      'category', cat.category,
      'checked', cat.checked,
      'total', cat.total
    ) ORDER BY cat.category), '[]'::json)
    INTO v_grocery_categories
    FROM (
      SELECT
        COALESCE(item->>'category', 'Other') AS category,
        COUNT(*) FILTER (WHERE (item->>'isChecked')::boolean IS TRUE) AS checked,
        COUNT(*) AS total
      FROM jsonb_array_elements(COALESCE(v_grocery_plan.grocery_list -> 'items', '[]'::jsonb)) AS item
      WHERE COALESCE((item->>'isRemoved')::boolean, false) = false
      GROUP BY COALESCE(item->>'category', 'Other')
    ) cat;
  ELSE
    v_grocery_checked := 0;
    v_grocery_total := 0;
    v_grocery_categories := '[]'::json;
  END IF;

  -- ── Reactions given ──
  -- Mirrors the RLS policy shape in migration 017: reactions where the
  -- caller is the reactor directly, or the reactor is a dependent the
  -- caller manages (family_members.managed_by = caller).
  SELECT COUNT(*) INTO v_reactions_given
  FROM recipe_reactions rr
  WHERE rr.user_id = v_user_id
     OR EXISTS (
       SELECT 1 FROM family_members fm
       WHERE fm.id = rr.family_member_id
       AND fm.managed_by = v_user_id
     );

  -- ── Most-cooked this month ──
  -- Bounded to plans starting on/after the first of the current month —
  -- an all-time scan would grow linearly with plan history. Iterates
  -- date-keyed entries only (jsonb_each), skipping plan-level "_"-prefixed
  -- keys (e.g. "_snacks", "_non_recipe" — see MealPlanMeals in
  -- src/types/mealPlan.ts), then each slot's array of meal entries
  -- (jsonb_array_elements) to tally recipeId occurrences.
  --
  -- `entry ? 'recipeId'` only checks key PRESENCE, not that the value is a
  -- syntactically valid UUID — a malformed value (e.g. a client-generated
  -- temp id that never got replaced) would abort the ::UUID cast and fail
  -- the entire RPC, not just this widget. The regex guard below validates
  -- the value's shape before the cast is attempted, so one bad entry is
  -- skipped rather than taking down recipe_counts/this_week/grocery_progress
  -- alongside it.
  SELECT COALESCE(json_agg(json_build_object(
    'recipeId', mc.recipe_id,
    'title', r.title,
    'count', mc.cook_count
  ) ORDER BY mc.cook_count DESC, r.title ASC), '[]'::json)
  INTO v_most_cooked
  FROM (
    SELECT (entry->>'recipeId')::UUID AS recipe_id, COUNT(*) AS cook_count
    FROM meal_plans mp,
      LATERAL jsonb_each(mp.meals) AS day(date_key, day_slots),
      LATERAL jsonb_each(day.day_slots) AS slot(slot_name, slot_entries),
      LATERAL jsonb_array_elements(slot.slot_entries) AS entry
    WHERE mp.user_id = v_user_id
      AND mp.start_date >= date_trunc('month', CURRENT_DATE)::DATE
      AND day.date_key NOT LIKE '\_%'
      AND jsonb_typeof(day.day_slots) = 'object'
      AND jsonb_typeof(slot.slot_entries) = 'array'
      AND entry ? 'recipeId'
      AND entry->>'recipeId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    GROUP BY (entry->>'recipeId')::UUID
    ORDER BY cook_count DESC
    LIMIT 10
  ) mc
  JOIN recipes r ON r.id = mc.recipe_id;

  -- ── Top cuisines ──
  -- GROUP BY over the caller's visible recipes — the full LIVE visibility
  -- predicate from migration 012 (own, household, public, OR shared via a
  -- visible collection), not the stale migration-009 version. Excludes
  -- NULL/empty cuisine. Normalized via lower(trim(cuisine)) — cuisine is
  -- free-text (VARCHAR(100), no enum) so casing/spelling variants can
  -- fragment counts; this is a known data-quality caveat, not a bug this
  -- RPC fixes.
  SELECT COALESCE(json_agg(json_build_object(
    'cuisine', tc.cuisine,
    'count', tc.cnt
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
      'own_count', v_own_count,
      'household_count', v_household_count,
      'public_visible_count', v_public_visible_count,
      'collection_shared_count', v_collection_shared_count
    ),
    'this_week', json_build_object(
      'plan_id', v_week_plan.id,
      'today_meals', v_today_meals
    ),
    'active_plan_count', v_active_plan_count,
    'grocery_progress', json_build_object(
      'plan_id', v_grocery_plan.id,
      'checked', v_grocery_checked,
      'total', v_grocery_total,
      'categories', v_grocery_categories
    ),
    'reactions_given', v_reactions_given,
    'most_cooked_this_month', v_most_cooked,
    'top_cuisines', v_top_cuisines
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO authenticated;
