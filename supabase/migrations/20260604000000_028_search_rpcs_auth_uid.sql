-- ============================================================================
-- Migration 028: Search RPCs — replace user_id parameter with auth.uid()
-- ============================================================================
-- MOP-0007 Phase 0 (security gate)
--
-- The search/recommendation RPCs defined in migration 004 accept a `user_id`
-- UUID parameter and filter by it. This is a privilege-escalation surface —
-- nothing inside the function bodies checks that the passed-in user_id matches
-- the calling user. A client could pass any UUID and read that user's recipes
-- (RLS is bypassed inside these PL/pgSQL functions since they were not marked
-- SECURITY DEFINER, but auth.uid() reflects the JWT-authenticated caller, so
-- using it instead of the parameter is both correct AND closes the escalation).
--
-- This migration replaces the function bodies to use auth.uid() internally.
-- The original `user_id` UUID parameter is RETAINED for backwards compatibility
-- with the current chat-api handlers (handlers.ts still passes user_id from
-- ctx.user.id). The parameter is now VESTIGIAL — internally ignored — and
-- should be dropped in a follow-up migration once all callers are migrated to
-- the parameter-less signature.
--
-- Affected functions (all in migration 004:140-435):
--   - search_recipes_text
--   - search_recipes_semantic
--   - find_similar_recipes
--   - search_recipes_by_ingredients
--   - get_recipe_recommendations
--
-- Functions intentionally NOT touched:
--   - search_similar_recipes (384-dim, orphan per RAG_AUDIT — pending removal)
--
-- HARD RULE: This file is authored locally. Nick deploys.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- search_recipes_text — full-text via ts_vector on searchable_text
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION search_recipes_text(
    search_query TEXT,
    user_uuid UUID,  -- VESTIGIAL: ignored; auth.uid() is the source of truth
    max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
    recipe_id UUID,
    title VARCHAR(255),
    description TEXT,
    ingredients JSONB,
    instructions JSONB,
    rank_score FLOAT
)
LANGUAGE plpgsql
SET search_path = public
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
        r.title,
        r.description,
        r.ingredients,
        r.instructions,
        ts_rank(
            to_tsvector('english', COALESCE(r.searchable_text, '')),
            plainto_tsquery('english', search_query)
        ) AS rank_score
    FROM recipes r
    WHERE r.user_id = v_caller
        AND to_tsvector('english', COALESCE(r.searchable_text, ''))
            @@ plainto_tsquery('english', search_query)
    ORDER BY rank_score DESC
    LIMIT max_results;
END;
$$;

-- ----------------------------------------------------------------------------
-- search_recipes_semantic — 1536-dim vector via recipes.embedding_vector
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION search_recipes_semantic(
    query_embedding VECTOR(1536),
    user_id UUID,  -- VESTIGIAL: ignored; auth.uid() is the source of truth
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    title VARCHAR(255),
    description TEXT,
    ingredients JSONB,
    instructions JSONB,
    prep_time INTEGER,
    cook_time INTEGER,
    servings INTEGER,
    difficulty VARCHAR(20),
    tags TEXT[],
    image_url TEXT,
    source_url TEXT,
    rating DECIMAL(3,2),
    is_public BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    searchable_text TEXT,
    similarity_score FLOAT
)
LANGUAGE plpgsql
SET search_path = public
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
        r.title,
        r.description,
        r.ingredients,
        r.instructions,
        r.prep_time,
        r.cook_time,
        r.servings,
        r.difficulty,
        r.tags,
        r.image_url,
        r.source_url,
        r.rating,
        r.is_public,
        r.created_at,
        r.updated_at,
        r.searchable_text,
        1 - (r.embedding_vector <=> query_embedding) AS similarity_score
    FROM recipes r
    WHERE r.user_id = v_caller
        AND r.embedding_vector IS NOT NULL
        AND 1 - (r.embedding_vector <=> query_embedding) > match_threshold
    ORDER BY r.embedding_vector <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ----------------------------------------------------------------------------
