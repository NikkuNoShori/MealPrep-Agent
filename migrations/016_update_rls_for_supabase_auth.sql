-- Migration: Update RLS policies for Supabase Auth
-- Date: 2025-01-27
-- Description: 
--   1. Update RLS policies to use Supabase auth.uid() instead of session variables
--   2. Remove set_user_id function (no longer needed with Supabase Auth)
--   3. Update all tables to use auth.uid() for RLS

BEGIN;

-- Step 1: Drop existing RLS policies that use session variables
DROP POLICY IF EXISTS "Users can view own recipes" ON recipes;
DROP POLICY IF EXISTS "Users can insert own recipes" ON recipes;
DROP POLICY IF EXISTS "Users can update own recipes" ON recipes;
DROP POLICY IF EXISTS "Users can delete own recipes" ON recipes;
DROP POLICY IF EXISTS "Users can view own profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profiles" ON profiles;
DROP POLICY IF EXISTS "Users can delete own profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own chat_messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert own chat_messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can update own chat_messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can delete own chat_messages" ON chat_messages;

-- Step 2: Create new RLS policies using Supabase auth.uid()
-- These policies use auth.uid() which is automatically set by Supabase Auth

-- Recipes table policies
CREATE POLICY "Users can view own recipes" ON recipes
  FOR SELECT USING (
    -- Check if user_id matches the authenticated user's UUID
    user_id = auth.uid()
    OR is_public = true  -- Allow viewing public recipes
  );

CREATE POLICY "Users can insert own recipes" ON recipes
  FOR INSERT WITH CHECK (
    -- Ensure the inserted user_id matches the authenticated user
    user_id = auth.uid()
  );

CREATE POLICY "Users can update own recipes" ON recipes
  FOR UPDATE USING (
    -- Only allow updating recipes owned by the user
    user_id = auth.uid()
  ) WITH CHECK (
    -- Prevent changing user_id to a different user
    user_id = auth.uid()
  );

CREATE POLICY "Users can delete own recipes" ON recipes
  FOR DELETE USING (
    -- Only allow deleting recipes owned by the user
    user_id = auth.uid()
  );

-- Profiles table policies
CREATE POLICY "Users can view own profiles" ON profiles
  FOR SELECT USING (
    -- Check if id matches the authenticated user's UUID
    id = auth.uid()
  );

CREATE POLICY "Users can insert own profiles" ON profiles
  FOR INSERT WITH CHECK (
    -- Ensure the inserted id matches the authenticated user
    id = auth.uid()
  );

CREATE POLICY "Users can update own profiles" ON profiles
  FOR UPDATE USING (
    -- Only allow updating profiles owned by the user
    id = auth.uid()
  ) WITH CHECK (
    -- Prevent changing id to a different user
    id = auth.uid()
  );

CREATE POLICY "Users can delete own profiles" ON profiles
  FOR DELETE USING (
    -- Only allow deleting profiles owned by the user
    id = auth.uid()
  );

-- Chat messages table policies
CREATE POLICY "Users can view own chat_messages" ON chat_messages
  FOR SELECT USING (
    -- Check if user_id matches the authenticated user's UUID
    user_id = auth.uid()
  );

CREATE POLICY "Users can insert own chat_messages" ON chat_messages
  FOR INSERT WITH CHECK (
    -- Ensure the inserted user_id matches the authenticated user
    user_id = auth.uid()
  );

CREATE POLICY "Users can update own chat_messages" ON chat_messages
  FOR UPDATE USING (
    -- Only allow updating messages owned by the user
    user_id = auth.uid()
  ) WITH CHECK (
    -- Prevent changing user_id to a different user
    user_id = auth.uid()
  );

CREATE POLICY "Users can delete own chat_messages" ON chat_messages
  FOR DELETE USING (
    -- Only allow deleting messages owned by the user
    user_id = auth.uid()
  );

-- Step 3: Note about set_user_id function
-- The set_user_id() function is no longer needed with Supabase Auth
-- Supabase automatically sets auth.uid() in the session context
-- The function can be kept for backward compatibility but is not required

COMMIT;

-- Note: After this migration, RLS policies will use auth.uid() which is automatically
-- set by Supabase Auth when a user is authenticated. No manual session variable
-- setting is required.

