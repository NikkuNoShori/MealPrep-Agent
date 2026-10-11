-- Migration 050: Fix search/recommendation RPCs referencing dropped is_public column
--
-- Migration 013 dropped recipes.is_public (superseded by the `visibility`
-- text column from migration 009). Five RPCs were never updated and still
-- reference r.is_public in their RETURNS TABLE / SELECT list:
--   - search_recipes_text        (migration 049's full-row version)
--   - search_recipes_semantic    (migration 028)
--   - find_similar_recipes       (migration 028)
--   - search_recipes_by_ingredients (migration 028)
--   - get_recipe_recommendations (migration 035, latest version)
--
-- Because PL/pgSQL only resolves column references when the function runs
-- (not at CREATE time), all five migrations applied cleanly and only failed
-- at call time with "column r.is_public does not exist" — this went
-- undetected until an adversarial review surfaced it (MOP-0032 closeout).
--
-- search_recipes_text already has a `visibility` column in its RETURNS TABLE,
-- so dropping `is_public` changes the shape and requires DROP + CREATE. The
-- other four never had `visibility` in their shape; they are fixed in place
-- by replacing the is_public column with visibility (CREATE OR REPLACE is
-- sufficient since the shape only substitutes one column for another of a
-- different type — still requires DROP+CREATE since BOOLEAN != TEXT).
--
-- HARD RULE: authored locally — Nick deploys.

-- ----------------------------------------------------------------------------
-- search_recipes_text (already has `visibility`; just drop dangling is_public)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- search_recipes_semantic — swap is_public BOOLEAN for visibility TEXT
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS search_recipes_semantic(VECTOR(1536), UUID, FLOAT, INT);

CREATE FUNCTION search_recipes_semantic(
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
    visibility TEXT,
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
        r.visibility,
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

REVOKE ALL ON FUNCTION search_recipes_semantic(VECTOR(1536), UUID, FLOAT, INT) FROM public;
GRANT EXECUTE ON FUNCTION search_recipes_semantic(VECTOR(1536), UUID, FLOAT, INT) TO authenticated;

-- ----------------------------------------------------------------------------
-- find_similar_recipes — swap is_public BOOLEAN for visibility TEXT
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS find_similar_recipes(UUID, UUID, FLOAT, INT);

CREATE FUNCTION find_similar_recipes(
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
    visibility TEXT,
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
        r.visibility,
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

REVOKE ALL ON FUNCTION find_similar_recipes(UUID, UUID, FLOAT, INT) FROM public;
GRANT EXECUTE ON FUNCTION find_similar_recipes(UUID, UUID, FLOAT, INT) TO authenticated;

-- ----------------------------------------------------------------------------
-- search_recipes_by_ingredients — swap is_public BOOLEAN for visibility TEXT
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS search_recipes_by_ingredients(TEXT[], UUID, FLOAT, INT);

CREATE FUNCTION search_recipes_by_ingredients(
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
    visibility TEXT,
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
        r.visibility,
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

REVOKE ALL ON FUNCTION search_recipes_by_ingredients(TEXT[], UUID, FLOAT, INT) FROM public;
GRANT EXECUTE ON FUNCTION search_recipes_by_ingredients(TEXT[], UUID, FLOAT, INT) TO authenticated;

-- ----------------------------------------------------------------------------
-- get_recipe_recommendations — swap is_public BOOLEAN for visibility TEXT
-- (keeps migration 035's 5-term reaction-aware scoring formula unchanged)
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_recipe_recommendations(UUID, VARCHAR(20), TEXT[], INT, INT);

CREATE FUNCTION get_recipe_recommendations(
    user_id UUID,               -- VESTIGIAL: ignored; auth.uid() is the source of truth
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
    visibility TEXT,
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
        r.visibility,
        r.created_at,
        r.updated_at,
        r.searchable_text,
        -- 5-term score, each term ∈ [0, 1], averaged to keep total ∈ [0, 1]
        (
            -- Term 1: difficulty match
            CASE WHEN preference_difficulty IS NULL OR r.difficulty = preference_difficulty
                 THEN 1.0 ELSE 0.5 END

            -- Term 2: tag overlap
            + CASE WHEN preference_tags IS NULL OR r.tags && preference_tags
                   THEN 1.0 ELSE 0.5 END

            -- Term 3: rating (0–5 scaled to 0–1; no rating = neutral 0.5)
            + CASE WHEN r.rating IS NOT NULL THEN r.rating / 5.0 ELSE 0.5 END

            -- Term 4: prep time fit
            + CASE WHEN (max_prep_time_minutes IS NULL
                         OR r.prep_time IS NULL
                         OR r.prep_time <= max_prep_time_minutes)
                   THEN 1.0 ELSE 0.3 END

            -- Term 5: reaction signal
            -- thumbs_up = +1.0, thumbs_down = -0.7, none = 0
            -- Net signal averaged across all reactions on this recipe,
            -- then mapped from [-1, 1] to [0, 1] with a clamp.
            -- No reactions → 0.5 (neutral).
            + COALESCE((
                SELECT LEAST(GREATEST(
                    (AVG(
                        CASE rr.reaction_type
                            WHEN 'thumbs_up'   THEN  1.0
                            WHEN 'thumbs_down' THEN -0.7
                            ELSE 0.0
                        END
                    ) + 1.0) / 2.0,
                0.0), 1.0)
                FROM recipe_reactions rr
                WHERE rr.recipe_id = r.id
            ), 0.5)
        ) / 5.0 AS recommendation_score
    FROM recipes r
    WHERE r.user_id = v_caller
        AND (preference_difficulty IS NULL OR r.difficulty = preference_difficulty)
        AND (preference_tags IS NULL OR r.tags && preference_tags)
        AND (max_prep_time_minutes IS NULL OR r.prep_time IS NULL OR r.prep_time <= max_prep_time_minutes)
    ORDER BY recommendation_score DESC, r.created_at DESC
    LIMIT limit_count;
END;
$$;

REVOKE ALL ON FUNCTION get_recipe_recommendations(UUID, VARCHAR(20), TEXT[], INT, INT) FROM public;
GRANT EXECUTE ON FUNCTION get_recipe_recommendations(UUID, VARCHAR(20), TEXT[], INT, INT) TO authenticated;
