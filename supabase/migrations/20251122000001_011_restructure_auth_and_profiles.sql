-- Migration to restructure authentication, profiles, roles, and family relationships
-- This migration is IDEMPOTENT - it checks what exists before making changes
-- Based on schema check: profiles exists but missing PK, family_id is VARCHAR, missing some columns

-- ============================================================================
-- STEP 1: Fix profiles table structure
-- ============================================================================
DO $$
BEGIN
    -- Check if profiles table exists (it does based on schema check)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        
        -- 1. Add PRIMARY KEY if missing (this is the main issue!)
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_schema = 'public'
            AND table_name = 'profiles' 
            AND constraint_type = 'PRIMARY KEY'
        ) THEN
            -- First ensure id column is NOT NULL
            ALTER TABLE profiles ALTER COLUMN id SET NOT NULL;
            -- Then add primary key
            ALTER TABLE profiles ADD PRIMARY KEY (id);
        END IF;
        
        -- 2. Add foreign key to auth.users if missing
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_schema = 'public'
            AND table_name = 'profiles' 
            AND constraint_name = 'profiles_id_fkey'
        ) THEN
            ALTER TABLE profiles 
            ADD CONSTRAINT profiles_id_fkey 
            FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
        END IF;
        
        -- 3. Fix family_id data type (VARCHAR → UUID)
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'profiles' 
            AND column_name = 'family_id'
            AND data_type = 'character varying'
        ) THEN
            -- Convert VARCHAR family_id to UUID
            -- First, handle any invalid UUIDs by generating new ones
            ALTER TABLE profiles 
            ALTER COLUMN family_id TYPE UUID 
            USING CASE 
                WHEN family_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
                THEN family_id::UUID
                ELSE gen_random_uuid()
            END;
            
            -- Set default if null
            ALTER TABLE profiles 
            ALTER COLUMN family_id SET DEFAULT gen_random_uuid();
        END IF;
        
        -- 4. Add missing columns
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'profiles' 
            AND column_name = 'display_name'
        ) THEN
            -- Create display_name from first_name + last_name if they exist, otherwise use email
            ALTER TABLE profiles 
            ADD COLUMN display_name VARCHAR(255);
            
            -- Populate display_name from existing data
            UPDATE profiles 
            SET display_name = TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))
            WHERE display_name IS NULL OR display_name = '';
            
            -- For any remaining nulls, use email prefix
            UPDATE profiles 
            SET display_name = split_part(email, '@', 1)
            WHERE display_name IS NULL OR display_name = '';
            
            -- Make it NOT NULL after populating
            ALTER TABLE profiles ALTER COLUMN display_name SET NOT NULL;
        END IF;
        
        -- Add avatar_url if missing
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'profiles' 
            AND column_name = 'avatar_url'
        ) THEN
            ALTER TABLE profiles ADD COLUMN avatar_url TEXT;
        END IF;
        
        -- Add timezone if missing
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'profiles' 
            AND column_name = 'timezone'
        ) THEN
            ALTER TABLE profiles ADD COLUMN timezone VARCHAR(50) DEFAULT 'UTC';
        END IF;
        
    ELSE
        -- Profiles doesn't exist - create it (shouldn't happen based on schema check, but just in case)
        CREATE TABLE profiles (
            id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            email VARCHAR(255) UNIQUE NOT NULL,
            display_name VARCHAR(255) NOT NULL,
            first_name VARCHAR(255) DEFAULT '',
            last_name VARCHAR(255) DEFAULT '',
            avatar_url TEXT,
            timezone VARCHAR(50) DEFAULT 'UTC',
            household_size INTEGER DEFAULT 1,
            family_id UUID DEFAULT gen_random_uuid(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Ensure roles table structure is correct
-- ============================================================================
-- Roles table exists, just ensure it has the right structure
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- STEP 3: Ensure user_roles table structure is correct
-- ============================================================================
-- user_roles exists, just ensure it references profiles correctly
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        CREATE TABLE IF NOT EXISTS user_roles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
            assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
            UNIQUE(user_id, role_id)
        );
        
        -- Update foreign key if it references wrong table
        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
            WHERE tc.table_schema = 'public'
            AND tc.table_name = 'user_roles'
            AND tc.constraint_type = 'FOREIGN KEY'
            AND kcu.column_name = 'user_id'
            AND ccu.table_name != 'profiles'
        ) THEN
            -- Drop and recreate with correct reference
            ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
            ALTER TABLE user_roles 
            ADD CONSTRAINT user_roles_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- ============================================================================
-- STEP 4: Fix family_members table relationship
-- ============================================================================
-- Update family_id column type if it's not UUID
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'family_members' 
        AND column_name = 'family_id'
        AND data_type = 'character varying'
    ) THEN
        -- Convert VARCHAR family_id to UUID
        ALTER TABLE family_members 
        ALTER COLUMN family_id TYPE UUID 
        USING CASE 
            WHEN family_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
            THEN family_id::UUID
            ELSE NULL  -- Set to NULL if invalid, will need manual fix
        END;
    END IF;
END $$;

-- Drop existing foreign key if it references wrong table
DO $$
DECLARE
    constraint_name_var TEXT;
