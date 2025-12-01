-- Enable pgcrypto extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;

-- Enable vector extension for embedding vectors
CREATE EXTENSION IF NOT EXISTS vector;

-- Create profiles table (migrated from users in later migration)
-- This table references auth.users(id) - migration 011 will ensure the FK is correct
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    first_name VARCHAR(255) DEFAULT '',
    last_name VARCHAR(255) DEFAULT '',
    avatar_url TEXT,
    timezone VARCHAR(50) DEFAULT 'UTC',
    household_size INTEGER DEFAULT 1,
    family_id UUID DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS family_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL, -- References profiles(family_id) - validated via trigger in migration 011
    name VARCHAR(255) NOT NULL,
    relationship VARCHAR(100),
    age INTEGER,
    dietary_restrictions TEXT[],
    allergies TEXT[],
    preferences JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    global_restrictions TEXT[],
    cuisine_preferences TEXT[],
    cooking_skill_level VARCHAR(20) DEFAULT 'intermediate',
    dietary_goals TEXT[],
    spice_tolerance VARCHAR(20) DEFAULT 'medium',
    meal_prep_preference VARCHAR(20) DEFAULT 'moderate',
    budget_range VARCHAR(20) DEFAULT 'medium',
    time_constraints JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    ingredients JSONB NOT NULL,
    instructions JSONB NOT NULL,
    prep_time INTEGER,
    cook_time INTEGER,
    total_time INTEGER,
    servings INTEGER DEFAULT 4,
    difficulty VARCHAR(20) DEFAULT 'medium',
    tags TEXT[],
    image_url TEXT,
    rating DECIMAL(3,2),
    nutrition_info JSONB,
    source_url TEXT,
    is_public BOOLEAN DEFAULT false,
    embedding_vector VECTOR(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Skip recipe_ratings creation - it already exists
-- Migration 011 will fix all foreign keys for existing tables including recipe_ratings

CREATE TABLE IF NOT EXISTS meal_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(255),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    meals JSONB NOT NULL,
    grocery_list JSONB,
    total_cost DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    content TEXT NOT NULL,
    sender VARCHAR(10) NOT NULL CHECK (sender IN ('user', 'ai')),
    message_type VARCHAR(20) DEFAULT 'text',
    context JSONB,
    recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    store_name VARCHAR(255),
    store_info JSONB,
    raw_ocr_text TEXT,
    processed_items JSONB,
    total_amount DECIMAL(10,2),
    receipt_date DATE,
    processing_status VARCHAR(20) DEFAULT 'pending',
    confidence_score DECIMAL(3,2),
    user_corrections JSONB,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    category VARCHAR(100),
    subcategory VARCHAR(100),
    common_names TEXT[],
    nutrition_info JSONB,
    typical_unit VARCHAR(50),
    typical_price DECIMAL(10,2),
    is_common BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL,
    ingredient_name VARCHAR(255) NOT NULL,
    quantity DECIMAL(10,3),
    unit VARCHAR(50),
    expiration_date DATE,
    location VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Skip shopping_lists if it exists - migration 011 will fix foreign keys
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'shopping_lists'
    ) THEN
        CREATE TABLE shopping_lists (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL,
            meal_plan_id UUID,
            title VARCHAR(255),
            items JSONB NOT NULL,
            store_preference VARCHAR(255),
            estimated_cost DECIMAL(10,2),
            status VARCHAR(20) DEFAULT 'active',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        -- Foreign keys will be added/fixed by migration 011
        -- Skip adding them here to avoid conflicts with existing tables
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_family_id ON profiles(family_id);
CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_recipes_created_at ON recipes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recipes_tags ON recipes USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_meal_plans_user_id ON meal_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_date_range ON meal_plans(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(receipt_date);
CREATE INDEX IF NOT EXISTS idx_ingredients_name ON ingredients(name);
CREATE INDEX IF NOT EXISTS idx_ingredients_category ON ingredients(category);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_family_members_updated_at BEFORE UPDATE ON family_members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_recipes_updated_at BEFORE UPDATE ON recipes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_meal_plans_updated_at BEFORE UPDATE ON meal_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_receipts_updated_at BEFORE UPDATE ON receipts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ingredients_updated_at BEFORE UPDATE ON ingredients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_ingredients_updated_at BEFORE UPDATE ON user_ingredients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shopping_lists_updated_at BEFORE UPDATE ON shopping_lists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO ingredients (name, category, subcategory, common_names, is_common) VALUES
('Chicken Breast', 'Meat', 'Poultry', ARRAY['chicken', 'breast', 'chicken breast'], true),
('Ground Beef', 'Meat', 'Beef', ARRAY['beef', 'ground beef', 'hamburger meat'], true),
('Onion', 'Produce', 'Vegetables', ARRAY['onion', 'yellow onion', 'white onion'], true),
('Garlic', 'Produce', 'Vegetables', ARRAY['garlic', 'garlic clove'], true),
('Olive Oil', 'Pantry', 'Oils', ARRAY['olive oil', 'extra virgin olive oil'], true),
('Salt', 'Pantry', 'Seasonings', ARRAY['salt', 'table salt', 'sea salt'], true),
('Black Pepper', 'Pantry', 'Seasonings', ARRAY['pepper', 'black pepper', 'ground pepper'], true),
('Tomato', 'Produce', 'Vegetables', ARRAY['tomato', 'tomatoes'], true),
('Rice', 'Pantry', 'Grains', ARRAY['rice', 'white rice', 'brown rice'], true),
('Pasta', 'Pantry', 'Grains', ARRAY['pasta', 'spaghetti', 'penne'], true)
ON CONFLICT (name) DO NOTHING;
