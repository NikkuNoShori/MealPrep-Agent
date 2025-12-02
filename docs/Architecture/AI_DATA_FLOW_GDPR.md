# AI Data Flow & GDPR Compliance Analysis

## Overview

This document outlines all ways the AI interacts with user data, data flows, storage, and GDPR compliance considerations for the MealPrep Agent application.

---

## Data Flow Architecture

### 1. **User Input → Edge Function → OpenRouter API**

**What Data is Sent to OpenRouter:**

#### Intent Detection
- **User Message**: Full text content of user's message
- **Images**: Base64-encoded images (if provided, up to 4 images)
- **System Prompt**: Intent classification instructions (no user data)
- **Headers Sent**:
  - `HTTP-Referer`: Frontend URL (e.g., `http://localhost:5173`)
  - `X-Title`: "MealPrep Agent" (application name)
  - `Authorization`: OpenRouter API key (server-side, not user-specific)

**Data Stored by OpenRouter:**
- OpenRouter may log requests for billing/analytics
- Check OpenRouter's privacy policy for data retention
- **No user identifiers** (email, name, user_id) are sent to OpenRouter
- Only the message content and images are sent

#### Recipe Extraction
- **User Message**: Recipe text or description
- **Images**: Base64-encoded recipe images (up to 4)
- **System Prompt**: Recipe extraction instructions
- **Same headers** as intent detection

#### General Chat
- **User Message**: Full conversation message
- **Conversation History**: Last 10 messages (user + AI responses)
- **Recipe Context** (if recipe-related question detected):
  - Recipe statistics (counts, most common ingredients/tags)
  - OR top 5 relevant recipes (title, description, ingredients, tags)
- **System Prompt**: Enhanced with recipe context when applicable
- **Same headers** as intent detection

#### Recipe Context Fetching (General Chat)
- **Recipe Stats**: Queries user's recipes from Supabase
  - Recipe titles, ingredients, tags, difficulty, prep/cook times
  - **This data is NOT sent to OpenRouter** - it's only used to build the prompt
- **RAG Search**: If recipe-related question detected
  - Sends query to n8n RAG workflow (see section 3)
  - OR falls back to direct Supabase text search

---

### 2. **Data Storage in Supabase**

#### Chat Conversations Table (`chat_conversations`)
**Stored Data:**
- `id`: UUID (conversation identifier)
- `user_id`: UUID (references `profiles.id` → `auth.users.id`)
- `title`: Conversation title (user-generated or auto-generated from first message)
- `session_id`: Session identifier (for n8n context)
- `selected_intent`: User's selected intent (if manually chosen)
- `metadata`: JSONB (flexible storage for context, RAG results, etc.)
- `created_at`, `updated_at`, `last_message_at`: Timestamps

**GDPR Considerations:**
- ✅ RLS policies ensure users can only access their own conversations
- ✅ `ON DELETE CASCADE` - deleting a conversation deletes all messages
- ⚠️ **No automatic deletion** - data persists until user manually deletes
- ⚠️ **No data retention policy** - conversations stored indefinitely

#### Chat Messages Table (`chat_messages`)
**Stored Data:**
- `id`: UUID (message identifier)
- `conversation_id`: UUID (references `chat_conversations.id`)
- `content`: TEXT (full message content - user messages and AI responses)
- `sender`: VARCHAR ('user' or 'ai')
- `message_type`: VARCHAR ('text', 'recipe', 'image', 'system')
- `metadata`: JSONB (stores):
  - Recipe extraction results
  - Intent detection metadata
  - Image count
  - Routing duration
  - RAG context
- `created_at`, `updated_at`: Timestamps

**GDPR Considerations:**
- ✅ RLS policies ensure users can only access their own messages
- ✅ `ON DELETE CASCADE` - deleting conversation deletes all messages
- ⚠️ **Full message content stored** - includes potentially sensitive information
- ⚠️ **No automatic deletion** - messages persist indefinitely
- ⚠️ **Images**: Base64 images are NOT stored in database (only metadata about image count)

#### Recipes Table (`recipes`)
**Stored Data:**
- Full recipe data (title, description, ingredients, instructions, etc.)
- `user_id`: Links recipe to user
- Used for recipe context in general chat

**GDPR Considerations:**
- ✅ RLS policies ensure users can only access their own recipes
- ✅ Recipes are user-generated content
- ⚠️ Recipe data may be sent to OpenRouter when included in context

---

### 3. **RAG Search → n8n Workflow**

**What Data is Sent to n8n:**

When `rag_search` intent is detected or recipe context is needed:

```json
{
  "message": "user's search query",
  "sessionId": "session identifier",
  "conversationId": "conversation UUID",
  "userId": "user UUID"
}
```

**Additional Data Flow:**
- n8n workflow may query Supabase for recipes
- n8n may generate embeddings using OpenRouter
- n8n may perform vector similarity search

