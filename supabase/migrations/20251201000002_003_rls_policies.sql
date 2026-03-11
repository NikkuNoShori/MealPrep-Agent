-- ============================================================================
-- Migration 003: Row Level Security Policies
-- Enables RLS and creates comprehensive policies for all tables.
-- ============================================================================

-- ============================================================================
-- 1. PROFILES — users access their own profile
-- ============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- ============================================================================
-- 2. RECIPES — own recipes + public recipes visible to all
-- ============================================================================
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own recipes" ON recipes;
CREATE POLICY "Users can view own recipes" ON recipes
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view public recipes" ON recipes;
CREATE POLICY "Users can view public recipes" ON recipes
    FOR SELECT USING (is_public = true);

DROP POLICY IF EXISTS "Users can insert own recipes" ON recipes;
CREATE POLICY "Users can insert own recipes" ON recipes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own recipes" ON recipes;
CREATE POLICY "Users can update own recipes" ON recipes
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own recipes" ON recipes;
CREATE POLICY "Users can delete own recipes" ON recipes
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 3. USER_PREFERENCES
-- ============================================================================
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own preferences" ON user_preferences;
CREATE POLICY "Users can view their own preferences" ON user_preferences
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own preferences" ON user_preferences;
CREATE POLICY "Users can insert their own preferences" ON user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own preferences" ON user_preferences;
CREATE POLICY "Users can update their own preferences" ON user_preferences
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own preferences" ON user_preferences;
CREATE POLICY "Users can delete their own preferences" ON user_preferences
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 4. MEAL_PLANS
-- ============================================================================
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own meal plans" ON meal_plans;
CREATE POLICY "Users can view their own meal plans" ON meal_plans
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own meal plans" ON meal_plans;
CREATE POLICY "Users can insert their own meal plans" ON meal_plans
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own meal plans" ON meal_plans;
CREATE POLICY "Users can update their own meal plans" ON meal_plans
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own meal plans" ON meal_plans;
CREATE POLICY "Users can delete their own meal plans" ON meal_plans
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 5. FAMILY_MEMBERS — access via family_id match
-- ============================================================================
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their family members" ON family_members;
CREATE POLICY "Users can view their family members" ON family_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.family_id = family_members.family_id
        )
    );

DROP POLICY IF EXISTS "Users can insert family members in their family" ON family_members;
CREATE POLICY "Users can insert family members in their family" ON family_members
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.family_id = family_members.family_id
        )
    );

DROP POLICY IF EXISTS "Users can update their family members" ON family_members;
CREATE POLICY "Users can update their family members" ON family_members
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.family_id = family_members.family_id
        )
    );

DROP POLICY IF EXISTS "Users can delete their family members" ON family_members;
CREATE POLICY "Users can delete their family members" ON family_members
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.family_id = family_members.family_id
        )
    );

-- ============================================================================
-- 6. USER_ROLES — read-only for own roles
-- ============================================================================
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
CREATE POLICY "Users can view their own roles" ON user_roles
    FOR SELECT USING (auth.uid() = user_id);

-- ============================================================================
-- 7. INGREDIENTS — shared catalog, read-only for authenticated users
-- ============================================================================
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view ingredients" ON ingredients;
CREATE POLICY "Authenticated users can view ingredients" ON ingredients
    FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================================
-- 8. ROLES — shared catalog, read-only for authenticated users
-- ============================================================================
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view roles" ON roles;
CREATE POLICY "Authenticated users can view roles" ON roles
    FOR SELECT USING (auth.role() = 'authenticated');
