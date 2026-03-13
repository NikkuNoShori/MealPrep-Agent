-- ============================================================================
-- Migration 009: Households, Recipe Visibility & Updated RLS
-- MOP-0002 P0: Foundation for family sharing and recipe permissions.
--
-- Creates: households, household_members, household_invites tables
-- Modifies: recipes (adds visibility column), family_members (adds household_id, managed_by)
-- Updates: handle_new_user() trigger, RLS policies on recipes + family_members
-- ============================================================================

-- ============================================================================
-- 1. HOUSEHOLD TABLES
-- ============================================================================

-- households: the core sharing unit
CREATE TABLE IF NOT EXISTS households (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT 'My Household',
    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_households_created_by ON households(created_by);

CREATE TRIGGER update_households_updated_at
    BEFORE UPDATE ON households
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- household_members: links authenticated users to households with roles
CREATE TABLE IF NOT EXISTS household_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (household_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_household_members_user_id ON household_members(user_id);
CREATE INDEX IF NOT EXISTS idx_household_members_household_id ON household_members(household_id);

-- household_invites: pending invitations (authenticated members only)
CREATE TABLE IF NOT EXISTS household_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES profiles(id),
    invited_email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '7 days'
);

CREATE INDEX IF NOT EXISTS idx_household_invites_household_id ON household_invites(household_id);
CREATE INDEX IF NOT EXISTS idx_household_invites_email ON household_invites(invited_email);

-- ============================================================================
-- 2. RECIPE VISIBILITY COLUMN
-- ============================================================================

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'household', 'public'));

-- Backfill from existing is_public
UPDATE recipes SET visibility = CASE WHEN is_public THEN 'public' ELSE 'private' END
WHERE visibility = 'private' AND is_public = true;

-- Keep is_public for backward compatibility during transition (synced via trigger)
CREATE OR REPLACE FUNCTION sync_recipe_visibility()
RETURNS TRIGGER AS $$
BEGIN
    -- Sync visibility → is_public
    IF NEW.visibility = 'public' THEN
        NEW.is_public := true;
    ELSE
        NEW.is_public := false;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_recipe_visibility_trigger ON recipes;
CREATE TRIGGER sync_recipe_visibility_trigger
    BEFORE INSERT OR UPDATE OF visibility ON recipes
    FOR EACH ROW
    EXECUTE FUNCTION sync_recipe_visibility();

-- ============================================================================
-- 3. FAMILY_MEMBERS SCHEMA CHANGES
-- ============================================================================

ALTER TABLE family_members ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES households(id) ON DELETE CASCADE;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS managed_by UUID REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_family_members_household_id ON family_members(household_id);

-- ============================================================================
-- 4. BACKFILL: Create households for existing users
-- ============================================================================

-- For each existing profile, create a household and make them the owner
DO $$
DECLARE
    r RECORD;
    v_household_id UUID;
