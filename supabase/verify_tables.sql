-- Verification script to check all required tables exist
-- Run this in Supabase SQL Editor to verify your database schema

-- ============================================================================
-- CHECK 1: List all tables in public schema
-- ============================================================================
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- ============================================================================
-- CHECK 2: Verify required tables exist
-- ============================================================================
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') 
        THEN '✅ EXISTS' 
        ELSE '❌ MISSING' 
    END as profiles,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'family_members') 
        THEN '✅ EXISTS' 
        ELSE '❌ MISSING' 
    END as family_members,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_preferences') 
        THEN '✅ EXISTS' 
        ELSE '❌ MISSING' 
    END as user_preferences,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recipes') 
        THEN '✅ EXISTS' 
        ELSE '❌ MISSING' 
    END as recipes,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recipe_embeddings') 
        THEN '✅ EXISTS' 
        ELSE '❌ MISSING' 
    END as recipe_embeddings,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'meal_plans') 
        THEN '✅ EXISTS' 
        ELSE '❌ MISSING' 
    END as meal_plans,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chat_messages') 
        THEN '✅ EXISTS' 
        ELSE '❌ MISSING' 
    END as chat_messages,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'receipts') 
        THEN '✅ EXISTS' 
        ELSE '❌ MISSING' 
    END as receipts,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ingredients') 
        THEN '✅ EXISTS' 
        ELSE '❌ MISSING' 
    END as ingredients,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_ingredients') 
        THEN '✅ EXISTS' 
        ELSE '❌ MISSING' 
    END as user_ingredients,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shopping_lists') 
        THEN '✅ EXISTS' 
        ELSE '❌ MISSING' 
    END as shopping_lists,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'roles') 
        THEN '✅ EXISTS' 
        ELSE '❌ MISSING' 
    END as roles,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_roles') 
        THEN '✅ EXISTS' 
        ELSE '❌ MISSING' 
    END as user_roles;

-- ============================================================================
-- CHECK 3: Verify profiles table structure
-- ============================================================================
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- ============================================================================
-- CHECK 4: Verify foreign key relationships
-- ============================================================================
SELECT 
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- ============================================================================
-- CHECK 5: Verify required extensions
-- ============================================================================
SELECT 
    extname as extension_name,
    extversion as version
FROM pg_extension
WHERE extname IN ('pgcrypto', 'vector')
ORDER BY extname;

-- ============================================================================
-- CHECK 6: Verify RLS is enabled on profiles
-- ============================================================================
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'profiles';

-- ============================================================================
-- CHECK 7: Verify triggers exist
-- ============================================================================
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN (
    'on_auth_user_created',
    'update_profiles_updated_at',
    'validate_family_member_family_id'
  )
ORDER BY event_object_table, trigger_name;

-- ============================================================================
-- CHECK 8: Verify RPC functions for semantic search
-- ============================================================================
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'search_recipes_semantic',
    'search_recipes_text',
    'update_updated_at_column',
    'handle_new_user',
    'validate_family_id'
  )
ORDER BY routine_name;

-- ============================================================================
-- SUMMARY: Missing tables report
-- ============================================================================
WITH required_tables AS (
    SELECT unnest(ARRAY[
        'profiles', 'family_members', 'user_preferences', 'recipes', 
        'recipe_embeddings', 'meal_plans', 'chat_messages', 'receipts',
        'ingredients', 'user_ingredients', 'shopping_lists', 'roles', 'user_roles'
    ]) AS table_name
)
SELECT 
    rt.table_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = rt.table_name
        ) 
        THEN '✅ EXISTS' 
        ELSE '❌ MISSING - Run migrations!' 
    END AS status
FROM required_tables rt
ORDER BY status DESC, rt.table_name;



