DROP TRIGGER IF EXISTS update_chat_messages_updated_at ON chat_messages;
DROP INDEX IF EXISTS idx_chat_messages_user_created;
DROP INDEX IF EXISTS idx_chat_messages_sender;
DROP INDEX IF EXISTS idx_chat_messages_created_at;
DROP INDEX IF EXISTS idx_chat_messages_user_id;
DROP INDEX IF EXISTS idx_chat_messages_session_id;
DROP TABLE IF EXISTS chat_messages;
