-- Migration to create missing tables: recipe_embeddings, roles, user_roles
-- Run this after verifying which tables are missing

-- ============================================================================
-- STEP 1: Create recipe_embeddings table (for RAG/semantic search)
-- ============================================================================
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

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_recipe_embeddings_updated_at ON recipe_embeddings;
CREATE TRIGGER update_recipe_embeddings_updated_at 
    BEFORE UPDATE ON recipe_embeddings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 2: Create roles table (for role-based access control)
-- ============================================================================
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_roles_updated_at ON roles;
CREATE TRIGGER update_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default roles
INSERT INTO roles (name, description, permissions) VALUES
    ('admin', 'Administrator with full access', '{"all": true}'::jsonb),
    ('user', 'Standard user with basic access', '{"recipes": true, "meal_plans": true, "chat": true}'::jsonb),
    ('family_member', 'Family member with limited access', '{"recipes": true, "view_meal_plans": true}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- STEP 3: Create user_roles table (for role assignments)
-- ============================================================================
-- First ensure profiles table exists (it should, but check)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        CREATE TABLE IF NOT EXISTS user_roles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
            assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
            UNIQUE(user_id, role_id)
        );
        
        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
        
        -- Enable RLS
        ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
        
        -- Create RLS policies
        DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
        CREATE POLICY "Users can view their own roles" ON user_roles
            FOR SELECT USING (auth.uid() = user_id);
    ELSE
        RAISE EXCEPTION 'profiles table does not exist. Please run migration 011_restructure_auth_and_profiles.sql first.';
    END IF;
END $$;

-- ============================================================================
-- STEP 4: Add searchable_text column to recipes if missing (for text search)
-- ============================================================================
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS searchable_text TEXT;

CREATE INDEX IF NOT EXISTS idx_recipes_searchable_text 
ON recipes USING gin(to_tsvector('english', searchable_text));

-- Create or replace function to update searchable_text
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

-- Create trigger for searchable_text
DROP TRIGGER IF EXISTS update_recipe_searchable_text_trigger ON recipes;
CREATE TRIGGER update_recipe_searchable_text_trigger
    BEFORE INSERT OR UPDATE ON recipes
    FOR EACH ROW
    EXECUTE FUNCTION update_recipe_searchable_text();

-- ============================================================================
-- STEP 5: Create semantic search functions if missing
-- ============================================================================
-- Function: search_similar_recipes (vector similarity search)
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

-- Function: search_recipes_text (full-text search)
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
-- STEP 6: Verify tables were created
-- ============================================================================
DO $$
DECLARE
    missing_tables TEXT[] := ARRAY[]::TEXT[];
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recipe_embeddings') THEN
        missing_tables := array_append(missing_tables, 'recipe_embeddings');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'roles') THEN
        missing_tables := array_append(missing_tables, 'roles');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_roles') THEN
        missing_tables := array_append(missing_tables, 'user_roles');
    END IF;
    
    IF array_length(missing_tables, 1) > 0 THEN
        RAISE EXCEPTION 'Failed to create tables: %', array_to_string(missing_tables, ', ');
    ELSE
        RAISE NOTICE '✅ All missing tables created successfully!';
    END IF;
END $$;



