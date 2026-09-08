-- ============================================================================
-- Migration 036: Fix meal_plans.copied_from FK — add ON DELETE SET NULL
-- ============================================================================
-- meal_plans.copied_from is a self-referential FK with no cascade rule.
-- Deleting a plan that was used as a copy-source fails with:
--   "update or delete on table 'meal_plans' violates foreign key constraint
--    meal_plans_copied_from_fkey on table 'meal_plans'"
--
-- Fix: drop and re-add the constraint with ON DELETE SET NULL so deleting
-- the original plan simply nulls the reference in derived plans.
--
-- HARD RULE: authored locally — Nick deploys.
-- ============================================================================

ALTER TABLE meal_plans
  DROP CONSTRAINT IF EXISTS meal_plans_copied_from_fkey;

ALTER TABLE meal_plans
  ADD CONSTRAINT meal_plans_copied_from_fkey
    FOREIGN KEY (copied_from)
    REFERENCES meal_plans(id)
    ON DELETE SET NULL;
