-- Migration: Update RLS policies to allow viewing public recipes
-- This migration extends the existing RLS policies to allow anyone (authenticated or not) to view public recipes

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view own recipes" ON recipes;
DROP POLICY IF EXISTS "Users can view own recipes or public recipes" ON recipes;

-- Create new SELECT policy that allows:
-- 1. Users to view their own recipes (regardless of is_public)
-- 2. Anyone (authenticated or not) to view public recipes (is_public = true)
-- Note: If app.current_user_id is not set (unauthenticated user), the first condition will fail
-- but the second condition (is_public = true) will still allow access
CREATE POLICY "Users can view own recipes or public recipes" ON recipes
  FOR SELECT USING (
    -- Users can view their own recipes (only if user_id is set)
    (
      current_setting('app.current_user_id', true) IS NOT NULL
      AND current_setting('app.current_user_id', true) != ''
      AND user_id::text = current_setting('app.current_user_id', true)
    )
    OR
    -- Anyone (authenticated or not) can view public recipes
    (is_public = true)
  );

-- Note: INSERT, UPDATE, and DELETE policies remain unchanged
-- Only the recipe owner can create, update, or delete recipes
-- Even if a recipe is public, only the owner can modify it

