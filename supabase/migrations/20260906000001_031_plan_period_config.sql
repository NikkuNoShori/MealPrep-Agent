-- ============================================================================
-- Migration 031: Plan period config + randomizer config on profiles
-- MOP-0022: Configurable Default Meal Plan Period
-- MOP-0023: "I Don't Know" Meal Randomizer (config storage)
-- ============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS plan_period_config JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS randomizer_config   JSONB DEFAULT NULL;

COMMENT ON COLUMN profiles.plan_period_config IS
  'MOP-0022: User''s default meal plan period. Shape: {unit, count, startOn}. '
  'NULL = 1 week starting Monday (app default).';

COMMENT ON COLUMN profiles.randomizer_config IS
  'MOP-0023: Randomizer preferences. Shape: {visibility[], tags[], maxRepeat}. '
  'NULL = use app defaults (all visibility, no tag filter, maxRepeat 1).';
