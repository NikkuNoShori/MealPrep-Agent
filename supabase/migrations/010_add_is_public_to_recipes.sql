-- Migration: Add is_public column to recipes table
-- This allows users to make their recipes publicly visible to other users

-- Add is_public column
ALTER TABLE recipes 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- Create index for public recipe queries
CREATE INDEX IF NOT EXISTS idx_recipes_is_public ON recipes(is_public) WHERE is_public = true;

-- Add comment to explain the column
COMMENT ON COLUMN recipes.is_public IS 'If true, this recipe is visible to all users. If false, only the recipe owner can view it.';

