CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS embedding_vector VECTOR(1536);

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS searchable_text TEXT;

CREATE OR REPLACE FUNCTION generate_recipe_searchable_text()
RETURNS TRIGGER AS $$
BEGIN
    NEW.searchable_text := 
        COALESCE(NEW.title, '') || ' ' ||
        COALESCE(NEW.description, '') || ' ' ||
        COALESCE(NEW.cuisine, '') || ' ' ||
        COALESCE(NEW.difficulty, '') || ' ' ||
        COALESCE(array_to_string(NEW.dietary_tags, ' '), '') || ' ' ||
        COALESCE(
            (SELECT string_agg(
                COALESCE(ingredient->>'item', '') || ' ' ||
                COALESCE(ingredient->>'notes', ''), ' '
            )
            FROM jsonb_array_elements(NEW.ingredients) AS ingredient), ''
        ) || ' ' ||
        COALESCE(
            (SELECT string_agg(instruction, ' ')
            FROM jsonb_array_elements(NEW.instructions) AS instruction), ''
        );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_recipe_searchable_text ON recipes;
CREATE TRIGGER update_recipe_searchable_text
    BEFORE INSERT OR UPDATE ON recipes
    FOR EACH ROW
    EXECUTE FUNCTION generate_recipe_searchable_text();

CREATE INDEX IF NOT EXISTS idx_recipes_embedding_vector 
ON recipes USING ivfflat (embedding_vector vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_recipes_searchable_text 
ON recipes USING gin(to_tsvector('english', searchable_text));

CREATE INDEX IF NOT EXISTS idx_recipes_user_embedding 
ON recipes(user_id, embedding_vector vector_cosine_ops);

CREATE TABLE IF NOT EXISTS recipe_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    parent_id UUID REFERENCES recipe_categories(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES recipe_categories(id);

CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category_id);

CREATE TABLE IF NOT EXISTS recipe_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    color VARCHAR(7) DEFAULT '#3B82F6',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipe_tag_relationships (
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES recipe_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (recipe_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_tag_recipe ON recipe_tag_relationships(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_tag_tag ON recipe_tag_relationships(tag_id);

CREATE TABLE IF NOT EXISTS recipe_search_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    results_count INTEGER DEFAULT 0,
    search_type VARCHAR(20) DEFAULT 'semantic',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_history_user ON recipe_search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_search_history_created ON recipe_search_history(created_at);

INSERT INTO recipe_categories (name, description) VALUES
('Breakfast', 'Morning meals and breakfast items'),
('Lunch', 'Midday meals and lunch options'),
('Dinner', 'Evening meals and dinner recipes'),
('Snacks', 'Light snacks and appetizers'),
('Desserts', 'Sweet treats and desserts'),
('Beverages', 'Drinks and beverages'),
('Soups & Stews', 'Liquid-based meals'),
('Salads', 'Fresh and mixed salads'),
('Main Courses', 'Primary dish recipes'),
('Side Dishes', 'Accompaniment recipes')
ON CONFLICT (name) DO NOTHING;

INSERT INTO recipe_tags (name, color) VALUES
('vegetarian', '#10B981'),
('vegan', '#059669'),
('gluten-free', '#F59E0B'),
('dairy-free', '#EF4444'),
('low-carb', '#8B5CF6'),
('high-protein', '#3B82F6'),
('quick', '#06B6D4'),
('easy', '#10B981'),
('healthy', '#059669'),
('comfort-food', '#F59E0B'),
('spicy', '#EF4444'),
('sweet', '#EC4899')
ON CONFLICT (name) DO NOTHING;
