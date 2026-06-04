-- ============================================================================
-- Migration 029: Embedding Refresh Lifecycle
-- ============================================================================
-- MOP-0015 Phase 1 + 3
--
-- Before this migration, the `update_recipe_embedding` trigger (migration 004)
-- NULLed `recipes.embedding_vector` on edit. Nothing re-populated it. Result:
-- every recipe a user has ever edited has a null vector and is invisible to
-- semantic search.
--
-- This migration:
--   1. Adds a `needs_reembed BOOLEAN` flag column
--   2. Replaces the trigger function to set the flag instead of nulling
--   3. Indexes the flag for the refresh job's WHERE scan
--   4. Backfills: marks all existing null-embedding rows as needs_reembed=true
--      so the Phase 2 edge function picks them up
--
-- The Phase 2 async re-embed edge function (supabase/functions/embedding-refresh)
-- consumes the flag. See MOP-0015.md for the runbook.
--
-- HARD RULE: This file is authored locally. Nick deploys.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Step 1: Add the flag column
-- ----------------------------------------------------------------------------
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS needs_reembed BOOLEAN NOT NULL DEFAULT false;

-- ----------------------------------------------------------------------------
-- Step 2: Replace the trigger function
-- ----------------------------------------------------------------------------
-- Original (migration 004:68-85) set `embedding_vector := NULL` on edit, which
-- created the silent-degradation pathology. Replacement flags the row for
-- refresh while leaving the stale vector queryable in the meantime.
--
-- Trigger DEFINITION (lines 76-85 of migration 004) is unchanged — only the
-- function body changes. The WHEN clause (which fires on title / description /
-- ingredients / instructions / tags changes) is reused as-is.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_recipe_embedding()
RETURNS TRIGGER AS $$
BEGIN
    -- MOP-0015: flag for async refresh instead of nulling the vector.
    -- The stale vector remains queryable until the refresh job replaces it,
    -- which strictly improves over the previous "vector disappears on edit"
    -- behavior.
    NEW.needs_reembed := true;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- ----------------------------------------------------------------------------
-- Step 3: Index for the refresh job
-- ----------------------------------------------------------------------------
-- Partial index because needs_reembed = true is the only state the refresh
-- job scans for. Tiny index that grows only with pending work.
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_recipes_needs_reembed
    ON recipes (needs_reembed)
    WHERE needs_reembed = true;

-- ----------------------------------------------------------------------------
-- Step 4: One-time backfill — mark existing null vectors as needing reembed
-- ----------------------------------------------------------------------------
-- Idempotent: re-running this statement is harmless. It only flips rows from
-- false → true for existing null-vector rows. After the Phase 2 job catches
-- them up, they'll flip back to false with the new embedding populated.
-- ----------------------------------------------------------------------------
UPDATE recipes SET needs_reembed = true WHERE embedding_vector IS NULL;
