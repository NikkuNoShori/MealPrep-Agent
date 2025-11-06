# n8n RAG Search Configuration Guide

## Correct Configuration

### HTTP Request Node: "RAG Search"

**URL**: 
```
={{ $json.ragEndpoint || 'https://meal-prep-agent-delta.vercel.app/api/rag/search' }}
```

**Method**: `POST`

**Headers**:
```
Content-Type: application/json
```

**Body Content Type**: `JSON`

**JSON Body**:
```json
{
  "query": "={{ $json.body.content || $json.content || $json.query }}",
  "userId": "={{ $json.body.userId || $json.body.user.id || $json.user.id || $json.userId }}",
  "limit": 5,
  "searchType": "hybrid"
}
```

## Understanding the Webhook Payload Structure

Your n8n webhook receives different payload structures depending on the source:

### From Edge Function (`api/chat.js`)
```json
{
  "event": "chat.message.sent",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "data": {
    "id": "message-id",
    "content": "User message",
    "type": "text"
  },
  "user": {
    "id": "user-uuid-here",
    "email": "user@example.com"
  },
  "metadata": {
    "context": {}
  }
}
```

In this case, access:
- Query: `$json.body.data.content` or `$json.data.content`
- User ID: `$json.body.user.id` or `$json.user.id`

### From Server (`server.js`)
```json
{
  "content": "User message",
  "sessionId": "session-id",
  "userId": "user-uuid-here"
}
```

In this case, access:
- Query: `$json.body.content` or `$json.content`
- User ID: `$json.body.userId` or `$json.userId`

### Simplified Payload (Direct)
```json
{
  "content": "User message",
  "userId": "user-uuid-here"
}
```

## Recommended Configuration

Use this expression to handle all payload structures:

```json
{
  "query": "={{ $json.body.content || $json.body.data.content || $json.content || $json.query }}",
  "userId": "={{ $json.body.userId || $json.body.user.id || $json.user.id || $json.userId }}",
  "limit": 5,
  "searchType": "hybrid"
}
```

This will:
1. Try `$json.body.content` (simplified webhook payload)
2. Try `$json.body.data.content` (full webhook payload structure)
3. Try `$json.content` (direct payload)
4. Try `$json.query` (if already extracted)

For user ID:
1. Try `$json.body.userId` (simplified payload)
2. Try `$json.body.user.id` (full webhook payload structure)
3. Try `$json.user.id` (alternative structure)
4. Try `$json.userId` (direct payload)

## Testing Your Configuration

To test what data is available in your n8n workflow:

1. Add a "Code" node before the RAG Search node
2. Use this code to log the payload:
```javascript
console.log('Full payload:', JSON.stringify($input.all(), null, 2));
return $input.all();
```

3. Check the n8n execution logs to see the exact structure
4. Update the RAG Search node expressions based on what you see

## Important Notes

- **DO NOT** use `'test-user'` as a fallback - always use actual user data
- The `userId` field is **required** for database queries to filter by user
- If `userId` is missing, the search will fail or return incorrect results
- Make sure your webhook payload includes the user ID field

## Troubleshooting

### Error: "Query parameter is required"
- Check that `$json.body.content` or `$json.content` contains the user's message
- Verify the webhook payload structure matches your expressions

### Error: "User ID not found"
- Check that `$json.body.userId` or `$json.user.id` contains the actual user UUID
- Verify the user is authenticated in the webhook payload

### No Results Returned
- Verify the user ID matches actual user IDs in your database
- Check that recipes exist for that user ID
- Ensure the user ID is a UUID format, not a string like 'test-user'

