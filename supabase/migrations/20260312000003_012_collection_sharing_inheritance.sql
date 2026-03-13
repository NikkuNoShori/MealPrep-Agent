-- ============================================================================
-- Migration 012: Collection-Level Sharing Inheritance
--
-- When a recipe belongs to a shared collection, it becomes visible to users
-- who can see that collection — even if the recipe's own visibility is
-- more restrictive. A collection's visibility acts as a floor.
--
-- Part of MOP-0002 P2: Collection-level sharing inheritance
-- ============================================================================

-- Update the recipes SELECT policy to also check collection membership.
-- A recipe is visible if:
--   1. The user owns it, OR
--   2. It's household-visible and the user is in the owner's household, OR
--   3. It's public, OR
--   4. (NEW) It belongs to a collection the user can see

DROP POLICY IF EXISTS "Users can view accessible recipes" ON recipes;
CREATE POLICY "Users can view accessible recipes" ON recipes
  FOR SELECT USING (
    auth.uid() = user_id
    OR (visibility = 'household' AND EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.user_id = recipes.user_id
      AND is_household_member(hm.household_id, auth.uid())
    ))
    OR visibility = 'public'
    OR EXISTS (
      SELECT 1 FROM collection_recipes cr
      JOIN recipe_collections rc ON cr.collection_id = rc.id
      WHERE cr.recipe_id = recipes.id
      AND (
        rc.visibility = 'public'
        OR (rc.visibility = 'household' AND EXISTS (
          SELECT 1 FROM household_members hm
          WHERE hm.user_id = rc.user_id
          AND is_household_member(hm.household_id, auth.uid())
        ))
      )
    )
  );
