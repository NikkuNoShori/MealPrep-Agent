-- ============================================================================
-- Migration 013: Deprecation Cleanup
--
-- Removes deprecated columns, triggers, and backward-compatibility code
-- that was kept during the household migration transition period.
--
-- IMPORTANT: RLS policies must be dropped BEFORE the columns they reference.
-- ============================================================================

-- ============================================================================
-- 1. DROP RLS POLICIES that reference deprecated columns
-- Must happen first so columns can be dropped without dependency errors.
-- ============================================================================

-- Recipe policies referencing is_public
DROP POLICY IF EXISTS "Users can view own recipes or public recipes" ON recipes;
DROP POLICY IF EXISTS "Users can view public recipes" ON recipes;
DROP POLICY IF EXISTS "Users can view own recipes" ON recipes;

-- Family_members policies referencing profiles.family_id
DROP POLICY IF EXISTS "Users can view their family members" ON family_members;
DROP POLICY IF EXISTS "Users can insert family members in their household" ON family_members;
DROP POLICY IF EXISTS "Users can insert family members in their family" ON family_members;
DROP POLICY IF EXISTS "Users can update their family members" ON family_members;
DROP POLICY IF EXISTS "Users can delete their family members" ON family_members;

-- ============================================================================
-- 2. DROP is_public FROM RECIPES
-- ============================================================================

DROP TRIGGER IF EXISTS sync_recipe_visibility_trigger ON recipes;
DROP FUNCTION IF EXISTS sync_recipe_visibility();

ALTER TABLE recipes DROP COLUMN IF EXISTS is_public;

-- ============================================================================
-- 3. DROP profiles.family_id
-- ============================================================================

DROP TRIGGER IF EXISTS validate_family_member_family_id ON family_members;
DROP FUNCTION IF EXISTS validate_family_id();

ALTER TABLE profiles DROP COLUMN IF EXISTS family_id;

-- ============================================================================
-- 4. DROP family_members.family_id, make household_id NOT NULL
-- ============================================================================

ALTER TABLE family_members ALTER COLUMN household_id SET NOT NULL;
ALTER TABLE family_members DROP COLUMN IF EXISTS family_id;

-- ============================================================================
-- 5. RECREATE family_members RLS POLICIES (household-only, no family_id)
-- ============================================================================

CREATE POLICY "Users can view their family members" ON family_members
    FOR SELECT USING (
        is_household_member(household_id, auth.uid())
    );

CREATE POLICY "Users can insert family members in their household" ON family_members
    FOR INSERT WITH CHECK (
        is_household_member(household_id, auth.uid())
    );

CREATE POLICY "Users can update their family members" ON family_members
    FOR UPDATE USING (
        is_household_member(household_id, auth.uid())
    );

CREATE POLICY "Users can delete their family members" ON family_members
    FOR DELETE USING (
        is_household_member(household_id, auth.uid())
    );

-- ============================================================================
-- 6. FIX handle_new_user() TRIGGER
-- Migration 011 accidentally overwrote the OAuth name extraction logic.
-- This restores the full version from 009 + adds default collection creation.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_display_name TEXT;
    v_first_name TEXT;
    v_last_name TEXT;
    v_household_id UUID;
BEGIN
    -- Extract display name from various OAuth provider formats
    v_display_name := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''),
        NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
        NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
        NULLIF(TRIM(CONCAT(
            COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
            ' ',
            COALESCE(NEW.raw_user_meta_data->>'last_name', '')
        )), ''),
        split_part(COALESCE(NEW.email, 'user'), '@', 1)
    );

    -- Extract first/last name (Google uses given_name/family_name)
    v_first_name := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'first_name'), ''),
        NULLIF(TRIM(NEW.raw_user_meta_data->>'given_name'), ''),
        split_part(COALESCE(v_display_name, ''), ' ', 1)
    );

    v_last_name := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'last_name'), ''),
        NULLIF(TRIM(NEW.raw_user_meta_data->>'family_name'), ''),
        ''
    );

    -- Create profile
    INSERT INTO public.profiles (id, email, display_name, first_name, last_name, avatar_url, created_at, updated_at)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, ''),
        v_display_name,
        v_first_name,
        v_last_name,
        COALESCE(
            NEW.raw_user_meta_data->>'avatar_url',
            NEW.raw_user_meta_data->>'picture'
        ),
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = COALESCE(NEW.email, profiles.email),
        display_name = COALESCE(NULLIF(v_display_name, ''), profiles.display_name),
        first_name = COALESCE(NULLIF(v_first_name, ''), profiles.first_name),
        last_name = COALESCE(NULLIF(v_last_name, ''), profiles.last_name),
        avatar_url = COALESCE(
            NEW.raw_user_meta_data->>'avatar_url',
            NEW.raw_user_meta_data->>'picture',
            profiles.avatar_url
        ),
        updated_at = NOW();

    -- Assign default 'user' role
    INSERT INTO public.user_roles (user_id, role_id)
    SELECT NEW.id, id FROM roles WHERE name = 'user'
    ON CONFLICT (user_id, role_id) DO NOTHING;

    -- Create household for new user (only if they don't already have one)
    IF NOT EXISTS (SELECT 1 FROM household_members WHERE user_id = NEW.id) THEN
        INSERT INTO households (name, created_by)
        VALUES (COALESCE(v_display_name, 'My') || '''s Household', NEW.id)
        RETURNING id INTO v_household_id;

        INSERT INTO household_members (household_id, user_id, role)
        VALUES (v_household_id, NEW.id, 'owner');
    END IF;

    -- Create default collections (only if they don't already have any)
    IF NOT EXISTS (SELECT 1 FROM recipe_collections WHERE user_id = NEW.id) THEN
        INSERT INTO recipe_collections (user_id, name, icon, sort_order)
        VALUES
            (NEW.id, 'Favorites', 'heart', 0),
            (NEW.id, 'My Recipes', 'book', 1);
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'handle_new_user failed for %: % %', NEW.id, SQLERRM, SQLSTATE;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
