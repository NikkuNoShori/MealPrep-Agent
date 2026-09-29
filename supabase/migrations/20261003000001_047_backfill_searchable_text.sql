-- Migration 047: Backfill searchable_text for recipes where null or empty
-- Recipes saved before migration 004 may have null searchable_text because the
-- trigger didn't fire retroactively. Without this, full-text search via
-- search_recipes_text RPC silently returns no results for those recipes.

UPDATE public.recipes
SET searchable_text = TRIM(CONCAT_WS(' ',
  NULLIF(TRIM(title), ''),
  NULLIF(TRIM(COALESCE(description, '')), ''),
  NULLIF(TRIM(COALESCE(source_url, '')), ''),
  NULLIF(ARRAY_TO_STRING(COALESCE(tags, ARRAY[]::text[]), ' '), '')
))
WHERE searchable_text IS NULL OR TRIM(searchable_text) = '';
