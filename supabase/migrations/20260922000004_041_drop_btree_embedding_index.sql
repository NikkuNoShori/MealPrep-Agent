-- Drop idx_recipes_with_embeddings — a btree index on (user_id, embedding_vector).
--
-- A 1536-dim vector (6176 bytes) exceeds btree's 2704-byte row limit, so every
-- embedding write fails with "index row size 6176 exceeds btree version 4 maximum".
-- The index was left over from the 384-dim era and has never been usable with
-- 1536-dim vectors. Vector similarity search uses idx_recipes_embedding_l2 (ivfflat).
--
-- Safe to drop: no query path relies on a btree index over embedding_vector.

drop index if exists public.idx_recipes_with_embeddings;