**GDPR Considerations:**
- ⚠️ **User ID sent to n8n** - identifies the user
- ⚠️ **Message content sent to n8n** - may contain personal information
- ⚠️ **n8n may store/log this data** - check n8n instance configuration
- ⚠️ **No data retention policy** - n8n logs may persist

---

## Data Sent to External Services

### OpenRouter API

**What is Sent:**
1. **Message Content**: User's typed messages (full text)
2. **Images**: Base64-encoded images (up to 10MB each, max 4)
3. **Conversation History**: Last 10 messages (user + AI)
4. **Recipe Context**: When recipe-related questions are asked:
   - Recipe statistics (counts, most common ingredients/tags)
   - OR top 5 relevant recipes (title, description, ingredients, tags)

**What is NOT Sent:**
- ❌ User email, name, or other PII
- ❌ User ID
- ❌ Conversation IDs
- ❌ Session IDs
- ❌ Any direct identifiers

**Headers Sent:**
- `HTTP-Referer`: Frontend URL (e.g., `http://localhost:5173`)
- `X-Title`: "MealPrep Agent"
- `Authorization`: API key (not user-specific)

**OpenRouter Data Retention:**
- Check OpenRouter's privacy policy
- They may log requests for billing/analytics
- **Recommendation**: Review OpenRouter's GDPR compliance and data retention policies

### n8n Workflow (RAG Search)

**What is Sent:**
1. **Message**: User's search query
2. **userId**: User UUID (identifies the user)
3. **sessionId**: Session identifier
4. **conversationId**: Conversation UUID

**GDPR Considerations:**
- ⚠️ **User ID is PII** - directly identifies the user
- ⚠️ **Message content may contain PII** - user's search queries
- ⚠️ **n8n instance may log/store this data** - depends on n8n configuration
- ⚠️ **No clear data retention policy** - check n8n instance settings

---

## GDPR Compliance Analysis

### ✅ Current Compliance Features

1. **Row Level Security (RLS)**
   - All chat tables have RLS enabled
   - Users can only access their own data
   - Policies enforced at database level

2. **Data Isolation**
   - User data is isolated by `user_id`
   - No cross-user data access possible

3. **Cascade Deletion**
   - Deleting a conversation deletes all messages
   - Deleting a user profile should cascade (verify migration)

4. **No Direct PII in External APIs**
   - OpenRouter doesn't receive user email, name, or ID
   - Only message content is sent

### ⚠️ GDPR Concerns & Recommendations

#### 1. **Data Retention**
**Issue**: No automatic data deletion policy
- Conversations and messages stored indefinitely
- No TTL (Time To Live) for old conversations

**Recommendation**:
- Implement data retention policy (e.g., delete conversations older than 2 years)
- Add `deleted_at` column for soft deletes
- Provide user option to auto-delete old conversations

#### 2. **Right to Erasure (Article 17)**
**Current State**: Partial implementation
- ✅ Users can delete individual conversations via `DELETE /chat-api/history?conversationId=...`
- ✅ Users can delete all conversations via `DELETE /chat-api/history`
- ✅ Cascade deletion configured:
  - Deleting `auth.users` → deletes `profiles` → deletes `chat_conversations` → deletes `chat_messages`
  - Deleting `chat_conversations` → deletes all `chat_messages`
- ⚠️ No explicit "Delete Account" endpoint
- ⚠️ No data export before deletion

**Recommendation**:
- Implement user account deletion endpoint that:
  - Exports user data first (for portability)
  - Deletes all user data (conversations, messages, recipes)
  - Deletes Supabase Auth user (triggers cascade)
- Add confirmation step before account deletion
- Provide grace period (e.g., 30 days) for account recovery

#### 3. **Right to Data Portability (Article 20)**
**Issue**: No data export feature
- Users cannot export their chat history
- No way to download conversation data

**Recommendation**:
- Add "Export My Data" feature
- Export conversations as JSON/CSV
- Include all messages, metadata, and timestamps

#### 4. **Data Minimization**
**Issue**: Full conversation history sent to OpenRouter
- Last 10 messages always included
- May include sensitive information

**Recommendation**:
- Consider limiting history to last 5 messages
- Allow users to opt-out of history inclusion
- Sanitize messages before sending (remove PII if detected)

#### 5. **Third-Party Data Processing**
**Issue**: OpenRouter and n8n are third-party processors
- No explicit user consent for data processing
- No data processing agreement (DPA) mentioned

**Recommendation**:
- Add privacy policy explaining data processing
- Get explicit user consent for AI processing
- Review OpenRouter's GDPR compliance
- Review n8n instance data handling

#### 6. **Image Data**
**Issue**: Images sent to OpenRouter as base64
- Images may contain personal information
- No image data retention policy

**Recommendation**:
- Warn users before sending images
- Consider image anonymization
- Limit image size/storage duration

#### 7. **Recipe Context in General Chat**
**Issue**: Recipe data included in AI prompts
- User's recipe titles, ingredients, tags sent to OpenRouter
- May reveal personal preferences/dietary restrictions

