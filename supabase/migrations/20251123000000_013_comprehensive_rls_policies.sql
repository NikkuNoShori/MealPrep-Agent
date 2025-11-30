-- ============================================================================
-- Comprehensive Row Level Security (RLS) Policies
-- This migration ensures all tables have proper RLS enabled with appropriate policies
-- ============================================================================

-- ============================================================================
-- 1. PROFILES (already has RLS, but ensure policies are correct)
-- ============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================================
-- 2. RECIPES (already has RLS, but ensure policies are correct)
-- ============================================================================
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own recipes" ON recipes;
CREATE POLICY "Users can view own recipes" ON recipes
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own recipes" ON recipes;
CREATE POLICY "Users can insert own recipes" ON recipes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own recipes" ON recipes;
CREATE POLICY "Users can update own recipes" ON recipes
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own recipes" ON recipes;
CREATE POLICY "Users can delete own recipes" ON recipes
    FOR DELETE USING (auth.uid() = user_id);

-- Allow viewing public recipes (if is_public = true)
DROP POLICY IF EXISTS "Users can view public recipes" ON recipes;
CREATE POLICY "Users can view public recipes" ON recipes
    FOR SELECT USING (is_public = true);

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
-- 5. CHAT_MESSAGES (only if table exists)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'chat_messages'
    ) THEN
        ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "Users can view their own chat messages" ON chat_messages;
        CREATE POLICY "Users can view their own chat messages" ON chat_messages
            FOR SELECT USING (auth.uid() = user_id);

        DROP POLICY IF EXISTS "Users can insert their own chat messages" ON chat_messages;
        CREATE POLICY "Users can insert their own chat messages" ON chat_messages
            FOR INSERT WITH CHECK (auth.uid() = user_id);

        DROP POLICY IF EXISTS "Users can update their own chat messages" ON chat_messages;
        CREATE POLICY "Users can update their own chat messages" ON chat_messages
            FOR UPDATE USING (auth.uid() = user_id);

        DROP POLICY IF EXISTS "Users can delete their own chat messages" ON chat_messages;
        CREATE POLICY "Users can delete their own chat messages" ON chat_messages
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- ============================================================================
-- 6. RECEIPTS
-- ============================================================================
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own receipts" ON receipts;
CREATE POLICY "Users can view their own receipts" ON receipts
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own receipts" ON receipts;
CREATE POLICY "Users can insert their own receipts" ON receipts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own receipts" ON receipts;
CREATE POLICY "Users can update their own receipts" ON receipts
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own receipts" ON receipts;
CREATE POLICY "Users can delete their own receipts" ON receipts
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 7. USER_INGREDIENTS
-- ============================================================================
ALTER TABLE user_ingredients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own ingredients" ON user_ingredients;
CREATE POLICY "Users can view their own ingredients" ON user_ingredients
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own ingredients" ON user_ingredients;
CREATE POLICY "Users can insert their own ingredients" ON user_ingredients
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own ingredients" ON user_ingredients;
CREATE POLICY "Users can update their own ingredients" ON user_ingredients
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own ingredients" ON user_ingredients;
CREATE POLICY "Users can delete their own ingredients" ON user_ingredients
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 8. SHOPPING_LISTS
-- ============================================================================
ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own shopping lists" ON shopping_lists;
CREATE POLICY "Users can view their own shopping lists" ON shopping_lists
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own shopping lists" ON shopping_lists;
CREATE POLICY "Users can insert their own shopping lists" ON shopping_lists
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own shopping lists" ON shopping_lists;
CREATE POLICY "Users can update their own shopping lists" ON shopping_lists
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own shopping lists" ON shopping_lists;
CREATE POLICY "Users can delete their own shopping lists" ON shopping_lists
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 9. FAMILY_MEMBERS
-- Users can view family members that belong to their family_id
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
-- 10. USER_ROLES (already has RLS, but ensure policies are correct)
-- ============================================================================
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
CREATE POLICY "Users can view their own roles" ON user_roles
    FOR SELECT USING (auth.uid() = user_id);

