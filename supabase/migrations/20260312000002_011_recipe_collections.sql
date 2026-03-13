-- ============================================================================
-- Migration 011: Recipe Collections
--
-- Adds recipe_collections and collection_recipes tables for organizing
-- recipes into shareable folders. Collections carry their own visibility
-- (private/household/public) independent of individual recipe visibility.
--
-- Part of MOP-0002 P1: Family Sharing, Recipe Permissions & Collections
-- ============================================================================

-- ============================================================================
-- 1. TABLES
-- ============================================================================

CREATE TABLE recipe_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'household', 'public')),
  icon TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE TABLE collection_recipes (
  collection_id UUID NOT NULL REFERENCES recipe_collections(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT now(),
  sort_order INT DEFAULT 0,
  PRIMARY KEY (collection_id, recipe_id)
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

CREATE INDEX idx_recipe_collections_user_id ON recipe_collections(user_id);
CREATE INDEX idx_collection_recipes_recipe_id ON collection_recipes(recipe_id);

-- ============================================================================
-- 3. UPDATED_AT TRIGGER
-- ============================================================================

CREATE TRIGGER update_recipe_collections_updated_at
  BEFORE UPDATE ON recipe_collections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================

ALTER TABLE recipe_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_recipes ENABLE ROW LEVEL SECURITY;

-- recipe_collections: owner can see own, household members can see household,
-- everyone can see public
CREATE POLICY "Users can view accessible collections" ON recipe_collections
  FOR SELECT USING (
    auth.uid() = user_id
    OR (visibility = 'household' AND EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.user_id = recipe_collections.user_id
      AND is_household_member(hm.household_id, auth.uid())
    ))
    OR visibility = 'public'
  );

CREATE POLICY "Users can create own collections" ON recipe_collections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own collections" ON recipe_collections
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own collections" ON recipe_collections
  FOR DELETE USING (auth.uid() = user_id);

-- collection_recipes: viewable if the parent collection is viewable
-- (relies on collection SELECT policy for access control)
CREATE POLICY "Users can view recipes in accessible collections" ON collection_recipes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM recipe_collections rc
      WHERE rc.id = collection_recipes.collection_id
    )
  );

-- Only the collection owner can add/remove recipes
CREATE POLICY "Collection owners can add recipes" ON collection_recipes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM recipe_collections rc
      WHERE rc.id = collection_recipes.collection_id
      AND rc.user_id = auth.uid()
    )
  );

CREATE POLICY "Collection owners can remove recipes" ON collection_recipes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM recipe_collections rc
      WHERE rc.id = collection_recipes.collection_id
      AND rc.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 5. DEFAULT COLLECTIONS ON NEW USER SIGNUP
-- ============================================================================

-- Update handle_new_user() to also create default collections
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_family_id UUID;
  new_household_id UUID;
BEGIN
  new_family_id := gen_random_uuid();
  new_household_id := gen_random_uuid();

  INSERT INTO profiles (id, email, display_name, family_id, household_size)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    new_family_id,
    1
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = COALESCE(NULLIF(profiles.display_name, ''), EXCLUDED.display_name);

  -- Create default household
  INSERT INTO households (id, name, created_by)
  VALUES (new_household_id, 'My Household', NEW.id);

  INSERT INTO household_members (household_id, user_id, role)
  VALUES (new_household_id, NEW.id, 'owner');

  -- Create default collections
  INSERT INTO recipe_collections (user_id, name, icon, sort_order)
  VALUES
    (NEW.id, 'Favorites', 'heart', 0),
    (NEW.id, 'My Recipes', 'book', 1);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
