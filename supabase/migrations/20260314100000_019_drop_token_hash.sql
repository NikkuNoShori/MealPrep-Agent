-- Migration 019: Drop token_hash from household_invites
-- ============================================================================
-- Switching to Supabase Auth inviteUserByEmail() for invite emails.
-- The custom token_hash column and index are no longer needed.
-- ============================================================================

DROP INDEX IF EXISTS idx_household_invites_token_hash;
ALTER TABLE household_invites DROP COLUMN IF EXISTS token_hash;
