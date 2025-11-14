-- Migration: Create Supabase RPC Functions
-- Date: 2025-01-27
-- Description: 
--   Create PostgreSQL functions that can be called via Supabase RPC API
--   These functions can be called directly from the frontend using supabase.rpc()

BEGIN;

-- Function: Create or update user profile
-- Can be called from frontend: supabase.rpc('create_or_update_profile', { ... })
CREATE OR REPLACE FUNCTION create_or_update_profile(
  p_first_name TEXT,
  p_last_name TEXT,
  p_email TEXT
)
RETURNS TABLE (
  id UUID,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get the authenticated user's ID from Supabase Auth
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Insert or update profile
  INSERT INTO profiles (id, email, first_name, last_name, created_at, updated_at)
  VALUES (v_user_id, p_email, p_first_name, p_last_name, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT (id) DO UPDATE
  SET 
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    email = EXCLUDED.email,
    updated_at = CURRENT_TIMESTAMP
  RETURNING profiles.id, profiles.email, profiles.first_name, profiles.last_name, 
            profiles.created_at, profiles.updated_at
  INTO id, email, first_name, last_name, created_at, updated_at;
  
  RETURN NEXT;
END;
$$;

-- Function: Get user profile
-- Can be called from frontend: supabase.rpc('get_user_profile')
CREATE OR REPLACE FUNCTION get_user_profile()
RETURNS TABLE (
  id UUID,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get the authenticated user's ID from Supabase Auth
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Return user profile
  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.first_name,
    p.last_name,
    p.created_at,
    p.updated_at
  FROM profiles p
  WHERE p.id = v_user_id;
END;
$$;

-- Function: Search recipes (with RLS)
-- Can be called from frontend: supabase.rpc('search_recipes', { search_query: 'chicken', limit: 10 })
CREATE OR REPLACE FUNCTION search_recipes(
  p_search_query TEXT DEFAULT '',
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title TEXT,
  description TEXT,
  ingredients JSONB,
  instructions JSONB,
  prep_time TEXT,
  cook_time TEXT,
  servings INTEGER,
  difficulty TEXT,
  cuisine TEXT,
  dietary_tags TEXT[],
  source_url TEXT,
  source_name TEXT,
  rating DECIMAL,
  is_favorite BOOLEAN,
  is_public BOOLEAN,
  slug TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get the authenticated user's ID from Supabase Auth
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Return recipes (RLS will automatically filter based on auth.uid())
  RETURN QUERY
  SELECT 
    r.id,
    r.user_id,
    r.title,
    r.description,
    r.ingredients,
    r.instructions,
    r.prep_time,
    r.cook_time,
    r.servings,
    r.difficulty,
    r.cuisine,
    r.dietary_tags,
    r.source_url,
    r.source_name,
    r.rating,
    r.is_favorite,
    r.is_public,
    r.slug,
    r.created_at,
    r.updated_at
  FROM recipes r
  WHERE 
    (r.user_id = v_user_id OR r.is_public = true)
    AND (
      p_search_query = '' OR
      r.title ILIKE '%' || p_search_query || '%' OR
      r.description ILIKE '%' || p_search_query || '%'
    )
  ORDER BY r.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION create_or_update_profile(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION search_recipes(TEXT, INTEGER) TO authenticated;

COMMIT;

-- Usage Examples:
-- 
-- From frontend (TypeScript):
-- 
-- // Create or update profile
-- const { data, error } = await supabase.rpc('create_or_update_profile', {
--   p_first_name: 'John',
--   p_last_name: 'Doe',
--   p_email: 'john@example.com'
-- });
--
-- // Get user profile
-- const { data, error } = await supabase.rpc('get_user_profile');
--
-- // Search recipes
-- const { data, error } = await supabase.rpc('search_recipes', {
--   p_search_query: 'chicken',
--   p_limit: 10
-- });

