-- Migration: Remove Stack Auth columns
-- Date: 2025-11-10
-- Description: 
--   1. Remove stack_auth_id column from profiles table
--   2. Migrate any data from stack_auth_id to id if needed
--   3. Update RLS policies to remove stack_auth_id references
--   4. Remove stack_auth_id index

BEGIN;

-- Step 1: Check current id column type and migrate data from stack_auth_id to id
DO $$
DECLARE
  has_stack_auth_id BOOLEAN;
  id_type TEXT;
BEGIN
  -- Check if stack_auth_id column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'stack_auth_id'
  ) INTO has_stack_auth_id;

  -- Get current id column type
  SELECT data_type INTO id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'id';

  IF has_stack_auth_id THEN
    -- If id is integer, we need to convert it to UUID first
    IF id_type = 'integer' THEN
      -- Drop default value if it exists (can't cast integer default to UUID)
      ALTER TABLE profiles ALTER COLUMN id DROP DEFAULT;
      
      -- Convert id to UUID type by using stack_auth_id where available
      ALTER TABLE profiles 
        ALTER COLUMN id TYPE UUID USING 
          CASE 
            WHEN stack_auth_id IS NOT NULL THEN stack_auth_id
            ELSE gen_random_uuid()
          END;
      
      RAISE NOTICE 'Converted id column from integer to UUID';
    ELSE
      -- If id is already UUID, just migrate data where id is NULL or different
      UPDATE profiles
      SET id = stack_auth_id::UUID
      WHERE stack_auth_id IS NOT NULL 
        AND (id IS NULL OR id::text != stack_auth_id::text);
      
      RAISE NOTICE 'Migrated data from stack_auth_id to id';
    END IF;
  END IF;
END $$;

-- Step 2: Remove stack_auth_id references from RLS policies
-- Update profiles table RLS policies to remove stack_auth_id references
DO $$
BEGIN
  -- Drop and recreate policies without stack_auth_id references
  DROP POLICY IF EXISTS "Users can view own profiles" ON profiles;
  DROP POLICY IF EXISTS "Users can insert own profiles" ON profiles;
  DROP POLICY IF EXISTS "Users can update own profiles" ON profiles;
  DROP POLICY IF EXISTS "Users can delete own profiles" ON profiles;

  -- Recreate policies using only id (no stack_auth_id)
  CREATE POLICY "Users can view own profiles" ON profiles
    FOR SELECT USING (id = auth.uid());

  CREATE POLICY "Users can insert own profiles" ON profiles
    FOR INSERT WITH CHECK (id = auth.uid());

  CREATE POLICY "Users can update own profiles" ON profiles
    FOR UPDATE USING (id = auth.uid());

  CREATE POLICY "Users can delete own profiles" ON profiles
    FOR DELETE USING (id = auth.uid());

  RAISE NOTICE 'Updated RLS policies to remove stack_auth_id references';
END $$;

-- Step 3: Remove stack_auth_id index
DROP INDEX IF EXISTS idx_profiles_stack_auth_id;

-- Step 4: Remove stack_auth_id column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'stack_auth_id'
  ) THEN
    ALTER TABLE profiles DROP COLUMN stack_auth_id;
    RAISE NOTICE 'Removed stack_auth_id column from profiles table';
  ELSE
    RAISE NOTICE 'stack_auth_id column does not exist';
  END IF;
END $$;

COMMIT;

-- Note: After this migration:
-- 1. All profiles use id (UUID) as the primary key (matching Supabase Auth user IDs)
-- 2. RLS policies only reference id (no stack_auth_id)
-- 3. The stack_auth_id column and index are removed
-- 4. All existing data is migrated to use id

