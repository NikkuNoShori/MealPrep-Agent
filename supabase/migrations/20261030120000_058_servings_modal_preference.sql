-- 058: Persisted "remember my servings choice" preference
--
-- Adds a per-user default for whether the servings-adjustment modal should
-- be skipped when adding recipes to a meal plan. When true, the modal is
-- bypassed and recipes are added using the recipe's own default servings
-- (same as clicking "No, use defaults").

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS skip_servings_modal BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN profiles.skip_servings_modal IS
  'When true, the servings-adjustment modal is skipped when adding recipes to a meal plan; recipes use their own default servings.';
