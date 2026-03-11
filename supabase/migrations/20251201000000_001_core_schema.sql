-- ============================================================================
-- Migration 001: Core Schema
-- Creates extensions, base tables, utility functions, and seed data.
-- Tables: profiles, family_members, recipes, meal_plans, user_preferences, ingredients
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- Utility function: update_updated_at_column
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Table: profiles
-- ============================================================================
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

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_family_id ON profiles(family_id);

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Table: family_members
-- ============================================================================
CREATE TABLE IF NOT EXISTS family_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_family_members_family_id ON family_members(family_id);

-- Validation trigger: ensure family_id exists in profiles
CREATE OR REPLACE FUNCTION validate_family_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM profiles WHERE family_id = NEW.family_id
    ) THEN
        RAISE EXCEPTION 'Family ID % does not exist in profiles', NEW.family_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_family_member_family_id
    BEFORE INSERT OR UPDATE ON family_members
    FOR EACH ROW
    EXECUTE FUNCTION validate_family_id();

CREATE TRIGGER update_family_members_updated_at
    BEFORE UPDATE ON family_members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Table: recipes
-- ============================================================================
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
    cuisine VARCHAR(100),
    tags TEXT[],
    dietary_tags TEXT[],
    image_url TEXT,
    rating DECIMAL(3,2),
    nutrition_info JSONB,
    source_url TEXT,
    source_name VARCHAR(100),
    is_public BOOLEAN DEFAULT false,
    is_favorite BOOLEAN DEFAULT false,
    slug VARCHAR(255),
    searchable_text TEXT,
    embedding_vector VECTOR(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_recipes_title ON recipes(title);
CREATE INDEX IF NOT EXISTS idx_recipes_difficulty ON recipes(difficulty);
CREATE INDEX IF NOT EXISTS idx_recipes_created_at ON recipes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recipes_tags ON recipes USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_recipes_cuisine ON recipes(cuisine);

CREATE TRIGGER update_recipes_updated_at
    BEFORE UPDATE ON recipes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Table: meal_plans
-- ============================================================================
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

CREATE INDEX IF NOT EXISTS idx_meal_plans_user_id ON meal_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_date_range ON meal_plans(start_date, end_date);

CREATE TRIGGER update_meal_plans_updated_at
    BEFORE UPDATE ON meal_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Table: user_preferences (slim — only measurement_system + timestamps)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    measurement_system VARCHAR(20) DEFAULT 'metric',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT measurement_system_check CHECK (measurement_system IN ('metric', 'imperial'))
);

COMMENT ON COLUMN user_preferences.measurement_system IS
    'User preference for measurement system: metric (g, kg, ml, l, C) or imperial (oz, lb, fl oz, cup, F)';

CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Table: ingredients (shared catalog)
-- ============================================================================
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

CREATE INDEX IF NOT EXISTS idx_ingredients_name ON ingredients(name);
CREATE INDEX IF NOT EXISTS idx_ingredients_category ON ingredients(category);

CREATE TRIGGER update_ingredients_updated_at
    BEFORE UPDATE ON ingredients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Seed data: common ingredients
-- ============================================================================
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
