-- Migration 049: Return full recipe row from search_recipes_text
-- The migration 028 version only returned 6 columns (recipe_id, title,
-- description, ingredients, instructions, rank_score). The frontend
-- RecipeList renders server search results as full RecipeCard objects —
-- missing id, image_url, tags, prep_time, slug, created_at, etc. caused
-- blank/broken cards in the My Recipes feed. This replaces the function
-- to return all recipe columns plus rank_score.
--
-- PostgreSQL requires DROP + CREATE (not CREATE OR REPLACE) when the
-- RETURNS TABLE shape changes.

DROP FUNCTION IF EXISTS search_recipes_text(TEXT, UUID, INTEGER);

CREATE FUNCTION search_recipes_text(
    search_query TEXT,
    user_uuid UUID,  -- VESTIGIAL: ignored; auth.uid() is the source of truth
    max_results INTEGER DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    title VARCHAR(255),
    description TEXT,
    ingredients JSONB,
    instructions JSONB,
    prep_time INTEGER,
    cook_time INTEGER,
    total_time INTEGER,
    servings INTEGER,
    difficulty VARCHAR(20),
    cuisine VARCHAR(100),
    tags TEXT[],
    dietary_tags TEXT[],
    image_url TEXT,
    nutrition_info JSONB,
    source_url TEXT,
    source_name VARCHAR(100),
    is_public BOOLEAN,
    is_favorite BOOLEAN,
    slug VARCHAR(255),
    visibility TEXT,
    searchable_text TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
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
        r.is_public,
        r.is_favorite,
        r.slug,
        r.visibility,
        r.searchable_text,
        r.created_at,
        r.updated_at,
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

REVOKE ALL ON FUNCTION search_recipes_text(TEXT, UUID, INTEGER) FROM public;
GRANT EXECUTE ON FUNCTION search_recipes_text(TEXT, UUID, INTEGER) TO authenticated;
