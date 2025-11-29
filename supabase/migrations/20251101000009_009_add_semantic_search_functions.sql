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
    prep_time VARCHAR(50),
    cook_time VARCHAR(50),
    servings INTEGER,
    difficulty VARCHAR(20),
    cuisine VARCHAR(100),
    dietary_tags TEXT[],
    source_url VARCHAR(500),
    source_name VARCHAR(100),
    rating DECIMAL(3,2),
    is_favorite BOOLEAN,
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
        r.cuisine,
        r.dietary_tags,
        r.source_url,
        r.source_name,
        r.rating,
        r.is_favorite,
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
    prep_time VARCHAR(50),
    cook_time VARCHAR(50),
    servings INTEGER,
    difficulty VARCHAR(20),
    cuisine VARCHAR(100),
    dietary_tags TEXT[],
    source_url VARCHAR(500),
    source_name VARCHAR(100),
    rating DECIMAL(3,2),
    is_favorite BOOLEAN,
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
    WHERE id = recipe_id AND user_id = find_similar_recipes.user_id;
    
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
        r.cuisine,
        r.dietary_tags,
        r.source_url,
        r.source_name,
        r.rating,
        r.is_favorite,
        r.created_at,
        r.updated_at,
        r.searchable_text,
        1 - (r.embedding_vector <=> target_embedding) AS similarity_score
    FROM recipes r
    WHERE r.user_id = find_similar_recipes.user_id
        AND r.id != recipe_id
        AND r.embedding_vector IS NOT NULL
        AND 1 - (r.embedding_vector <=> target_embedding) > similarity_threshold
    ORDER BY r.embedding_vector <=> target_embedding
    LIMIT max_results;
END;
$$;

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
    prep_time VARCHAR(50),
    cook_time VARCHAR(50),
    servings INTEGER,
    difficulty VARCHAR(20),
    cuisine VARCHAR(100),
    dietary_tags TEXT[],
    source_url VARCHAR(500),
    source_name VARCHAR(100),
    rating DECIMAL(3,2),
    is_favorite BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    searchable_text TEXT,
    ingredient_match_score FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
    ingredient_query TEXT;
    query_embedding VECTOR(1536);
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
        r.cuisine,
        r.dietary_tags,
        r.source_url,
        r.source_name,
        r.rating,
        r.is_favorite,
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

CREATE OR REPLACE FUNCTION get_recipe_recommendations(
    user_id UUID,
    preference_difficulty VARCHAR(20) DEFAULT NULL,
    preference_cuisine VARCHAR(100) DEFAULT NULL,
    preference_dietary_tags TEXT[] DEFAULT NULL,
    max_prep_time_minutes INT DEFAULT NULL,
    limit_count INT DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    title VARCHAR(255),
    description TEXT,
    ingredients JSONB,
    instructions JSONB,
    prep_time VARCHAR(50),
    cook_time VARCHAR(50),
    servings INTEGER,
    difficulty VARCHAR(20),
    cuisine VARCHAR(100),
    dietary_tags TEXT[],
    source_url VARCHAR(500),
    source_name VARCHAR(100),
    rating DECIMAL(3,2),
    is_favorite BOOLEAN,
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
        r.cuisine,
        r.dietary_tags,
        r.source_url,
        r.source_name,
        r.rating,
        r.is_favorite,
        r.created_at,
        r.updated_at,
        r.searchable_text,
        (
            CASE WHEN preference_difficulty IS NULL OR r.difficulty = preference_difficulty THEN 1.0 ELSE 0.5 END +
            CASE WHEN preference_cuisine IS NULL OR r.cuisine = preference_cuisine THEN 1.0 ELSE 0.5 END +
            CASE WHEN preference_dietary_tags IS NULL OR r.dietary_tags && preference_dietary_tags THEN 1.0 ELSE 0.5 END +
            CASE WHEN r.rating IS NOT NULL THEN r.rating / 5.0 ELSE 0.5 END +
            CASE WHEN r.is_favorite THEN 0.5 ELSE 0.0 END
        ) / 5.0 AS recommendation_score
    FROM recipes r
    WHERE r.user_id = get_recipe_recommendations.user_id
        AND (preference_difficulty IS NULL OR r.difficulty = preference_difficulty)
        AND (preference_cuisine IS NULL OR r.cuisine = preference_cuisine)
        AND (preference_dietary_tags IS NULL OR r.dietary_tags && preference_dietary_tags)
    ORDER BY recommendation_score DESC, r.created_at DESC
    LIMIT limit_count;
END;
$$;

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
          OLD.cuisine IS DISTINCT FROM NEW.cuisine OR
          OLD.dietary_tags IS DISTINCT FROM NEW.dietary_tags)
    EXECUTE FUNCTION update_recipe_embedding();

CREATE INDEX IF NOT EXISTS idx_recipes_embedding_cosine 
ON recipes USING ivfflat (embedding_vector vector_cosine_ops) 
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_recipes_embedding_l2 
ON recipes USING ivfflat (embedding_vector vector_l2_ops) 
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_recipes_with_embeddings 
ON recipes (user_id, embedding_vector) 
WHERE embedding_vector IS NOT NULL;
