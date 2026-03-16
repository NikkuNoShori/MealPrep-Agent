-- ============================================================================
-- Migration 027: Meal Plan Enhancements
--
-- Adds audit columns, updates status constraint, and adds notes column
-- to support full CRUD meal planning workflow (MOP-0004 P0).
-- ============================================================================

-- Audit columns
ALTER TABLE meal_plans
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS copied_from UUID REFERENCES meal_plans(id),
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Backfill created_by from user_id for existing rows
UPDATE meal_plans SET created_by = user_id WHERE created_by IS NULL;

-- Update status constraint to include all lifecycle states
ALTER TABLE meal_plans DROP CONSTRAINT IF EXISTS meal_plans_status_check;
ALTER TABLE meal_plans ADD CONSTRAINT meal_plans_status_check
  CHECK (status IN ('draft', 'active', 'completed', 'archived'));

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_meal_plans_status ON meal_plans(status);

-- Set search_path on any new functions (future-proofing)
