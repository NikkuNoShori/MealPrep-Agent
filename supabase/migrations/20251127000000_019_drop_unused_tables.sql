-- Migration to drop unused tables: receipts, shopping_lists, user_ingredients
-- These tables are not used anywhere in the codebase

-- ============================================================================
-- Drop tables (CASCADE will automatically drop:
--   - Foreign key constraints
--   - Indexes
--   - Triggers
--   - RLS policies
-- )
-- ============================================================================

-- Drop shopping_lists table
DROP TABLE IF EXISTS shopping_lists CASCADE;

-- Drop user_ingredients table
DROP TABLE IF EXISTS user_ingredients CASCADE;

-- Drop receipts table
DROP TABLE IF EXISTS receipts CASCADE;

-- Note: RLS policies, triggers, and indexes are automatically dropped with CASCADE
-- No need to explicitly drop them

