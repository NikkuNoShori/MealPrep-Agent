-- Migration 052: Fix two RPC return-type mismatches causing live 400 errors
--
-- Both bugs are the same class: a plpgsql function's RETURNS TABLE column
-- type doesn't exactly match the type the function body's SELECT actually
-- produces. Unlike an ordinary query (where varchar/text and real/double
-- precision implicitly coerce), plpgsql enforces an exact type match
-- between RETURNS TABLE and RETURN QUERY's output -- a mismatch fails at
-- CALL time with "structure of query does not match function result type"
-- (42804), not at CREATE time, so this shipped silently until a live call
-- hit it. Confirmed against the live database 2026-10-19.
--
-- 1. search_recipes_text (migration 050b, 20261011000000): rank_score is
--    declared `double precision`, but ts_rank() returns `real`. Every call
--    failed with 42804 -- this is why recipe search returned nothing (not
--    a missing-data or RLS problem; the RPC never successfully returned).
--
-- 2. get_shared_with_me (migration 043): title is declared `text`, but
--    recipes.title is `character varying`. Same failure mode.

-- ── search_recipes_text: cast ts_rank's real to double precision ──────────

CREATE OR REPLACE FUNCTION search_recipes_text(
    search_query TEXT,
    user_uuid UUID,
    max_results INTEGER DEFAULT 20
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    title VARCHAR,
    description TEXT,
    ingredients JSONB,
    instructions JSONB,
    prep_time INTEGER,
    cook_time INTEGER,
    total_time INTEGER,
    servings INTEGER,
    difficulty VARCHAR,
    cuisine VARCHAR,
    tags TEXT[],
    dietary_tags TEXT[],
    image_url TEXT,
    nutrition_info JSONB,
    source_url TEXT,
    source_name VARCHAR,
    is_favorite BOOLEAN,
    slug VARCHAR,
    visibility TEXT,
    searchable_text TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    rank_score DOUBLE PRECISION
)
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
    v_caller UUID := auth.uid();
BEGIN
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
    END IF;

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
        r.total_time,
        r.servings,
        r.difficulty,
        r.cuisine,
        r.tags,
        r.dietary_tags,
        r.image_url,
        r.nutrition_info,
        r.source_url,
        r.source_name,
        r.is_favorite,
        r.slug,
        r.visibility,
        r.searchable_text,
        r.created_at,
        r.updated_at,
        ts_rank(
            to_tsvector('english', COALESCE(r.searchable_text, '')),
            plainto_tsquery('english', search_query)
        )::DOUBLE PRECISION AS rank_score
    FROM recipes r
    WHERE r.user_id = v_caller
        AND to_tsvector('english', COALESCE(r.searchable_text, ''))
            @@ plainto_tsquery('english', search_query)
    ORDER BY rank_score DESC
    LIMIT max_results;
END;
$$;

REVOKE ALL ON FUNCTION search_recipes_text(TEXT, UUID, INTEGER) FROM public;
GRANT EXECUTE ON FUNCTION search_recipes_text(TEXT, UUID, INTEGER) TO authenticated;

-- ── get_shared_with_me: match recipes.title's real type (varchar) ─────────

CREATE OR REPLACE FUNCTION get_shared_with_me()
RETURNS TABLE(
  share_id UUID,
  recipe_id UUID,
  title VARCHAR,
  description TEXT,
  image_url TEXT,
  tags TEXT[],
  visibility TEXT,
  shared_at TIMESTAMPTZ,
  seen_at TIMESTAMPTZ,
  shared_by_user_id UUID,
  sharer_display_name TEXT,
  sharer_username TEXT,
  sharer_avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT
      rs.id,
      r.id,
      r.title,
      r.description,
      r.image_url,
      r.tags,
      r.visibility,
      rs.shared_at,
      rs.seen_at,
      rs.shared_by_user_id,
      p.display_name,
      p.username,
      p.avatar_url
    FROM public.recipe_shares rs
    JOIN public.recipes  r ON r.id  = rs.recipe_id
    JOIN public.profiles p ON p.id  = rs.shared_by_user_id
    WHERE rs.shared_with_user_id = v_caller
    ORDER BY rs.shared_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION get_shared_with_me() FROM public;
GRANT EXECUTE ON FUNCTION get_shared_with_me() TO authenticated;
