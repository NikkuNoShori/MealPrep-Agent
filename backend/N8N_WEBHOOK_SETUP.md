# n8n Webhook Setup

## Required Environment Variables

Set these in your Vercel deployment:

```bash
WEBHOOK_ENABLED=true
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/your-webhook-id
DATABASE_URL=your-neon-connection-string
```

## n8n Workflow Setup

1. **Create Webhook Node**
   - Add a webhook node to your n8n workflow
   - Set HTTP method to `POST`
   - Copy the webhook URL

2. **Add AI Processing**
   - Connect your AI service (OpenAI, Claude, etc.) to the webhook
   - Process the incoming message: `{{ $json.data.content }}`

3. **Configure Response**
   - Return the AI response in this format:
   ```json
   {
     "content": "Your AI response here"
   }
   ```

## Expected Request Format

Your n8n webhook will receive:
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
    "id": "user-id",
    "email": "user@example.com"
  },
  "metadata": {
    "context": {}
  }
}
```

## Expected Response Format

Your n8n webhook should return:
```json
{
  "content": "AI response message"
}
```

## Authentication

You need to implement proper authentication in the `getAuthenticatedUser` function in `chat-api.js`.
