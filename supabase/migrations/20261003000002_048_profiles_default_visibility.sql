-- Migration 048: Add default_recipe_visibility preference to profiles
-- Allows users to set a default visibility for newly saved recipes.
-- Edge functions read this instead of hardcoding 'private'.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_recipe_visibility TEXT NOT NULL DEFAULT 'private'
  CHECK (default_recipe_visibility IN ('private', 'household', 'public'));
