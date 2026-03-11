CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS recipe_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    embedding vector(384),
    text_content TEXT NOT NULL,
    embedding_type VARCHAR(50) DEFAULT 'recipe_content',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipe_embeddings_vector 
ON recipe_embeddings USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_recipe_embeddings_recipe_id ON recipe_embeddings(recipe_id);

CREATE INDEX IF NOT EXISTS idx_recipe_embeddings_type ON recipe_embeddings(embedding_type);

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS searchable_text TEXT;

CREATE INDEX IF NOT EXISTS idx_recipes_searchable_text 
ON recipes USING gin(to_tsvector('english', searchable_text));

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

CREATE OR REPLACE FUNCTION generate_recipe_embedding(recipe_uuid UUID)
RETURNS VOID AS $$
DECLARE
    recipe_record RECORD;
    searchable_text TEXT;
BEGIN
    SELECT * INTO recipe_record FROM recipes WHERE id = recipe_uuid;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Recipe with id % not found', recipe_uuid;
    END IF;
    
    searchable_text := COALESCE(recipe_record.searchable_text, '');
    
    DELETE FROM recipe_embeddings WHERE recipe_id = recipe_uuid;
    
END;
$$ LANGUAGE plpgsql;

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
        ts_rank(to_tsvector('english', r.searchable_text), plainto_tsquery('english', search_query)) as rank_score
    FROM recipes r
    WHERE r.user_id = user_uuid
    AND to_tsvector('english', r.searchable_text) @@ plainto_tsquery('english', search_query)
    ORDER BY rank_score DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;
