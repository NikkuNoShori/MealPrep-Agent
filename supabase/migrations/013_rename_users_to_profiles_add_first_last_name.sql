-- Migration: Rename users table to profiles and add first_name/last_name
-- Date: 2025-01-27
-- Description: 
--   1. Add first_name and last_name columns to users table
--   2. Migrate display_name data to first_name/last_name (split on space)
--   3. Rename users table to profiles
--   4. Update all foreign key references from users(id) to profiles(id)
--   5. Update all indexes
--   6. Update all triggers

BEGIN;

-- Step 1: Determine which table name exists (users or profiles)
DO $$
DECLARE
  table_name_var TEXT;
BEGIN
  -- Check if users table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    table_name_var := 'users';
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    table_name_var := 'profiles';
  ELSE
    RAISE EXCEPTION 'Neither users nor profiles table exists';
  END IF;

  -- Step 1: Add first_name and last_name columns
  EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS first_name VARCHAR(255)', table_name_var);
  EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS last_name VARCHAR(255)', table_name_var);

  -- Step 2: Migrate display_name data to first_name/last_name (if display_name exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = table_name_var AND column_name = 'display_name'
  ) THEN
    EXECUTE format('
      UPDATE %I 
      SET 
        first_name = CASE 
          WHEN display_name IS NOT NULL AND display_name != '''' THEN
            SPLIT_PART(display_name, '' '', 1)
          ELSE
            ''''
        END,
        last_name = CASE 
          WHEN display_name IS NOT NULL AND display_name != '''' AND POSITION('' '' IN display_name) > 0 THEN
            SUBSTRING(display_name FROM POSITION('' '' IN display_name) + 1)
          ELSE
            ''''
        END
      WHERE first_name IS NULL OR last_name IS NULL',
      table_name_var
    );
    
    -- Step 4: Drop display_name column (no longer needed)
    EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS display_name', table_name_var);
  END IF;

  -- Step 3: Make first_name and last_name NOT NULL (after data migration)
  EXECUTE format('ALTER TABLE %I ALTER COLUMN first_name SET NOT NULL', table_name_var);
  EXECUTE format('ALTER TABLE %I ALTER COLUMN last_name SET NOT NULL', table_name_var);
  EXECUTE format('ALTER TABLE %I ALTER COLUMN first_name SET DEFAULT ''''', table_name_var);
  EXECUTE format('ALTER TABLE %I ALTER COLUMN last_name SET DEFAULT ''''', table_name_var);

  -- Step 5: Rename table from users to profiles (if it's still called users)
  IF table_name_var = 'users' THEN
    ALTER TABLE users RENAME TO profiles;
  END IF;
END $$;

-- Step 6: Update all foreign key references from users(id) to profiles(id)
-- Note: PostgreSQL will automatically update foreign keys when we rename the table,
-- but we need to update the constraint names
-- Only update foreign keys for tables that exist

-- Update recipes table foreign key (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'recipes') THEN
    ALTER TABLE recipes 
      DROP CONSTRAINT IF EXISTS recipes_user_id_fkey;
    ALTER TABLE recipes 
      ADD CONSTRAINT recipes_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Update family_members table foreign key (references family_id, not id) - only if table and column exist
-- Note: Skip if family_id column doesn't exist in profiles table (may not be in all schemas)
DO $$
BEGIN
  -- Check if family_members table exists and if profiles table has family_id column
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'family_members') 
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'family_id') THEN
    BEGIN
      ALTER TABLE family_members 
        DROP CONSTRAINT IF EXISTS family_members_family_id_fkey;
      ALTER TABLE family_members 
        ADD CONSTRAINT family_members_family_id_fkey 
          FOREIGN KEY (family_id) REFERENCES profiles(family_id) ON DELETE CASCADE;
    EXCEPTION
      WHEN OTHERS THEN
        -- If family_id column doesn't exist, skip this foreign key update
        RAISE NOTICE 'Skipping family_members foreign key update: family_id column may not exist';
    END;
  END IF;
END $$;

-- Update user_preferences table foreign key (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_preferences') THEN
    ALTER TABLE user_preferences 
      DROP CONSTRAINT IF EXISTS user_preferences_user_id_fkey;
    ALTER TABLE user_preferences 
      ADD CONSTRAINT user_preferences_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Update chat_messages table foreign key (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_messages') THEN
    ALTER TABLE chat_messages 
      DROP CONSTRAINT IF EXISTS chat_messages_user_id_fkey;
    ALTER TABLE chat_messages 
      ADD CONSTRAINT chat_messages_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Update receipts table foreign key (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'receipts') THEN
    ALTER TABLE receipts 
      DROP CONSTRAINT IF EXISTS receipts_user_id_fkey;
    ALTER TABLE receipts 
      ADD CONSTRAINT receipts_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Update user_ingredients table foreign key (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_ingredients') THEN
    ALTER TABLE user_ingredients 
      DROP CONSTRAINT IF EXISTS user_ingredients_user_id_fkey;
    ALTER TABLE user_ingredients 
      ADD CONSTRAINT user_ingredients_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Update shopping_lists table foreign key (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shopping_lists') THEN
    ALTER TABLE shopping_lists 
      DROP CONSTRAINT IF EXISTS shopping_lists_user_id_fkey;
    ALTER TABLE shopping_lists 
      ADD CONSTRAINT shopping_lists_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Update meal_plans table foreign key (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meal_plans') THEN
    ALTER TABLE meal_plans 
      DROP CONSTRAINT IF EXISTS meal_plans_user_id_fkey;
    ALTER TABLE meal_plans 
      ADD CONSTRAINT meal_plans_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Step 7: Update indexes (rename them to reflect profiles table)
DROP INDEX IF EXISTS idx_users_email;
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Only create neon_user_id index if the column exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'neon_user_id') THEN
    DROP INDEX IF EXISTS idx_users_neon_user_id;
    CREATE INDEX IF NOT EXISTS idx_profiles_neon_user_id ON profiles(neon_user_id);
  END IF;
END $$;

-- Only create family_id index if the column exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'family_id') THEN
    DROP INDEX IF EXISTS idx_users_family_id;
    CREATE INDEX IF NOT EXISTS idx_profiles_family_id ON profiles(family_id);
  END IF;
END $$;

-- Step 8: Create update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Step 9: Update trigger name (if exists)
DROP TRIGGER IF EXISTS update_users_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at 
  BEFORE UPDATE ON profiles 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Step 10: Update RLS function set_user_id to use profiles table (if exists)
-- The function itself doesn't need to change, but we'll add a comment
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_user_id') THEN
    COMMENT ON FUNCTION set_user_id(UUID) IS 'Sets the current user context for RLS. References profiles table.';
  END IF;
END $$;

COMMIT;

