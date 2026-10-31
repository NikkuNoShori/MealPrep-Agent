-- 059: Snapshot each meal_plan_entries row's base servings (MOP-0043 Phase 2, ADR-0009)
--
-- The grocery cart scales a recipe's ingredients by
-- (entry.servings / recipe.servings), read LIVE from the recipe at
-- aggregation time. If a recipe's yield is edited after a plan was made,
-- the scale silently drifts and the cart under/over-shops with no notice.
--
-- base_servings snapshots the recipe's yield at the moment the entry was
-- created. Null means "no snapshot" (legacy rows), which preserves today's
-- live-divisor behavior for anything planned before this migration.
--
-- No backfill: existing rows get null on purpose (ADR-0009 Decision 2).

ALTER TABLE meal_plan_entries
  ADD COLUMN IF NOT EXISTS base_servings INTEGER;

-- A 0 or negative value would become a 0-or-negative scale divisor
-- (Infinity/NaN ingredient amounts in the grocery cart). Null (no snapshot)
-- is still allowed and is the default for legacy rows.
ALTER TABLE meal_plan_entries
  ADD CONSTRAINT mpe_base_servings_positive CHECK (base_servings IS NULL OR base_servings > 0);

COMMENT ON COLUMN meal_plan_entries.base_servings IS
  'Recipe servings at the time this entry was created. Null = no snapshot (legacy row); grocery-cart scaling falls back to the recipe''s current servings. See ADR-0009.';
