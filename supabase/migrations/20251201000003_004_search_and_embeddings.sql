-- ============================================================================
-- Migration 004: Search & Embeddings
-- Creates recipe_embeddings table, searchable_text trigger, vector/text search
-- functions, and IVFFlat/GIN indexes.
-- ============================================================================

-- ============================================================================
-- Table: recipe_embeddings (384-dim for smaller embedding models)
-- ============================================================================
CREATE TABLE IF NOT EXISTS recipe_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    embedding vector(384),
    text_content TEXT NOT NULL,
    embedding_type VARCHAR(50) DEFAULT 'recipe_content',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipe_embeddings_recipe_id ON recipe_embeddings(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_embeddings_type ON recipe_embeddings(embedding_type);
CREATE INDEX IF NOT EXISTS idx_recipe_embeddings_vector
    ON recipe_embeddings USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE TRIGGER update_recipe_embeddings_updated_at
    BEFORE UPDATE ON recipe_embeddings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Trigger: auto-populate searchable_text on recipes
-- ============================================================================
CREATE OR REPLACE FUNCTION update_recipe_searchable_text()
RETURNS TRIGGER AS $$
BEGIN
    NEW.searchable_text = COALESCE(NEW.title, '') || ' ' ||
                         COALESCE(NEW.description, '') || ' ' ||
                         COALESCE(NEW.difficulty, '') || ' ' ||
                         COALESCE(array_to_string(NEW.tags, ' '), '') || ' ' ||
                         COALESCE(
                             (SELECT string_agg(value::text, ' ')
                              FROM jsonb_array_elements_text(NEW.ingredients)),
                             ''
                         ) || ' ' ||
                         COALESCE(
                             (SELECT string_agg(value::text, ' ')
                              FROM jsonb_array_elements_text(NEW.instructions)),
                             ''
                         );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_recipe_searchable_text_trigger ON recipes;
CREATE TRIGGER update_recipe_searchable_text_trigger
    BEFORE INSERT OR UPDATE ON recipes
    FOR EACH ROW
    EXECUTE FUNCTION update_recipe_searchable_text();

-- GIN index for full-text search on searchable_text
CREATE INDEX IF NOT EXISTS idx_recipes_searchable_text
    ON recipes USING gin(to_tsvector('english', searchable_text));

-- ============================================================================
-- Trigger: clear embedding when recipe content changes
-- ============================================================================
CREATE OR REPLACE FUNCTION update_recipe_embedding()
RETURNS TRIGGER AS $$
BEGIN
    NEW.embedding_vector := NULL;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_recipe_embedding ON recipes;
CREATE TRIGGER trigger_update_recipe_embedding
    BEFORE UPDATE ON recipes
    FOR EACH ROW
    WHEN (OLD.title IS DISTINCT FROM NEW.title OR
          OLD.description IS DISTINCT FROM NEW.description OR
          OLD.ingredients IS DISTINCT FROM NEW.ingredients OR
          OLD.instructions IS DISTINCT FROM NEW.instructions OR
          OLD.tags IS DISTINCT FROM NEW.tags)
    EXECUTE FUNCTION update_recipe_embedding();

-- ============================================================================
-- IVFFlat indexes on recipes.embedding_vector (1536-dim)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_recipes_embedding_cosine
    ON recipes USING ivfflat (embedding_vector vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_recipes_embedding_l2
    ON recipes USING ivfflat (embedding_vector vector_l2_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_recipes_with_embeddings
    ON recipes (user_id, embedding_vector)
    WHERE embedding_vector IS NOT NULL;

-- ============================================================================
-- Function: search_similar_recipes (384-dim via recipe_embeddings table)
-- ============================================================================
CREATE OR REPLACE FUNCTION search_similar_recipes(
    query_embedding vector(384),
    user_uuid UUID,
    similarity_threshold FLOAT DEFAULT 0.7,
    max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
    recipe_id UUID,
    title VARCHAR(255),
    description TEXT,
    ingredients JSONB,
    instructions JSONB,
    similarity_score FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id,
        r.title,
        r.description,
        r.ingredients,
        r.instructions,
        1 - (re.embedding <=> query_embedding) as similarity_score
    FROM recipe_embeddings re
    JOIN recipes r ON re.recipe_id = r.id
    WHERE r.user_id = user_uuid
    AND 1 - (re.embedding <=> query_embedding) > similarity_threshold
    ORDER BY re.embedding <=> query_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Function: search_recipes_text (full-text search)
-- ============================================================================
CREATE OR REPLACE FUNCTION search_recipes_text(
    search_query TEXT,
    user_uuid UUID,
    max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
    recipe_id UUID,
    title VARCHAR(255),
    description TEXT,
    ingredients JSONB,
    instructions JSONB,
    rank_score FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id,
        r.title,
        r.description,
        r.ingredients,
        r.instructions,
        ts_rank(to_tsvector('english', COALESCE(r.searchable_text, '')), plainto_tsquery('english', search_query)) as rank_score
    FROM recipes r
    WHERE r.user_id = user_uuid
    AND to_tsvector('english', COALESCE(r.searchable_text, '')) @@ plainto_tsquery('english', search_query)
    ORDER BY rank_score DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Function: search_recipes_semantic (1536-dim via recipes.embedding_vector)
-- ============================================================================
CREATE OR REPLACE FUNCTION search_recipes_semantic(
    query_embedding VECTOR(1536),
    user_id UUID,
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
AS $$
BEGIN
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
    WHERE r.user_id = search_recipes_semantic.user_id
        AND r.embedding_vector IS NOT NULL
        AND 1 - (r.embedding_vector <=> query_embedding) > match_threshold
    ORDER BY r.embedding_vector <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ============================================================================
-- Function: find_similar_recipes (1536-dim, find recipes similar to a given one)
-- ============================================================================
CREATE OR REPLACE FUNCTION find_similar_recipes(
    recipe_id UUID,
    user_id UUID,
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
AS $$
DECLARE
    target_embedding VECTOR(1536);
BEGIN
    SELECT embedding_vector INTO target_embedding
    FROM recipes
    WHERE recipes.id = find_similar_recipes.recipe_id
      AND recipes.user_id = find_similar_recipes.user_id;

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
    WHERE r.user_id = find_similar_recipes.user_id
        AND r.id != find_similar_recipes.recipe_id
        AND r.embedding_vector IS NOT NULL
        AND 1 - (r.embedding_vector <=> target_embedding) > similarity_threshold
    ORDER BY r.embedding_vector <=> target_embedding
    LIMIT max_results;
END;
$$;

-- ============================================================================
-- Function: search_recipes_by_ingredients (text-based ingredient matching)
-- ============================================================================
CREATE OR REPLACE FUNCTION search_recipes_by_ingredients(
    ingredient_list TEXT[],
    user_id UUID,
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
AS $$
DECLARE
    ingredient_query TEXT;
BEGIN
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
        ts_rank(to_tsvector('english', r.searchable_text),
                plainto_tsquery('english', ingredient_query)) AS ingredient_match_score
    FROM recipes r
    WHERE r.user_id = search_recipes_by_ingredients.user_id
        AND to_tsvector('english', r.searchable_text) @@ plainto_tsquery('english', ingredient_query)
    ORDER BY ingredient_match_score DESC
    LIMIT match_count;
END;
$$;

-- ============================================================================
-- Function: get_recipe_recommendations (scoring-based recommendations)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_recipe_recommendations(
    user_id UUID,
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
AS $$
BEGIN
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
    WHERE r.user_id = get_recipe_recommendations.user_id
        AND (preference_difficulty IS NULL OR r.difficulty = preference_difficulty)
        AND (preference_tags IS NULL OR r.tags && preference_tags)
        AND (max_prep_time_minutes IS NULL OR r.prep_time IS NULL OR r.prep_time <= max_prep_time_minutes)
    ORDER BY recommendation_score DESC, r.created_at DESC
    LIMIT limit_count;
END;
$$;

-- ============================================================================
-- RLS for recipe_embeddings
-- ============================================================================
ALTER TABLE recipe_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view embeddings for their recipes" ON recipe_embeddings;
CREATE POLICY "Users can view embeddings for their recipes" ON recipe_embeddings
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM recipes WHERE recipes.id = recipe_embeddings.recipe_id AND recipes.user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can insert embeddings for their recipes" ON recipe_embeddings;
CREATE POLICY "Users can insert embeddings for their recipes" ON recipe_embeddings
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM recipes WHERE recipes.id = recipe_embeddings.recipe_id AND recipes.user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can update embeddings for their recipes" ON recipe_embeddings;
CREATE POLICY "Users can update embeddings for their recipes" ON recipe_embeddings
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM recipes WHERE recipes.id = recipe_embeddings.recipe_id AND recipes.user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can delete embeddings for their recipes" ON recipe_embeddings;
CREATE POLICY "Users can delete embeddings for their recipes" ON recipe_embeddings
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM recipes WHERE recipes.id = recipe_embeddings.recipe_id AND recipes.user_id = auth.uid())
    );
