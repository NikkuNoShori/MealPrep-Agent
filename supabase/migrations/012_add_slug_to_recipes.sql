-- Migration: Add slug column to recipes table
-- This allows recipes to have SEO-friendly URLs like /recipes/chocolate-chip-cookies

-- Add slug column
ALTER TABLE recipes 
ADD COLUMN IF NOT EXISTS slug VARCHAR(255);

-- Create unique index on slug for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_recipes_slug ON recipes(slug);

-- Create index for slug lookups
CREATE INDEX IF NOT EXISTS idx_recipes_slug_lookup ON recipes(slug) WHERE slug IS NOT NULL;

-- Add comment to explain the column
COMMENT ON COLUMN recipes.slug IS 'URL-friendly slug generated from recipe title (e.g., "chocolate-chip-cookies" from "Chocolate Chip Cookies")';

-- Generate slugs for existing recipes
-- This will create slugs from existing titles
UPDATE recipes 
SET slug = LOWER(REGEXP_REPLACE(
  REGEXP_REPLACE(title, '[^a-zA-Z0-9\s-]', '', 'g'), -- Remove special characters
  '\s+', '-', 'g' -- Replace spaces with hyphens
))
WHERE slug IS NULL;

-- Handle duplicate slugs by appending numbers
DO $$
DECLARE
  recipe_record RECORD;
  counter INTEGER;
  new_slug VARCHAR(255);
BEGIN
  FOR recipe_record IN SELECT id, slug FROM recipes WHERE slug IS NOT NULL ORDER BY created_at LOOP
    counter := 1;
    new_slug := recipe_record.slug;
    
    WHILE EXISTS (SELECT 1 FROM recipes WHERE slug = new_slug AND id != recipe_record.id) LOOP
      counter := counter + 1;
      new_slug := recipe_record.slug || '-' || counter;
    END LOOP;
    
    IF new_slug != recipe_record.slug THEN
      UPDATE recipes SET slug = new_slug WHERE id = recipe_record.id;
    END IF;
  END LOOP;
END $$;

