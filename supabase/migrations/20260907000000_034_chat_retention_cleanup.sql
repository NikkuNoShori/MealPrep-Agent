-- ============================================================================
-- Migration 034: Chat Retention Cleanup
--
-- Adds a soft retention policy for chat history:
--   - Conversations inactive for > 90 days are deleted
--   - chat_messages cascade automatically (ON DELETE CASCADE already set)
--
-- CRON SETUP (manual — run in Supabase Dashboard SQL editor after enabling
-- pg_cron in Database → Extensions):
--
--   SELECT cron.schedule(
--     'purge-old-chat-conversations',
--     '0 3 * * 0',
--     'SELECT purge_old_chat_conversations()'
--   );
--
-- To adjust the retention window: change the INTERVAL below.
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
  'Call manually or schedule via pg_cron. Adjust INTERVAL to change retention window.';
