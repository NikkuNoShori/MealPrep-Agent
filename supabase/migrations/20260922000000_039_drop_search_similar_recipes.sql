-- Migration 039: Drop orphan search_similar_recipes function
--
-- search_similar_recipes(vector(384), uuid, float, int) was defined in migration 004
-- using a 384-dim embedding against the recipe_embeddings table. That table has no
-- active write path — all current embeddings use 1536-dim on recipes.embedding_vector.
-- No production code calls this function (verified: no callers in supabase/functions/
-- or src/). The live equivalent is find_similar_recipes + search_recipes_semantic
-- (both converted to auth.uid() in migration 028).
--
-- Migration 026 added SET search_path = public to this function but intentionally
-- skipped the auth.uid() conversion (noted: "orphan per RAG_AUDIT — pending removal").
--
-- External integration check: no callers found in server.js or any script in the repo.
-- If an external caller (n8n, legacy script) depends on this, restoration is:
--   supabase/migrations/20251201000003_004_search_and_embeddings.sql lines 105-135.

drop function if exists public.search_similar_recipes(vector(384), uuid, float, integer);
