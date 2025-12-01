# Chat Edge Function Setup

This document explains how to set up and deploy the chat edge function for the MealPrep Agent application.

## 🏗️ Architecture Overview

The chat edge function provides a high-performance, serverless solution for handling chat operations:

- **Edge Runtime**: Runs on Vercel's edge network for global low-latency
- **Direct Database Access**: Connects directly to Supabase for fast data operations
- **AI Integration**: Integrates with Vertex AI for intelligent responses
- **Real-time Processing**: Handles message processing and storage efficiently

## 📁 File Structure

```
backend/
├── src/edge-functions/
│   └── chat.js                 # Main edge function
├── migrations/
│   └── 002_chat_messages.sql   # Database schema
├── edge-functions/
│   └── vercel.json            # Vercel configuration
├── deploy-edge-function.sh    # Deployment script
└── EDGE_FUNCTION_README.md    # This file
```

## 🚀 Quick Start

### 1. Prerequisites

- Vercel CLI installed: `npm install -g vercel`
- Supabase database with the chat_messages table
- Vertex AI project configured
- Environment variables set up

### 2. Environment Variables

Create a `.env` file in the backend directory:

```env
DATABASE_URL=postgresql://user:password@host/database
FRONTEND_URL=http://localhost:5173
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/chat
OPENROUTER_API_KEY=your-openrouter-api-key
```

### 3. Database Setup

Run the migration to create the chat_messages table:

```sql
-- Run the migration file: migrations/002_chat_messages.sql
```

### 4. Deploy

```bash
# Make the deployment script executable
chmod +x deploy-edge-function.sh

# Run the deployment
./deploy-edge-function.sh
```

## 📡 API Endpoints

### POST /api/chat/message
Send a chat message and get AI response.

**Request:**
```json
{
  "message": "Hello, can you help me with meal planning?",
  "context": "Optional context for the AI"
}
```

**Response:**
```json
{
  "message": "Message processed successfully",
  "userMessage": {
    "id": "123",
    "content": "Hello, can you help me with meal planning?",
    "sender": "user",
    "timestamp": "2024-01-01T00:00:00Z"
  },
  "aiResponse": {
    "id": "124",
    "content": "I'd be happy to help you with meal planning!",
    "sender": "ai",
    "timestamp": "2024-01-01T00:00:01Z"
  }
}
```

### GET /api/chat/history
Get chat history for the authenticated user.

**Query Parameters:**
- `limit` (optional): Number of messages to return (default: 50)

**Response:**
```json
{
  "messages": [
    {
      "id": "123",
      "content": "Hello",
      "sender": "user",
      "type": "text",
      "timestamp": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### POST /api/chat/add-recipe
Add a recipe through chat interface.

**Request:**
```json
{
  "recipeText": "Chicken stir fry with vegetables..."
}
```

**Response:**
```json
{
  "message": "Recipe added successfully",
  "recipe": {
    "id": "456",
    "title": "Chicken Stir Fry",
    "description": "A delicious stir fry...",
    "ingredients": ["chicken", "vegetables"],
    "instructions": ["Step 1", "Step 2"],
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "confirmation": "I've added \"Chicken Stir Fry\" to your recipe collection!"
}
```

### DELETE /api/chat/history
Clear chat history for the authenticated user.

**Response:**
```json
{
  "message": "Chat history cleared successfully"
}
```

## 🔐 Authentication

The edge function expects:

1. **Authorization Header**: `Bearer <jwt_token>`
2. **X-User-ID Header**: User identifier

```javascript
const headers = {
  'Authorization': `Bearer ${token}`,
  'X-User-ID': userId,
  'Content-Type': 'application/json'
};
```

## 🛠️ Development

### Local Testing

1. Install Vercel CLI: `npm install -g vercel`
2. Link your project: `vercel link`
3. Set environment variables: `vercel env add`
4. Deploy: `vercel --prod`

### Debugging

Check Vercel function logs:
```bash
vercel logs --follow
```

### Environment Variables in Vercel

Set these in your Vercel dashboard:
- `DATABASE_URL`
- `FRONTEND_URL`
- `VERTEX_AI_PROJECT_ID`
- `VERTEX_AI_LOCATION`

## 🔄 Integration with Frontend

Update your frontend API service to use the edge function:

```typescript
// src/services/chatApi.ts
const EDGE_FUNCTION_URL = 'https://your-project.vercel.app';

export const chatApi = {
  async sendMessage(data) {
    const response = await fetch(`${EDGE_FUNCTION_URL}/api/chat/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-User-ID': userId,
      },
      body: JSON.stringify(data),
    });
    return response.json();
  }
};
```

## 📊 Performance Benefits

- **Global Edge Network**: Low latency worldwide
- **Serverless**: No server management required
- **Auto-scaling**: Handles traffic spikes automatically
- **Direct Database**: Minimal network hops to Supabase
- **Cold Start Optimization**: Fast function initialization

## 🔍 Monitoring

Monitor your edge function in the Vercel dashboard:
- Function invocations
- Response times
- Error rates
- Resource usage

## 🚨 Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure `FRONTEND_URL` is set correctly
2. **Database Connection**: Verify `DATABASE_URL` is accessible
3. **Authentication**: Check JWT token and user ID headers
4. **AI Service**: Confirm Vertex AI credentials are valid

### Debug Steps

1. Check Vercel function logs
2. Verify environment variables
3. Test database connectivity
4. Validate request headers

## 📈 Scaling Considerations

- **Rate Limiting**: Implement if needed
- **Caching**: Consider Redis for frequently accessed data
- **Monitoring**: Set up alerts for errors and performance
- **Backup**: Regular database backups

## 🔗 Related Files

- `src/services/vertexAI.js` - AI service integration
- `src/services/database.js` - Database connection
- `src/middleware/auth.js` - Authentication middleware
- `src/routes/chat.js` - Original REST API (can be deprecated)
