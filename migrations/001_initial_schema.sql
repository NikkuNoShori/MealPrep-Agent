CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    neon_user_id VARCHAR(255) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    family_id UUID DEFAULT uuid_generate_v4(),
    household_size INTEGER DEFAULT 1,
    avatar_url TEXT,
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS family_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES users(family_id) ON DELETE CASCADE,
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS recipe_ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(recipe_id, user_id, family_member_id)
);

CREATE TABLE IF NOT EXISTS meal_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    content TEXT NOT NULL,
    sender VARCHAR(10) NOT NULL CHECK (sender IN ('user', 'ai')),
    message_type VARCHAR(20) DEFAULT 'text',
    context JSONB,
    recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS shopping_lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    meal_plan_id UUID REFERENCES meal_plans(id) ON DELETE SET NULL,
    title VARCHAR(255),
    items JSONB NOT NULL,
    store_preference VARCHAR(255),
    estimated_cost DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_neon_user_id ON users(neon_user_id);
CREATE INDEX IF NOT EXISTS idx_users_family_id ON users(family_id);
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

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
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
