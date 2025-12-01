-- Migration: Fix RLS policies for Stack Auth
-- This migration replaces Supabase-specific RLS policies with Stack Auth compatible policies
-- using PostgreSQL session variables

-- Drop existing Supabase-specific policies
DROP POLICY IF EXISTS "Users can view own recipes" ON recipes;
DROP POLICY IF EXISTS "Users can insert own recipes" ON recipes;
DROP POLICY IF EXISTS "Users can update own recipes" ON recipes;
DROP POLICY IF EXISTS "Users can delete own recipes" ON recipes;

-- Create function to set user context for RLS
-- This function sets a session variable that can be used in RLS policies
CREATE OR REPLACE FUNCTION set_user_id(user_uuid UUID)
RETURNS void AS $$
BEGIN
  -- Set session variable with user UUID
  PERFORM set_config('app.current_user_id', user_uuid::text, true);
END;
$$ LANGUAGE plpgsql;

-- Create new RLS policies using session variable
-- These policies check the session variable instead of auth.uid()

CREATE POLICY "Users can view own recipes" ON recipes
  FOR SELECT USING (
    -- Check if user_id matches the session variable
    user_id::text = current_setting('app.current_user_id', true)
  );

CREATE POLICY "Users can insert own recipes" ON recipes
  FOR INSERT WITH CHECK (
    -- Ensure the inserted user_id matches the session variable
    user_id::text = current_setting('app.current_user_id', true)
  );

CREATE POLICY "Users can update own recipes" ON recipes
  FOR UPDATE USING (
    -- Only allow updating recipes owned by the user
    user_id::text = current_setting('app.current_user_id', true)
  ) WITH CHECK (
    -- Prevent changing user_id to a different user
    user_id::text = current_setting('app.current_user_id', true)
  );

CREATE POLICY "Users can delete own recipes" ON recipes
  FOR DELETE USING (
    -- Only allow deleting recipes owned by the user
    user_id::text = current_setting('app.current_user_id', true)
  );

-- Note: The session variable must be set before each query
-- This is handled in the database service layer (src/services/database.ts)
-- The set_user_id() function is called with the authenticated user's ID before executing queries

-- To test RLS policies:
-- 1. Set user context: SELECT set_user_id('user-uuid-here');
-- 2. Try to query recipes: SELECT * FROM recipes;
-- 3. Only recipes with matching user_id should be visible

