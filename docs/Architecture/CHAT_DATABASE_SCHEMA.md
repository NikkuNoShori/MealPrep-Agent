# Chat Database Schema Design

## Overview

This document outlines the database schema for storing chat conversations and messages using the **industry-standard two-table approach**, replacing the current localStorage-based approach.

## Design Decision: Two-Table Approach (Industry Standard)

We use **two separate tables** following industry best practices:

1. **`chat_conversations`** - One row per conversation (stores conversation metadata)
2. **`chat_messages`** - One row per message (stores individual messages)

**Benefits:**
- ✅ **Normalized**: No duplication of conversation metadata
- ✅ **Efficient**: Query conversations without loading all messages
- ✅ **Scalable**: Paginate messages independently
- ✅ **Maintainable**: Update conversation metadata in one place
- ✅ **Standard**: Matches common chat/messaging system patterns

## Schema Design

### Table 1: `chat_conversations`

Stores conversation-level metadata. One row per conversation.

```sql
CREATE TABLE IF NOT EXISTS chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Conversation metadata
    title VARCHAR(255) NOT NULL DEFAULT 'New Chat',
    session_id VARCHAR(255) NOT NULL, -- n8n session identifier for maintaining context
    selected_intent VARCHAR(50), -- 'recipe_extraction' or NULL for RAG queries
    
    -- Flexible metadata storage (JSONB for n8n context, RAG results, etc.)
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_message_at TIMESTAMP WITH TIME ZONE -- For sorting by recent activity
);
```

**Fields:**
- `id`: Unique conversation identifier (UUID)
- `user_id`: Owner of the conversation (required, references profiles)
- `title`: Conversation title (auto-generated from first message or user-set)
- `session_id`: n8n session identifier for maintaining context
- `selected_intent`: Manually selected intent ('recipe_extraction' or NULL)
- `metadata`: JSONB for flexible data (n8n context, RAG results, etc.)
- `last_message_at`: Timestamp of most recent message (auto-updated via trigger)

### Table 2: `chat_messages`

Stores individual messages. One row per message.

```sql
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    
    -- Message content
    content TEXT NOT NULL,
    sender VARCHAR(10) NOT NULL CHECK (sender IN ('user', 'ai')),
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'recipe', 'image', 'system')),
    
    -- Flexible metadata storage
    metadata JSONB DEFAULT '{}', -- Message-specific data (recipe extraction, RAG context, etc.)
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Fields:**
- `id`: Unique message identifier (UUID)
- `conversation_id`: Links to parent conversation (foreign key)
- `content`: Message text content
- `sender`: 'user' or 'ai'
- `message_type`: Type of message (text, recipe, image, system)
- `metadata`: JSONB for message-specific data (extracted recipes, RAG context, etc.)
- `created_at`: Message timestamp
- `updated_at`: Last update timestamp

## Indexes

### chat_conversations Indexes
- `idx_chat_conversations_user_id` - Fast lookup by user
- `idx_chat_conversations_session_id` - Fast lookup by n8n session
- `idx_chat_conversations_user_updated` - Sort by update time
- `idx_chat_conversations_user_last_message` - Sort by last message time

### chat_messages Indexes
- `idx_chat_messages_conversation_id` - Fast lookup by conversation
- `idx_chat_messages_created_at` - Sort by time
- `idx_chat_messages_sender` - Filter by sender
- `idx_chat_messages_conversation_created` - Get messages in order

## Automatic Updates

**Trigger**: `update_conversation_last_message_trigger`
- Automatically updates `chat_conversations.last_message_at` when a new message is inserted
- Ensures conversations are always sorted by most recent activity

## Query Patterns

### Get user's conversations (sorted by most recent)
```sql
SELECT 
    id,
    title,
    session_id,
    selected_intent,
    last_message_at,
    created_at,
    (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = chat_conversations.id) as message_count
FROM chat_conversations
WHERE user_id = $1
ORDER BY last_message_at DESC NULLS LAST, created_at DESC
LIMIT 50;
```

### Get messages for a conversation
```sql
SELECT 
    id,
    content,
    sender,
    message_type,
    metadata,
    created_at
FROM chat_messages
WHERE conversation_id = $1
ORDER BY created_at ASC;
```

### Get conversation with message count
```sql
SELECT 
    c.*,
    COUNT(m.id) as message_count
FROM chat_conversations c
LEFT JOIN chat_messages m ON m.conversation_id = c.id
WHERE c.user_id = $1
GROUP BY c.id
ORDER BY c.last_message_at DESC NULLS LAST;
```

## Metadata JSONB Structure

### Conversation Metadata Example
```json
{
  "n8nContext": {
    "workflowId": "...",
    "executionId": "..."
  },
  "ragContext": {
    "lastQuery": "find recipes with chicken",
    "lastResults": [...]
  }
}
```

### Message Metadata Example
```json
{
  "extractedRecipe": {
    "title": "Extracted Recipe",
    "ingredients": [...],
    "instructions": [...]
  },
  "ragContext": {
    "query": "find recipes with chicken",
    "results": [...]
  },
  "intent": "recipe_extraction"
}
```

## Row-Level Security (RLS)

Both tables have RLS enabled:

### chat_conversations RLS
- Users can only SELECT, INSERT, UPDATE, DELETE their own conversations

### chat_messages RLS
- Users can only access messages in conversations they own
- Policies check conversation ownership via EXISTS subquery

## Migration Strategy

1. ✅ Create both tables with proper indexes
2. ✅ Enable RLS policies
3. ✅ Add triggers for automatic updates
4. ⏳ Update ChatInterface to use database instead of localStorage
5. ⏳ Create/update API endpoints:
   - `GET /api/chat/conversations` - List user's conversations
   - `GET /api/chat/conversations/:id/messages` - Get messages for a conversation
   - `POST /api/chat/conversations` - Create new conversation
   - `POST /api/chat/conversations/:id/messages` - Add message to conversation
   - `PUT /api/chat/conversations/:id` - Update conversation (title, metadata)
   - `DELETE /api/chat/conversations/:id` - Delete conversation (cascades to messages)

## Benefits

1. **Normalized Design**: No data duplication
2. **Persistent Storage**: Conversations survive browser clears
3. **Multi-Device**: Access conversations from any device
4. **Scalable**: Can handle large conversation histories efficiently
5. **Queryable**: Can search, filter, and sort conversations
6. **Performance**: Indexed queries for fast retrieval
7. **Maintainable**: Clear separation of concerns
8. **Industry Standard**: Follows established patterns

## Future: Family Support

Family structure evaluation will be done after fixing the chat messages/history issue. The current schema can easily support adding `family_id` to `chat_conversations` for shared family conversations.