**Recommendation**:
- Make recipe context inclusion optional
- Allow users to disable recipe context in general chat
- Consider anonymizing recipe data before sending

---

## Data Flow Diagrams

### Intent Detection Flow
```
User Message → Edge Function → OpenRouter API
  - Message text
  - Images (base64)
  - System prompt (no user data)
  
Response → Edge Function → Stored in chat_messages
```

### General Chat Flow
```
User Message → Edge Function
  ↓
Check if recipe-related?
  ↓ YES
Fetch recipe context (from Supabase)
  ↓
Build enhanced prompt with context
  ↓
Send to OpenRouter:
  - Enhanced prompt (includes recipe context)
  - Conversation history (last 10 messages)
  - Current message
  
Response → Edge Function → Stored in chat_messages
```

### RAG Search Flow
```
User Message → Edge Function → n8n Webhook
  - Message text
  - userId (PII)
  - sessionId
  - conversationId
  
n8n → Supabase (queries recipes)
n8n → OpenRouter (generates embeddings)
n8n → Returns results

Response → Edge Function → Stored in chat_messages
```

---

## Recommended GDPR Compliance Actions

### High Priority

1. **Add Privacy Policy**
   - Explain what data is collected
   - Explain how data is used
   - Explain third-party data processing (OpenRouter, n8n)
   - Get explicit user consent

2. **Implement Data Deletion**
   - User account deletion endpoint
   - Cascade delete all user data
   - Soft delete option (with recovery period)

3. **Add Data Export**
   - Export conversations as JSON
   - Export recipes as JSON
   - One-click data download

4. **Review Third-Party Agreements**
   - Check OpenRouter's GDPR compliance
   - Review n8n instance data handling
   - Consider data processing agreements (DPAs)

### Medium Priority

5. **Data Retention Policy**
   - Auto-delete conversations older than X years
   - User-configurable retention period
   - Archive instead of delete (optional)

6. **Data Minimization**
   - Limit conversation history sent to OpenRouter
   - Make recipe context optional
   - Sanitize messages before sending

7. **User Controls**
   - Toggle for recipe context in general chat
   - Option to disable conversation history
   - Clear data button in settings

### Low Priority

8. **Audit Logging**
   - Log all data access
   - Log data deletions
   - Compliance reporting

9. **Data Anonymization**
   - Anonymize recipe data before sending to OpenRouter
   - Remove PII from messages if detected

---

## Data Storage Locations

1. **Supabase Database** (Primary Storage)
   - Chat conversations
   - Chat messages
   - Recipes
   - User profiles
   - Location: Supabase cloud (check region)

2. **OpenRouter** (Temporary Processing)
   - Message content (for AI processing)
   - Images (for vision models)
   - Conversation history (for context)
   - **Not stored long-term** (check OpenRouter policy)

3. **n8n Instance** (RAG Processing)
   - User queries
   - User IDs
   - May log requests (check n8n configuration)
   - Location: Your n8n instance (check location)

---

## Security Measures

### ✅ Current Security

1. **Authentication**: Supabase Auth (JWT tokens)
2. **Authorization**: Row Level Security (RLS) policies
3. **API Keys**: Server-side only (not exposed to frontend)
4. **HTTPS**: All API calls use HTTPS
5. **Input Validation**: Image format/size validation

### ⚠️ Security Recommendations

1. **Rate Limiting**: Prevent abuse
2. **Input Sanitization**: Remove PII before sending to OpenRouter
3. **Encryption**: Consider encrypting sensitive message content
4. **Audit Logs**: Track data access and modifications

---

## Summary

### What Data Goes Where

| Data Type | Supabase | OpenRouter | n8n |
|-----------|----------|------------|-----|
| User Messages | ✅ Stored | ✅ Sent (processing) | ✅ Sent (RAG) |
| AI Responses | ✅ Stored | ❌ | ❌ |
| Images | ❌ (metadata only) | ✅ Sent (processing) | ❌ |
| User ID | ✅ Stored | ❌ | ✅ Sent |
| Recipe Data | ✅ Stored | ✅ Sent (context) | ✅ Queried |
| Conversation History | ✅ Stored | ✅ Sent (last 10) | ❌ |

### GDPR Compliance Status

- ✅ **Data Isolation**: RLS policies ensure user data isolation
- ✅ **Access Control**: Users can only access their own data
- ⚠️ **Data Retention**: No automatic deletion policy
- ⚠️ **Right to Erasure**: No account deletion feature
- ⚠️ **Data Portability**: No export feature
- ⚠️ **Consent**: No explicit consent for AI processing
- ⚠️ **Third-Party Processing**: OpenRouter and n8n process user data

### Next Steps

1. Review OpenRouter's privacy policy and GDPR compliance
2. Review n8n instance data handling and retention
3. Implement user account deletion
4. Add data export feature
5. Create privacy policy and get user consent
6. Consider data retention policies

