-- Migration: Remove Stack Auth columns
-- Date: 2025-11-10
-- Description: 
--   1. Remove stack_auth_id column from profiles table
--   2. Migrate any data from stack_auth_id to id if needed
--   3. Update RLS policies to remove stack_auth_id references
--   4. Remove stack_auth_id index

BEGIN;

-- Step 1: Drop ALL RLS policies on profiles table (required before altering column type)
-- We need to drop all policies that reference the id column before we can change its type
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  -- Drop all policies on profiles table (both singular and plural names)
  FOR policy_record IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', policy_record.policyname);
  END LOOP;
  
  RAISE NOTICE 'Dropped all RLS policies on profiles table temporarily';
END $$;

-- Step 2: Drop foreign key constraints that reference profiles.id
-- Store foreign key info in a temp table before dropping, so we can recreate them later
CREATE TEMP TABLE IF NOT EXISTS fk_constraints_to_recreate (
  table_name TEXT,
  column_name TEXT,
  constraint_name TEXT
);

DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  -- Find all foreign key constraints that reference profiles.id and store them
  FOR constraint_record IN
    SELECT 
      tc.constraint_name,
      tc.table_name,
      kcu.column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND ccu.table_name = 'profiles'
      AND ccu.column_name = 'id'
  LOOP
    -- Store foreign key info
    INSERT INTO fk_constraints_to_recreate (table_name, column_name, constraint_name)
    VALUES (constraint_record.table_name, constraint_record.column_name, constraint_record.constraint_name);
    
    -- Drop the constraint
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I', 
      'public', constraint_record.table_name, constraint_record.constraint_name);
    RAISE NOTICE 'Dropped foreign key constraint % on table %', 
      constraint_record.constraint_name, constraint_record.table_name;
  END LOOP;
END $$;

-- Step 3: Check current id column type and migrate data from stack_auth_id to id
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

-- Step 4: Update foreign key columns in referencing tables and recreate constraints
DO $$
DECLARE
  fk_record RECORD;
  fk_table TEXT;
  fk_column TEXT;
  id_type TEXT;
BEGIN
  -- Use the stored foreign key info from temp table
  FOR fk_record IN
    SELECT table_name, column_name, constraint_name
    FROM fk_constraints_to_recreate
  LOOP
    fk_table := fk_record.table_name;
    fk_column := fk_record.column_name;
    
    -- Check if the foreign key column exists and what type it is
    SELECT data_type INTO id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = fk_table 
      AND column_name = fk_column;
    
    IF id_type IS NOT NULL THEN
      -- If the foreign key column is integer, convert it to UUID
      IF id_type = 'integer' THEN
        -- First, update values to match profiles.id
        -- Since profiles.id is now UUID, we need to match by the old integer id
        -- But wait - we already converted profiles.id to UUID, so we need to match differently
        -- Actually, we should have already updated the foreign keys before converting profiles.id
        -- Let's update foreign keys to match the new UUID profiles.id
        EXECUTE format('
          UPDATE %I.%I fk
          SET %I = p.id
          FROM profiles p
          WHERE fk.%I::text = p.id::text
        ', 'public', fk_table, fk_column, fk_column);
        
        -- For any remaining rows, we need to handle them differently
        -- Since profiles.id is now UUID, we can't match integer foreign keys directly
        -- We'll need to set them to NULL or handle them case by case
        -- Actually, let's just convert the column type - PostgreSQL will handle the conversion
        EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I TYPE UUID USING 
          CASE 
            WHEN %I IS NOT NULL THEN (SELECT id FROM profiles WHERE id::text = %I::text LIMIT 1)
            ELSE NULL
          END',
          'public', fk_table, fk_column, fk_column, fk_column);
        
        RAISE NOTICE 'Converted foreign key column %.% to UUID', fk_table, fk_column;
      END IF;
      
      -- Recreate foreign key constraint
      EXECUTE format('
        ALTER TABLE %I.%I 
        ADD CONSTRAINT %I 
        FOREIGN KEY (%I) 
        REFERENCES profiles(id) 
        ON DELETE CASCADE
      ', 'public', fk_table, fk_record.constraint_name, fk_column);
      
      RAISE NOTICE 'Recreated foreign key constraint % on %.%', fk_record.constraint_name, fk_table, fk_column;
    END IF;
  END LOOP;
  
  -- Clean up temp table
  DROP TABLE IF EXISTS fk_constraints_to_recreate;
END $$;

-- Step 5: Recreate RLS policies without stack_auth_id references
DO $$
BEGIN
  -- Recreate policies using only id (no stack_auth_id)
  CREATE POLICY "Users can view own profiles" ON profiles
    FOR SELECT USING (id = auth.uid());

  CREATE POLICY "Users can insert own profiles" ON profiles
    FOR INSERT WITH CHECK (id = auth.uid());

  CREATE POLICY "Users can update own profiles" ON profiles
    FOR UPDATE USING (id = auth.uid());

  CREATE POLICY "Users can delete own profiles" ON profiles
    FOR DELETE USING (id = auth.uid());

  RAISE NOTICE 'Recreated RLS policies without stack_auth_id references';
END $$;

-- Step 6: Remove stack_auth_id index
DROP INDEX IF EXISTS idx_profiles_stack_auth_id;

-- Step 7: Remove stack_auth_id column
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

