# RAG System Architecture

## Overview

The RAG (Retrieval-Augmented Generation) system enables context-aware AI responses by searching the user's recipe database and providing relevant context to the AI model.

## Architecture

```
User Query → RAG Search → Vector/Text Search → Recipe Context → AI Response
```

### Components

1. **Edge Function** (`api/rag/search.js`): Vercel Edge Function for low-latency RAG search
2. **Database Service** (`src/services/database.ts`): PostgreSQL queries with vector search
3. **Embedding Service** (`src/services/embeddingService.ts`): OpenAI embeddings generation
4. **n8n Integration**: Workflow orchestration for AI responses

## Search Types

### Semantic (Vector) Search
- Uses OpenAI embeddings (`text-embedding-ada-002`)
- Cosine similarity on vector embeddings
- Best for: Finding conceptually similar recipes
- Example: "comfort food" → finds soups, stews, casseroles

### Text Search
- Uses PostgreSQL full-text search
- Keyword matching with ranking
- Best for: Exact keyword matching
- Example: "chicken" → finds recipes containing "chicken"

### Hybrid Search (Recommended)
- Combines vector and text search
- Weighted: 70% vector, 30% text
- Best for: Most queries - balances semantic understanding with keyword matching

## Implementation

### Edge Function Deployment

**File**: `api/rag/search.js`

**Features**:
- Vercel Edge Function compatible
- Uses `@neondatabase/serverless` for database access
- Supports semantic, text, and hybrid search
- Auto-detects OpenRouter API keys
- Direct SQL queries (no stored procedures required)

**Endpoint**: `https://meal-prep-agent-delta.vercel.app/api/rag/search`

### API Usage

**POST** `/api/rag/search`

**Request Body**:
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

## n8n Integration

Update your n8n workflow HTTP Request node:

- **Method**: POST
- **URL**: `https://meal-prep-agent-delta.vercel.app/api/rag/search`
- **Headers**: `Content-Type: application/json`
- **Body**:
```json
{
  "query": "={{ $json.query }}",
  "userId": "={{ $json.userId }}",
  "limit": 10,
  "searchType": "hybrid"
}
```

## Environment Variables

Required in Vercel:
- `DATABASE_URL`: Neon PostgreSQL connection string
- `OPENROUTER_API_KEY` or `OPENAI_API_KEY`: For embeddings
- `STACK_PROJECT_ID`: For authentication (production)
- `STACK_SERVER_SECRET_KEY`: For authentication (production)

## Troubleshooting

### CORS Errors
- Edge function includes CORS headers
- Ensure n8n is making requests from an allowed origin

### Database Connection Errors
- Verify `DATABASE_URL` is set correctly in Vercel
- Check Neon database is accessible from Vercel's edge network

### Embedding Generation Errors
- Verify API key is set correctly
- Check API key has sufficient credits/quota

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

## Benefits

1. **Context-Aware Responses**: AI has access to user's recipe database
2. **Personalized Recommendations**: Based on user's actual recipes
3. **Intelligent Search**: Semantic understanding of recipe content
4. **Fast Performance**: Edge functions provide low-latency responses
5. **Scalable**: Serverless architecture scales automatically

---

For deployment details, see [Development/RAG_SEARCH_EDGE_FUNCTION.md](../Development/RAG_SEARCH_EDGE_FUNCTION.md)