-- Note: Role assignment/deletion should typically be admin-only
-- These policies are restrictive - only allow viewing own roles
-- Admin operations would need service role or admin functions

-- ============================================================================
-- 11. RECIPE_EMBEDDINGS
-- Users can only access embeddings for their own recipes
-- ============================================================================
ALTER TABLE recipe_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view embeddings for their recipes" ON recipe_embeddings;
CREATE POLICY "Users can view embeddings for their recipes" ON recipe_embeddings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM recipes
            WHERE recipes.id = recipe_embeddings.recipe_id
            AND recipes.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert embeddings for their recipes" ON recipe_embeddings;
CREATE POLICY "Users can insert embeddings for their recipes" ON recipe_embeddings
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM recipes
            WHERE recipes.id = recipe_embeddings.recipe_id
            AND recipes.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update embeddings for their recipes" ON recipe_embeddings;
CREATE POLICY "Users can update embeddings for their recipes" ON recipe_embeddings
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM recipes
            WHERE recipes.id = recipe_embeddings.recipe_id
            AND recipes.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete embeddings for their recipes" ON recipe_embeddings;
CREATE POLICY "Users can delete embeddings for their recipes" ON recipe_embeddings
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM recipes
            WHERE recipes.id = recipe_embeddings.recipe_id
            AND recipes.user_id = auth.uid()
        )
    );

-- ============================================================================
-- 12. INGREDIENTS (Public/Shared Table - Read-only for authenticated users)
-- This table contains shared ingredient data, so we allow read access
-- but restrict write access (only admins/service role should modify)
-- ============================================================================
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read ingredients (shared catalog)
DROP POLICY IF EXISTS "Authenticated users can view ingredients" ON ingredients;
CREATE POLICY "Authenticated users can view ingredients" ON ingredients
    FOR SELECT USING (auth.role() = 'authenticated');

-- Note: INSERT/UPDATE/DELETE on ingredients should be restricted to admins
-- This would typically be done via service role or admin functions
-- For now, we'll restrict writes to prevent accidental modifications
DROP POLICY IF EXISTS "Restrict ingredient modifications" ON ingredients;
-- No policy = no access (default deny)

-- ============================================================================
-- 13. ROLES (Public/Shared Table - Read-only for authenticated users)
-- This table contains system roles, so we allow read access
-- but restrict write access (only admins/service role should modify)
-- ============================================================================
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read roles (to see available roles)
DROP POLICY IF EXISTS "Authenticated users can view roles" ON roles;
CREATE POLICY "Authenticated users can view roles" ON roles
    FOR SELECT USING (auth.role() = 'authenticated');

-- Note: INSERT/UPDATE/DELETE on roles should be restricted to admins
-- This would typically be done via service role or admin functions
-- For now, we'll restrict writes to prevent accidental modifications
DROP POLICY IF EXISTS "Restrict role modifications" ON roles;
-- No policy = no access (default deny)

-- ============================================================================
-- Summary of RLS Policies:
-- ============================================================================
-- ✅ profiles - Users can only access their own profile
-- ✅ recipes - Users can only access their own recipes (+ public recipes)
-- ✅ user_preferences - Users can only access their own preferences
-- ✅ meal_plans - Users can only access their own meal plans
-- ✅ chat_messages - Users can only access their own chat messages
-- ✅ receipts - Users can only access their own receipts
-- ✅ user_ingredients - Users can only access their own ingredients
-- ✅ shopping_lists - Users can only access their own shopping lists
-- ✅ family_members - Users can access family members in their family
-- ✅ user_roles - Users can only view their own roles
-- ✅ recipe_embeddings - Users can only access embeddings for their recipes
-- ✅ ingredients - Authenticated users can read (shared catalog)
-- ✅ roles - Authenticated users can read (shared catalog)
-- ============================================================================

