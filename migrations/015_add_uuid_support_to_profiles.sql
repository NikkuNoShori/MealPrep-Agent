-- Migration: Add UUID support to profiles table for Stack Auth
-- Date: 2025-01-27
-- Description: 
--   1. Add UUID column for Stack Auth user IDs
--   2. Keep INTEGER id for backward compatibility
--   3. Update recipes to use UUID if needed
--   4. Ensure first_name and last_name exist

BEGIN;

-- Step 1: Add UUID column for Stack Auth user IDs (if it doesn't exist)
DO $$
BEGIN
  -- Check if stack_auth_id column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'stack_auth_id'
  ) THEN
    -- Add UUID column for Stack Auth user IDs
    ALTER TABLE profiles ADD COLUMN stack_auth_id UUID UNIQUE;
    
    -- Create index on stack_auth_id
    CREATE INDEX IF NOT EXISTS idx_profiles_stack_auth_id ON profiles(stack_auth_id);
    
    RAISE NOTICE 'Added stack_auth_id UUID column to profiles table';
  ELSE
    RAISE NOTICE 'stack_auth_id column already exists';
  END IF;
END $$;

-- Step 2: Ensure first_name and last_name exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'first_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN first_name VARCHAR(255) NOT NULL DEFAULT '';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'last_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_name VARCHAR(255) NOT NULL DEFAULT '';
  END IF;
END $$;

-- Step 3: Remove Neon Auth specific columns if they exist
DO $$
BEGIN
  -- Remove uid column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'uid'
  ) THEN
    ALTER TABLE profiles DROP COLUMN uid;
    RAISE NOTICE 'Removed uid column from profiles table';
  END IF;
  
  -- Remove password_hash column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE profiles DROP COLUMN password_hash;
    RAISE NOTICE 'Removed password_hash column from profiles table';
  END IF;
END $$;

-- Step 4: Update server code to use stack_auth_id instead of id
-- Note: This migration just adds the column - the server code needs to be updated
-- to use stack_auth_id for Stack Auth user IDs

COMMIT;

