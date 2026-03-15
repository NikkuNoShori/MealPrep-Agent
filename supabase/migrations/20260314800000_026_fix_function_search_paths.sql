-- ============================================================================
-- Migration 026: Fix Function Search Path Security Warnings
--
-- Adds SET search_path = public to all functions flagged by the Supabase
-- database linter (function_search_path_mutable). Without an explicit
-- search_path, a SECURITY DEFINER function could be tricked into resolving
-- unqualified table names against a malicious schema.
--
-- The 5 RPC functions from migration 025 already have this set.
-- This migration fixes the remaining 14 legacy functions.
-- ============================================================================

-- Helper functions (SECURITY DEFINER — highest risk)
ALTER FUNCTION is_household_member(UUID, UUID) SET search_path = public;
ALTER FUNCTION get_household_role(UUID, UUID) SET search_path = public;
ALTER FUNCTION is_admin() SET search_path = public;

-- Trigger functions
ALTER FUNCTION handle_new_user() SET search_path = public;
ALTER FUNCTION update_updated_at_column() SET search_path = public;
ALTER FUNCTION update_recipe_searchable_text() SET search_path = public;
ALTER FUNCTION update_recipe_embedding() SET search_path = public;
ALTER FUNCTION update_conversation_last_message() SET search_path = public;

-- Utility function
ALTER FUNCTION set_user_id(UUID) SET search_path = public;

-- Search/recommendation functions
ALTER FUNCTION search_recipes_semantic(VECTOR(1536), UUID, FLOAT, INT) SET search_path = public;
ALTER FUNCTION search_recipes_text(TEXT, UUID, INTEGER) SET search_path = public;
ALTER FUNCTION search_recipes_by_ingredients(TEXT[], UUID, FLOAT, INT) SET search_path = public;
ALTER FUNCTION find_similar_recipes(UUID, UUID, FLOAT, INT) SET search_path = public;
ALTER FUNCTION search_similar_recipes(VECTOR(384), UUID, FLOAT, INTEGER) SET search_path = public;
ALTER FUNCTION get_recipe_recommendations(UUID, VARCHAR, TEXT[], INT, INT) SET search_path = public;
