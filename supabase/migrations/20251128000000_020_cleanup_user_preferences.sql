-- Migration to remove unused columns from user_preferences table
-- Only measurement_system is actually used in the application
-- All other preference fields are not wired into the UI or logic

-- ============================================================================
-- Drop unused columns from user_preferences
-- ============================================================================

ALTER TABLE user_preferences 
    DROP COLUMN IF EXISTS global_restrictions,
    DROP COLUMN IF EXISTS cuisine_preferences,
    DROP COLUMN IF EXISTS cooking_skill_level,
    DROP COLUMN IF EXISTS dietary_goals,
    DROP COLUMN IF EXISTS spice_tolerance,
    DROP COLUMN IF EXISTS meal_prep_preference,
    DROP COLUMN IF EXISTS budget_range,
    DROP COLUMN IF EXISTS time_constraints;

-- Note: Keeping:
--   - id (PK)
--   - user_id (FK to profiles)
--   - measurement_system (actually used in MeasurementSystemContext and Settings)
--   - created_at
--   - updated_at

