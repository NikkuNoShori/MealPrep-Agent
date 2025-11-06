# RAG Search Edge Function Deployment Guide

## Overview

The RAG (Retrieval-Augmented Generation) search endpoint has been deployed as a Vercel Edge Function at `/api/rag/search`. This allows n8n (running on `https://agents.eaglesightlabs.com/`) to access the RAG search functionality without needing to connect to a local server.

## Architecture

- **Edge Function**: `api/rag/search.js`
- **Database**: Neon PostgreSQL (via `@neondatabase/serverless`)
- **Embeddings**: OpenAI `text-embedding-ada-002` (via OpenRouter or OpenAI API)
- **Search Types**: Semantic (vector), Text (full-text), Hybrid (combined)

## Deployment

### 1. Prerequisites

Ensure these packages are installed:
```bash
npm install @neondatabase/serverless openai
```

### 2. Environment Variables

Set these in your Vercel project settings:

```
DATABASE_URL=your-neon-connection-string
OPENROUTER_API_KEY=your-openrouter-api-key  # OR
OPENAI_API_KEY=your-openai-api-key           # Alternative to OpenRouter
```

### 3. Deploy to Vercel

The edge function is automatically deployed when you push to your Vercel-connected repository:

```bash
# Or deploy manually
vercel --prod
```

### 4. Get the Edge Function URL

After deployment, your RAG search endpoint will be available at:
```
https://your-project.vercel.app/api/rag/search
```

## API Usage

### Endpoint

**POST** `/api/rag/search`

### Request Body

```json
{
  "query": "chicken recipes with vegetables",
  "userId": "user-uuid-here",
  "limit": 10,
  "searchType": "hybrid"  // Options: "semantic", "text", "hybrid"
}
```

### Response

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
      "rank_score": 0.72,
      "searchable_text": "..."
    }
  ],
  "total": 5,
  "searchType": "hybrid",
  "query": "chicken recipes with vegetables"
}
```

## n8n Integration

Update your n8n workflow to use the Vercel Edge Function URL:

1. **HTTP Request Node**:
   - **Method**: POST
   - **URL**: `https://your-project.vercel.app/api/rag/search`
   - **Headers**: 
     - `Content-Type: application/json`
   - **Body**:
     ```json
     {
       "query": "{{ $json.query }}",
       "userId": "{{ $json.userId }}",
       "limit": 10,
       "searchType": "hybrid"
     }
     ```

## Search Types

### Semantic (Vector) Search
- Uses cosine similarity on embeddings
- Best for: Finding conceptually similar recipes
- Example: "comfort food" → finds soups, stews, casseroles

### Text Search
- Uses PostgreSQL full-text search
- Best for: Exact keyword matching
- Example: "chicken" → finds recipes containing "chicken"

### Hybrid Search (Recommended)
- Combines vector and text search
- Weighted: 70% vector, 30% text
- Best for: Most queries - balances semantic understanding with keyword matching

## Troubleshooting

### CORS Errors
- Edge function already includes CORS headers
- Ensure n8n is making requests from an allowed origin

### Database Connection Errors
- Verify `DATABASE_URL` is set correctly in Vercel
- Check Neon database is accessible from Vercel's edge network

### Embedding Generation Errors
- Verify `OPENROUTER_API_KEY` or `OPENAI_API_KEY` is set
- Check API key has sufficient credits/quota

### Vector Dimension Mismatch
- Stored procedure expects `vector(384)` 
- OpenAI `text-embedding-ada-002` produces 1536 dimensions
- **Note**: You may need to update the stored procedure or use a different embedding model

## Local Testing

You can test the edge function locally using Vercel CLI:

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

## Next Steps

1. ✅ Deploy edge function to Vercel
2. ✅ Update n8n workflow to use Vercel URL
3. ✅ Test RAG search from n8n
4. ⚠️ Verify embedding dimensions match stored procedure (384 vs 1536)
5. ⚠️ Update stored procedure if needed for 1536-dimensional embeddings