BEGIN
    FOR r IN SELECT id, display_name, family_id FROM profiles
    LOOP
        -- Create household
        INSERT INTO households (id, name, created_by)
        VALUES (gen_random_uuid(), COALESCE(r.display_name, 'My') || '''s Household', r.id)
        RETURNING id INTO v_household_id;

        -- Add user as owner
        INSERT INTO household_members (household_id, user_id, role)
        VALUES (v_household_id, r.id, 'owner')
        ON CONFLICT (household_id, user_id) DO NOTHING;

        -- Link existing family_members to the new household
        UPDATE family_members
        SET household_id = v_household_id,
            managed_by = r.id
        WHERE family_id = r.family_id
          AND household_id IS NULL;
    END LOOP;
END $$;

-- ============================================================================
-- 5. UPDATE handle_new_user() TRIGGER
-- Also creates a household + membership on signup.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_display_name TEXT;
    v_first_name TEXT;
    v_last_name TEXT;
    v_profile_id UUID;
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

    -- Extract first/last name (Google uses given_name/family_name or full_name)
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

    -- Assign default 'user' role (no-op if already assigned or role doesn't exist)
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

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't prevent user creation
        RAISE WARNING 'handle_new_user failed for %: % %', NEW.id, SQLERRM, SQLSTATE;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. RLS POLICIES — NEW TABLES
-- ============================================================================

-- HOUSEHOLDS
ALTER TABLE households ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their households" ON households;
CREATE POLICY "Users can view their households" ON households
    FOR SELECT USING (
        is_household_member(id, auth.uid())
    );

DROP POLICY IF EXISTS "Users can create households" ON households;
CREATE POLICY "Users can create households" ON households
    FOR INSERT WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Household owners can update" ON households;
CREATE POLICY "Household owners can update" ON households
    FOR UPDATE USING (
        get_household_role(id, auth.uid()) = 'owner'
    );

DROP POLICY IF EXISTS "Household owners can delete" ON households;
CREATE POLICY "Household owners can delete" ON households
    FOR DELETE USING (
        get_household_role(id, auth.uid()) = 'owner'
    );

-- HOUSEHOLD_MEMBERS
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;

-- Helper function to check household membership without triggering RLS recursion.
-- SECURITY DEFINER bypasses RLS on the function's own queries.
CREATE OR REPLACE FUNCTION is_household_member(p_household_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM household_members
        WHERE household_id = p_household_id
        AND user_id = p_user_id
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_household_role(p_household_id UUID, p_user_id UUID)
RETURNS TEXT AS $$
    SELECT role FROM household_members
    WHERE household_id = p_household_id
    AND user_id = p_user_id
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "Users can view members of their households" ON household_members;
CREATE POLICY "Users can view members of their households" ON household_members
    FOR SELECT USING (
        is_household_member(household_id, auth.uid())
    );

DROP POLICY IF EXISTS "Owners and admins can insert members" ON household_members;
CREATE POLICY "Owners and admins can insert members" ON household_members
    FOR INSERT WITH CHECK (
        get_household_role(household_id, auth.uid()) IN ('owner', 'admin')
    );

DROP POLICY IF EXISTS "Owners can update members" ON household_members;
CREATE POLICY "Owners can update members" ON household_members
    FOR UPDATE USING (
        get_household_role(household_id, auth.uid()) = 'owner'
    );

DROP POLICY IF EXISTS "Owners can remove members or members can leave" ON household_members;
CREATE POLICY "Owners can remove members or members can leave" ON household_members
    FOR DELETE USING (
        get_household_role(household_id, auth.uid()) = 'owner'
        OR user_id = auth.uid()
    );

-- HOUSEHOLD_INVITES
ALTER TABLE household_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view invites for their households" ON household_invites;
CREATE POLICY "Users can view invites for their households" ON household_invites
    FOR SELECT USING (
        is_household_member(household_id, auth.uid())
        OR invited_email = (SELECT email FROM profiles WHERE id = auth.uid())
    );

DROP POLICY IF EXISTS "Owners and admins can create invites" ON household_invites;
CREATE POLICY "Owners and admins can create invites" ON household_invites
    FOR INSERT WITH CHECK (
        get_household_role(household_id, auth.uid()) IN ('owner', 'admin')
    );

DROP POLICY IF EXISTS "Owners and admins can update invites" ON household_invites;
CREATE POLICY "Owners and admins can update invites" ON household_invites
    FOR UPDATE USING (
        get_household_role(household_id, auth.uid()) IN ('owner', 'admin')
        OR invited_email = (SELECT email FROM profiles WHERE id = auth.uid())
    );

-- ============================================================================
-- 7. RLS POLICIES — UPDATED RECIPES
-- ============================================================================

-- Drop existing separate SELECT policies
DROP POLICY IF EXISTS "Users can view own recipes" ON recipes;
DROP POLICY IF EXISTS "Users can view public recipes" ON recipes;

-- Unified SELECT: own, household-shared, or public
-- Uses is_household_member() to avoid RLS recursion on household_members.
CREATE POLICY "Users can view accessible recipes" ON recipes
    FOR SELECT USING (
        auth.uid() = user_id
        OR (visibility = 'household' AND EXISTS (
            SELECT 1 FROM household_members hm
            WHERE hm.user_id = recipes.user_id
            AND is_household_member(hm.household_id, auth.uid())
        ))
        OR visibility = 'public'
    );

-- INSERT/UPDATE/DELETE policies remain unchanged (owner-only)
-- They already exist from migration 003, no action needed.

-- ============================================================================
-- 8. RLS POLICIES — UPDATED FAMILY_MEMBERS
-- Rewrite to check household_members instead of profiles.family_id.
-- Keep backward compat: allow access via family_id OR household_id.
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their family members" ON family_members;
CREATE POLICY "Users can view their family members" ON family_members
    FOR SELECT USING (
        -- New: via household membership (uses SECURITY DEFINER helper to avoid RLS recursion)
        is_household_member(household_id, auth.uid())
        -- Backward compat: via family_id (for records not yet migrated)
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.family_id = family_members.family_id
        )
    );

DROP POLICY IF EXISTS "Users can insert family members in their family" ON family_members;
CREATE POLICY "Users can insert family members in their household" ON family_members
    FOR INSERT WITH CHECK (
        is_household_member(household_id, auth.uid())
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.family_id = family_members.family_id
        )
    );

DROP POLICY IF EXISTS "Users can update their family members" ON family_members;
CREATE POLICY "Users can update their family members" ON family_members
    FOR UPDATE USING (
        is_household_member(household_id, auth.uid())
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.family_id = family_members.family_id
        )
    );

DROP POLICY IF EXISTS "Users can delete their family members" ON family_members;
CREATE POLICY "Users can delete their family members" ON family_members
    FOR DELETE USING (
        is_household_member(household_id, auth.uid())
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.family_id = family_members.family_id
        )
    );