BEGIN
    SELECT constraint_name INTO constraint_name_var
    FROM information_schema.table_constraints 
    WHERE table_schema = 'public'
    AND table_name = 'family_members' 
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name LIKE '%family_id%';
    
    IF constraint_name_var IS NOT NULL THEN
        EXECUTE format('ALTER TABLE family_members DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
    END IF;
END $$;

-- Create validation function for family_id (since it's not unique, can't use FK)
CREATE OR REPLACE FUNCTION validate_family_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM profiles WHERE family_id = NEW.family_id
    ) THEN
        RAISE EXCEPTION 'Family ID % does not exist in profiles', NEW.family_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate family_id
DROP TRIGGER IF EXISTS validate_family_member_family_id ON family_members;
CREATE TRIGGER validate_family_member_family_id
    BEFORE INSERT OR UPDATE ON family_members
    FOR EACH ROW
    EXECUTE FUNCTION validate_family_id();

-- ============================================================================
-- STEP 5: Update all foreign key references to profiles
-- ============================================================================
DO $$
DECLARE
    table_record RECORD;
    current_fk_table TEXT;
    constraint_name_var TEXT;
BEGIN
    -- List of tables that should reference profiles
    FOR table_record IN 
        SELECT DISTINCT table_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND column_name = 'user_id'
        AND table_name IN (
            'user_preferences', 'recipes', 'recipe_ratings', 'meal_plans', 
            'chat_messages', 'receipts', 'user_ingredients', 'shopping_lists'
        )
    LOOP
        -- Find the foreign key constraint for user_id
        SELECT tc.constraint_name, ccu.table_name 
        INTO constraint_name_var, current_fk_table
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
        WHERE tc.table_schema = 'public'
        AND tc.table_name = table_record.table_name
        AND kcu.column_name = 'user_id'
        AND tc.constraint_type = 'FOREIGN KEY'
        LIMIT 1;
        
        -- Only update if it references wrong table or doesn't exist
        IF current_fk_table IS NULL OR current_fk_table != 'profiles' THEN
            -- Drop old constraint if exists
            IF constraint_name_var IS NOT NULL THEN
                EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', 
                    table_record.table_name, constraint_name_var);
            END IF;
            
            -- Add new constraint referencing profiles (only if profiles exists)
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
                EXECUTE format(
                    'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE',
                    table_record.table_name,
                    table_record.table_name || '_user_id_fkey'
                );
            END IF;
        END IF;
    END LOOP;
END $$;

-- ============================================================================
-- STEP 6: Create indexes (if not exists)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_family_id ON profiles(family_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_family_members_family_id ON family_members(family_id);

-- ============================================================================
-- STEP 7: Insert default roles (only if they don't exist)
-- ============================================================================
INSERT INTO roles (name, description, permissions) VALUES
    ('admin', 'Administrator with full access', '{"all": true}'::jsonb),
    ('user', 'Standard user with basic access', '{"recipes": true, "meal_plans": true, "chat": true}'::jsonb),
    ('family_member', 'Family member with limited access', '{"recipes": true, "view_meal_plans": true}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- STEP 8: Create trigger for automatic profile creation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create profile if profiles table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        INSERT INTO public.profiles (id, email, display_name, first_name, last_name, created_at, updated_at)
        VALUES (
            NEW.id,
            NEW.email,
            COALESCE(
                NEW.raw_user_meta_data->>'display_name',
                CONCAT(
                    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
                    ' ',
                    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
                ),
                split_part(NEW.email, '@', 1)
            ),
            COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
            COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
            NOW(),
            NOW()
        )
        ON CONFLICT (id) DO UPDATE
        SET
            email = NEW.email,
            updated_at = NOW();
        
        -- Assign default 'user' role if roles table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'roles') THEN
            INSERT INTO public.user_roles (user_id, role_id)
            SELECT NEW.id, id FROM roles WHERE name = 'user'
            ON CONFLICT (user_id, role_id) DO NOTHING;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- STEP 9: Add updated_at triggers
-- ============================================================================
-- Check if update_updated_at_column function exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'update_updated_at_column') THEN
        -- Add trigger for profiles if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.triggers 
            WHERE trigger_schema = 'public' 
            AND trigger_name = 'update_profiles_updated_at'
        ) THEN
            CREATE TRIGGER update_profiles_updated_at 
                BEFORE UPDATE ON profiles 
                FOR EACH ROW 
                EXECUTE FUNCTION update_updated_at_column();
        END IF;
        
        -- Add trigger for roles if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.triggers 
            WHERE trigger_schema = 'public' 
            AND trigger_name = 'update_roles_updated_at'
        ) THEN
            CREATE TRIGGER update_roles_updated_at 
                BEFORE UPDATE ON roles 
                FOR EACH ROW 
                EXECUTE FUNCTION update_updated_at_column();
        END IF;
    END IF;
END $$;

-- ============================================================================
-- STEP 10: Enable Row Level Security (RLS)
-- ============================================================================
-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies and recreate
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Enable RLS on user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
CREATE POLICY "Users can view their own roles" ON user_roles
    FOR SELECT USING (auth.uid() = user_id);
