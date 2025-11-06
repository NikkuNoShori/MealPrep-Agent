# RAG Search Edge Function

## Overview

The RAG search endpoint is deployed as a Vercel Edge Function at `/api/rag/search`, allowing n8n workflows to access recipe search functionality without connecting to a local server.

## Deployment

### Prerequisites

Install required packages:
```bash
npm install @neondatabase/serverless openai
```

### Environment Variables

Set in Vercel project settings:
```
DATABASE_URL=your-neon-connection-string
OPENROUTER_API_KEY=your-openrouter-api-key  # OR
OPENAI_API_KEY=your-openai-api-key           # Alternative to OpenRouter
STACK_PROJECT_ID=your-stack-project-id      # For authentication (production)
STACK_SERVER_SECRET_KEY=your-stack-secret-key # For authentication (production)
```

### Deploy

The edge function deploys automatically when you push to your Vercel-connected repository:
```bash
vercel --prod
```

## API Usage

**POST** `/api/rag/search`

**Request**:
```json
{
  "query": "chicken recipes with vegetables",
  "userId": "user-uuid-here",
  "limit": 10,
  "searchType": "hybrid"
}
```

**Response**:
```json
{
  "results": [
    {
      "id": "recipe-uuid",
      "title": "Chicken Stir Fry",
      "description": "...",
      "ingredients": [...],
      "instructions": [...],
      "similarity_score": 0.85,
      "rank_score": 0.72
    }
  ],
  "total": 5,
  "searchType": "hybrid",
  "query": "chicken recipes with vegetables"
}
```

## n8n Configuration

**HTTP Request Node**:
- **Method**: POST
- **URL**: `https://meal-prep-agent-delta.vercel.app/api/rag/search`
- **Headers**: `Content-Type: application/json`
- **Body**:
```json
{
  "query": "={{ $json.body.content || $json.content || $json.query }}",
  "userId": "={{ $json.body.userId || $json.body.user.id || $json.user.id || $json.userId }}",
  "limit": "={{ $json.body.limit || $json.limit || 5 }}",
  "searchType": "={{ $json.body.searchType || $json.searchType || 'hybrid' }}"
}
```

## Search Types

- **semantic**: Pure vector search (best for conceptual similarity)
- **text**: Pure text search (best for keyword matching)
- **hybrid**: Combined approach (recommended for most queries)

## Issues & Fixes

### Issue 1: API Key Detection
**Problem**: Edge function only checked `OPENROUTER_API_KEY` but environment variable was set as `OPENAI_API_KEY`

**Solution**: Added auto-detection for OpenRouter keys (checks for `sk-or-v1-` prefix)

### Issue 2: Stored Procedures Not Found
**Problem**: Stored procedures didn't exist in database

**Solution**: Replaced with direct SQL queries matching stored procedure logic

### Issue 3: Database Schema Mismatch
**Problem**: `recipe_embeddings` table didn't exist

**Solution**: Added fallback queries that work with just the `recipes` table

### Issue 4: User ID Type Mismatch
**Problem**: `user_id` column is UUID but queries compared to string

**Solution**: Explicitly cast `user_id` to text for comparison

### Issue 5: Authentication
**Problem**: Edge function had no authentication

**Solution**: Added token verification via `api/rag/auth.js` (production mode requires auth)

## Troubleshooting

### CORS Errors
- Edge function includes CORS headers
- Ensure n8n is making requests from an allowed origin

### Database Connection Errors
- Verify `DATABASE_URL` is set correctly in Vercel
- Check Neon database is accessible

### Embedding Generation Errors
- Verify API key is set correctly
- Check API key has sufficient credits/quota

### Authentication Errors
- In production, ensure `STACK_PROJECT_ID` and `STACK_SERVER_SECRET_KEY` are set
- In development, authentication is optional

## Local Testing

Test locally using Vercel CLI:
```bash
vercel dev
```

Then test with:
```bash
curl -X POST http://localhost:3000/api/rag/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "chicken recipes",
    "userId": "test-user",
    "limit": 5,
    "searchType": "hybrid"
  }'
```

---

For architecture details, see [Architecture/RAG.md](../Architecture/RAG.md)
