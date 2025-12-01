-- Migration: Fix profiles table schema to match Stack Auth UUID IDs
-- Date: 2025-01-27
-- Description: 
--   1. Check if profiles table has INTEGER id (Neon Auth schema)
--   2. If so, alter it to use UUID id to match Stack Auth user IDs
--   3. Remove Neon Auth specific columns (uid, password_hash) if they exist
--   4. Ensure first_name and last_name columns exist
--   5. Update foreign keys if needed

BEGIN;

-- Step 1: Check current profiles table schema
DO $$
DECLARE
  current_id_type TEXT;
  has_uid BOOLEAN;
  has_password_hash BOOLEAN;
  has_first_name BOOLEAN;
  has_last_name BOOLEAN;
BEGIN
  -- Get current id column type
  SELECT data_type INTO current_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'id';
  
  -- Check for Neon Auth columns
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'uid'
  ) INTO has_uid;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'password_hash'
  ) INTO has_password_hash;
  
  -- Check for first_name and last_name
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'first_name'
  ) INTO has_first_name;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'last_name'
  ) INTO has_last_name;
  
  -- Step 2: If id is INTEGER, we need to convert to UUID
  -- This is complex if there's data, so we'll create a new table and migrate
  IF current_id_type = 'integer' THEN
    RAISE NOTICE 'Profiles table has INTEGER id - converting to UUID schema';
    
    -- Create new profiles table with UUID id
    CREATE TABLE IF NOT EXISTS profiles_new (
      id UUID PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      first_name VARCHAR(255) NOT NULL DEFAULT '',
      last_name VARCHAR(255) NOT NULL DEFAULT '',
      family_id UUID,
      household_size INTEGER DEFAULT 1,
      avatar_url TEXT,
      timezone VARCHAR(50) DEFAULT 'UTC',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Migrate data from old profiles to new (if uid exists, use it as UUID, otherwise generate new)
    -- Note: This assumes uid is a valid UUID string
    IF has_uid THEN
      INSERT INTO profiles_new (id, email, first_name, last_name, family_id, household_size, created_at, updated_at)
      SELECT 
        CASE 
          WHEN uid ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN uid::UUID
          ELSE gen_random_uuid()
        END as id,
        email,
        COALESCE(first_name, '') as first_name,
        COALESCE(last_name, '') as last_name,
        CASE 
          WHEN family_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN family_id::UUID
          ELSE NULL
        END as family_id,
        household_size,
        created_at,
        updated_at
      FROM profiles
      ON CONFLICT (id) DO NOTHING;
    ELSE
      -- No uid column, generate new UUIDs
      INSERT INTO profiles_new (id, email, first_name, last_name, family_id, household_size, created_at, updated_at)
      SELECT 
        gen_random_uuid() as id,
        email,
        COALESCE(first_name, '') as first_name,
        COALESCE(last_name, '') as last_name,
        CASE 
          WHEN family_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN family_id::UUID
          ELSE NULL
        END as family_id,
        household_size,
        created_at,
        updated_at
      FROM profiles
      ON CONFLICT (id) DO NOTHING;
    END IF;
    
    -- Drop old profiles table
    DROP TABLE IF EXISTS profiles CASCADE;
    
    -- Rename new table to profiles
    ALTER TABLE profiles_new RENAME TO profiles;
    
    RAISE NOTICE 'Profiles table converted from INTEGER to UUID schema';
  ELSE
    -- id is already UUID or doesn't exist, just ensure columns exist
    RAISE NOTICE 'Profiles table id type is: %', current_id_type;
    
    -- Add first_name and last_name if they don't exist
    IF NOT has_first_name THEN
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name VARCHAR(255) NOT NULL DEFAULT '';
    END IF;
    
    IF NOT has_last_name THEN
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name VARCHAR(255) NOT NULL DEFAULT '';
    END IF;
    
    -- Remove Neon Auth columns if they exist
    IF has_uid THEN
      ALTER TABLE profiles DROP COLUMN IF EXISTS uid;
    END IF;
    
    IF has_password_hash THEN
      ALTER TABLE profiles DROP COLUMN IF EXISTS password_hash;
    END IF;
  END IF;
END $$;

-- Step 3: Recreate foreign keys if they were dropped
DO $$
BEGIN
  -- Recreate recipes foreign key if it doesn't exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'recipes') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'recipes_user_id_fkey' AND table_name = 'recipes'
    ) THEN
      ALTER TABLE recipes 
        ADD CONSTRAINT recipes_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Step 4: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Step 5: Recreate trigger
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at 
  BEFORE UPDATE ON profiles 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;

