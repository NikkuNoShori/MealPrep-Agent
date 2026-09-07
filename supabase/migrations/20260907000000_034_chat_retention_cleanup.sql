-- ============================================================================
-- Migration 034: Chat Retention Cleanup
--
-- Adds a soft retention policy for chat history:
--   - Conversations inactive for > 90 days are deleted
--   - chat_messages cascade automatically (ON DELETE CASCADE already set)
--   - Scheduled weekly via pg_cron (Sunday 03:00 UTC)
--
-- pg_cron must be enabled in the Supabase Dashboard (Extensions tab) before
-- the cron schedule takes effect. The cleanup function is always created;
-- the cron registration is wrapped so this migration succeeds even if
-- pg_cron is not yet enabled — just enable it and rerun the DO block, or
-- call cron.schedule() manually from the Dashboard SQL editor.
--
-- To adjust the retention window: change the INTERVAL in
-- purge_old_chat_conversations() below.
-- ============================================================================

-- ── Cleanup function ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION purge_old_chat_conversations()
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM chat_conversations
  WHERE
    -- Active conversations: last_message_at is set and older than 90 days
    (last_message_at IS NOT NULL AND last_message_at < NOW() - INTERVAL '90 days')
    OR
    -- Empty/never-used conversations: no messages, created > 90 days ago
    (last_message_at IS NULL AND created_at < NOW() - INTERVAL '90 days');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Log the result so it shows up in pg_cron job history
  RAISE NOTICE 'purge_old_chat_conversations: deleted % conversation(s)', deleted_count;
END;
$$;

COMMENT ON FUNCTION purge_old_chat_conversations() IS
  'Deletes chat_conversations (and their messages via CASCADE) inactive for >90 days. '
  'Scheduled weekly by pg_cron. Adjust INTERVAL to change retention window.';

-- ── pg_cron schedule ─────────────────────────────────────────────────────────
-- Runs every Sunday at 03:00 UTC. Wrapped in an exception block so the
-- migration succeeds even if pg_cron is not enabled yet.

DO $$
BEGIN
  -- Remove any pre-existing schedule with this name (idempotent)
  PERFORM cron.unschedule('purge-old-chat-conversations')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'purge-old-chat-conversations'
  );

  PERFORM cron.schedule(
    'purge-old-chat-conversations',  -- job name
    '0 3 * * 0',                     -- every Sunday 03:00 UTC
    'SELECT purge_old_chat_conversations()'
  );

  RAISE NOTICE 'pg_cron job "purge-old-chat-conversations" scheduled (weekly Sunday 03:00 UTC)';

EXCEPTION
  WHEN undefined_schema THEN
    RAISE NOTICE 'pg_cron not enabled — enable it in the Supabase Dashboard (Extensions) then run: SELECT cron.schedule(''purge-old-chat-conversations'', ''0 3 * * 0'', ''SELECT purge_old_chat_conversations()'');';
  WHEN undefined_function THEN
    RAISE NOTICE 'pg_cron not enabled — enable it in the Supabase Dashboard (Extensions) then run: SELECT cron.schedule(''purge-old-chat-conversations'', ''0 3 * * 0'', ''SELECT purge_old_chat_conversations()'');';
END $$;
