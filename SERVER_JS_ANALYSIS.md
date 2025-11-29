# server.js Analysis

## Overview
`server.js` is a **local development Express.js server** that runs on port 3000. It provides API endpoints for local development when you don't want to use Supabase Edge Functions.

## Purpose
This server acts as a **local alternative** to Supabase Edge Functions for development. It's useful for:
- Local testing without deploying edge functions
- Development when you need to debug server-side code
- Testing webhook integrations with n8n

## What It Does

### 1. **Chat Functionality** (via n8n Webhook)
- **POST `/api/chat/message`** - Sends chat messages to n8n webhook and returns AI responses
- **GET `/api/chat/history`** - Returns empty chat history (placeholder)
- Integrates with n8n workflow for AI chat responses

### 2. **Recipe Management**
- **POST `/api/recipes`** - Stores recipes in Supabase and generates embeddings
- Uses Supabase database service (`database.js`)
- Automatically generates embeddings for semantic search

### 3. **RAG (Retrieval-Augmented Generation) Endpoints**
- **POST `/api/rag/search`** - Semantic/vector search for recipes
- **GET `/api/rag/similar/:recipeId`** - Find similar recipes
- **POST `/api/rag/ingredients`** - Search recipes by ingredients
- **POST `/api/rag/recommendations`** - Get recipe recommendations
- **POST `/api/rag/embedding`** - Generate embeddings for text

### 4. **Utility Endpoints**
- **GET `/api/health`** - Health check endpoint
- **GET `/api/test-webhook`** - Test n8n webhook connectivity

## Key Dependencies
- **Express.js** - Web server framework
- **Supabase Client** - Database operations (via `database.js`)
- **Embedding Service** - OpenAI embeddings for semantic search
- **n8n Webhook** - AI chat responses

## Current Status

### ✅ What It Does Well
- Local development server for testing
- Webhook integration with n8n
- RAG/search functionality
- Recipe storage with embeddings

### ⚠️ Potential Issues
1. **Redundancy** - You have Supabase Edge Functions that do similar things:
   - `supabase/functions/chat-api/index.ts` - Chat functionality
   - `supabase/functions/recipes-api/index.ts` - Recipe CRUD
   
2. **Authentication** - Currently just requires `userId` in request, doesn't verify Supabase auth tokens

3. **Production Use** - This is meant for local dev, but could be confusing if used in production

## Comparison: server.js vs Supabase Edge Functions

| Feature | server.js | Supabase Edge Functions |
|---------|-----------|------------------------|
| **Location** | Local (localhost:3000) | Serverless (Supabase) |
| **Chat** | ✅ Via n8n webhook | ✅ Via n8n webhook |
| **Recipes** | ✅ Direct DB access | ✅ Direct DB access |
| **RAG Search** | ✅ Full RAG endpoints | ❌ Not implemented |
| **Auth** | ⚠️ Requires userId only | ✅ Verifies Supabase tokens |
| **Deployment** | Manual (node server.js) | Automatic (Supabase) |
| **Use Case** | Local development | Production + Development |

## Recommendation

### Option 1: Keep for Local Development (Recommended)
- Keep `server.js` for local development and testing
- Use Supabase Edge Functions for production
- Document that `server.js` is dev-only

### Option 2: Migrate RAG to Edge Functions
- Move RAG endpoints to Supabase Edge Functions
- Remove `server.js` entirely
- Use edge functions for both dev and production

### Option 3: Hybrid Approach
- Keep `server.js` for RAG/search (not in edge functions yet)
- Use edge functions for chat and recipes
- Document which endpoints use which server

## Current Endpoints Summary

```
GET  /api/health                    - Health check
GET  /api/test-webhook              - Test n8n webhook
GET  /api/chat/history              - Chat history (empty)
POST /api/chat/message              - Send chat message
POST /api/recipes                   - Store recipe
GET  /api/rag/similar/:recipeId     - Similar recipes
POST /api/rag/search                - Semantic search
POST /api/rag/ingredients           - Search by ingredients
POST /api/rag/recommendations       - Get recommendations
POST /api/rag/embedding             - Generate embedding
```

## Environment Variables Required
- `WEBHOOK_ENABLED` - Enable/disable webhooks
- `N8N_WEBHOOK_URL` - n8n webhook URL
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anon key
- `OPENAI_API_KEY` - For embeddings (via embeddingService)

## How to Run
```bash
npm run server        # Run server only
npm run dev:all       # Run server + frontend dev server
```

## Notes
- Server runs on `0.0.0.0:3000` (accessible from network)
- CORS enabled for localhost:5173 (Vite dev server)
- All endpoints now require `userId` (no test user fallback)