-- find_similar_recipes — given a recipe id, find others similar by embedding
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION find_similar_recipes(
    recipe_id UUID,
    user_id UUID,  -- VESTIGIAL: ignored; auth.uid() is the source of truth
    similarity_threshold FLOAT DEFAULT 0.6,
    max_results INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    title VARCHAR(255),
    description TEXT,
    ingredients JSONB,
    instructions JSONB,
    prep_time INTEGER,
    cook_time INTEGER,
    servings INTEGER,
    difficulty VARCHAR(20),
    tags TEXT[],
    image_url TEXT,
    source_url TEXT,
    rating DECIMAL(3,2),
    is_public BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    searchable_text TEXT,
    similarity_score FLOAT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_caller UUID := auth.uid();
    target_embedding VECTOR(1536);
BEGIN
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
    END IF;

    SELECT embedding_vector INTO target_embedding
    FROM recipes
    WHERE recipes.id = find_similar_recipes.recipe_id
      AND recipes.user_id = v_caller;

    IF target_embedding IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        r.id,
        r.title,
        r.description,
        r.ingredients,
        r.instructions,
        r.prep_time,
        r.cook_time,
        r.servings,
        r.difficulty,
        r.tags,
        r.image_url,
        r.source_url,
        r.rating,
        r.is_public,
        r.created_at,
        r.updated_at,
        r.searchable_text,
        1 - (r.embedding_vector <=> target_embedding) AS similarity_score
    FROM recipes r
    WHERE r.user_id = v_caller
        AND r.id != find_similar_recipes.recipe_id
        AND r.embedding_vector IS NOT NULL
        AND 1 - (r.embedding_vector <=> target_embedding) > similarity_threshold
    ORDER BY r.embedding_vector <=> target_embedding
    LIMIT max_results;
END;
$$;

-- ----------------------------------------------------------------------------
-- search_recipes_by_ingredients — text-based ingredient matching
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION search_recipes_by_ingredients(
    ingredient_list TEXT[],
    user_id UUID,  -- VESTIGIAL: ignored; auth.uid() is the source of truth
    match_threshold FLOAT DEFAULT 0.5,
    match_count INT DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    title VARCHAR(255),
    description TEXT,
    ingredients JSONB,
    instructions JSONB,
    prep_time INTEGER,
    cook_time INTEGER,
    servings INTEGER,
    difficulty VARCHAR(20),
    tags TEXT[],
    image_url TEXT,
    source_url TEXT,
    rating DECIMAL(3,2),
    is_public BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    searchable_text TEXT,
    ingredient_match_score FLOAT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_caller UUID := auth.uid();
    ingredient_query TEXT;
BEGIN
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
    END IF;

    ingredient_query := array_to_string(ingredient_list, ' ');

    RETURN QUERY
    SELECT
        r.id,
        r.title,
        r.description,
        r.ingredients,
        r.instructions,
        r.prep_time,
        r.cook_time,
        r.servings,
        r.difficulty,
        r.tags,
        r.image_url,
        r.source_url,
        r.rating,
        r.is_public,
        r.created_at,
        r.updated_at,
        r.searchable_text,
        ts_rank(
            to_tsvector('english', r.searchable_text),
            plainto_tsquery('english', ingredient_query)
        ) AS ingredient_match_score
    FROM recipes r
    WHERE r.user_id = v_caller
        AND to_tsvector('english', r.searchable_text)
            @@ plainto_tsquery('english', ingredient_query)
    ORDER BY ingredient_match_score DESC
    LIMIT match_count;
END;
$$;

-- ----------------------------------------------------------------------------
-- get_recipe_recommendations — pure SQL scoring formula (NOT embedding-based)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_recipe_recommendations(
    user_id UUID,  -- VESTIGIAL: ignored; auth.uid() is the source of truth
    preference_difficulty VARCHAR(20) DEFAULT NULL,
    preference_tags TEXT[] DEFAULT NULL,
    max_prep_time_minutes INT DEFAULT NULL,
    limit_count INT DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    title VARCHAR(255),
    description TEXT,
    ingredients JSONB,
    instructions JSONB,
    prep_time INTEGER,
    cook_time INTEGER,
    servings INTEGER,
    difficulty VARCHAR(20),
    tags TEXT[],
    image_url TEXT,
    source_url TEXT,
    rating DECIMAL(3,2),
    is_public BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    searchable_text TEXT,
    recommendation_score FLOAT
)
LANGUAGE plpgsql
SET search_path = public
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
        r.title,
        r.description,
        r.ingredients,
        r.instructions,
        r.prep_time,
        r.cook_time,
        r.servings,
        r.difficulty,
        r.tags,
        r.image_url,
        r.source_url,
        r.rating,
        r.is_public,
        r.created_at,
        r.updated_at,
        r.searchable_text,
        (
            CASE WHEN preference_difficulty IS NULL OR r.difficulty = preference_difficulty THEN 1.0 ELSE 0.5 END +
            CASE WHEN preference_tags IS NULL OR r.tags && preference_tags THEN 1.0 ELSE 0.5 END +
            CASE WHEN r.rating IS NOT NULL THEN r.rating / 5.0 ELSE 0.5 END +
            CASE WHEN (max_prep_time_minutes IS NULL OR r.prep_time IS NULL OR r.prep_time <= max_prep_time_minutes) THEN 1.0 ELSE 0.3 END
        ) / 4.0 AS recommendation_score
    FROM recipes r
    WHERE r.user_id = v_caller
        AND (preference_difficulty IS NULL OR r.difficulty = preference_difficulty)
        AND (preference_tags IS NULL OR r.tags && preference_tags)
        AND (max_prep_time_minutes IS NULL OR r.prep_time IS NULL OR r.prep_time <= max_prep_time_minutes)
    ORDER BY recommendation_score DESC, r.created_at DESC
    LIMIT limit_count;
END;
$$;

-- ============================================================================
-- Privileges: grant execute to authenticated users only
-- ============================================================================
REVOKE ALL ON FUNCTION search_recipes_text(TEXT, UUID, INTEGER) FROM public;
GRANT EXECUTE ON FUNCTION search_recipes_text(TEXT, UUID, INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION search_recipes_semantic(VECTOR(1536), UUID, FLOAT, INT) FROM public;
GRANT EXECUTE ON FUNCTION search_recipes_semantic(VECTOR(1536), UUID, FLOAT, INT) TO authenticated;

REVOKE ALL ON FUNCTION find_similar_recipes(UUID, UUID, FLOAT, INT) FROM public;
GRANT EXECUTE ON FUNCTION find_similar_recipes(UUID, UUID, FLOAT, INT) TO authenticated;

REVOKE ALL ON FUNCTION search_recipes_by_ingredients(TEXT[], UUID, FLOAT, INT) FROM public;
GRANT EXECUTE ON FUNCTION search_recipes_by_ingredients(TEXT[], UUID, FLOAT, INT) TO authenticated;

REVOKE ALL ON FUNCTION get_recipe_recommendations(UUID, VARCHAR(20), TEXT[], INT, INT) FROM public;
GRANT EXECUTE ON FUNCTION get_recipe_recommendations(UUID, VARCHAR(20), TEXT[], INT, INT) TO authenticated;
