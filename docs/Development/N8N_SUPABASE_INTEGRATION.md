# n8n Supabase Integration Guide

## Overview

This guide explains how to wire up Supabase to the n8n MealPrep Agent flow so it can read from the recipes table for RAG search.

## Current Architecture

The n8n workflow currently has a "RAG Search" node that calls:
```
http://localhost:3000/api/rag/search
```

This endpoint uses Supabase, but we can optimize by having n8n connect directly to Supabase.

## Integration Options

### Option 1: Direct Supabase Connection in n8n (Recommended)

**Benefits:**
- Faster (no intermediate API layer)
- Direct database access
- Better error handling
- Can use Supabase's built-in RPC functions

**Steps:**

1. **Install Supabase Node in n8n** (if not already installed):
   - Go to n8n Settings → Community Nodes
   - Search for "Supabase" or "@n8n/n8n-nodes-supabase"
   - Install the Supabase community node

2. **Add Supabase Credentials in n8n**:
   - Go to n8n Settings → Credentials
   - Click "Add Credential"
   - Select "Supabase API"
   - Enter:
     - **Host**: `https://vcovstjdevclkxxkiwic.supabase.co`
     - **Service Role Secret**: Your Supabase service role key (for admin access)
     - OR **Anon Key**: Your Supabase anon key (for RLS-protected access)
   - Save as "Supabase Production"

3. **Update the RAG Search Node**:

   Replace the HTTP Request node with a Supabase node:

   ```json
   {
     "parameters": {
       "operation": "executeFunction",
       "functionName": "search_recipes_semantic",
       "arguments": {
         "query_embedding": "={{ $json.queryEmbedding }}",
         "user_id": "={{ $json.userId }}",
         "match_threshold": 0.7,
         "match_count": 5
       }
     },
     "type": "@n8n/n8n-nodes-supabase.supabase",
     "credentials": {
       "supabaseApi": {
         "id": "your-credential-id",
         "name": "Supabase Production"
       }
     }
   }
   ```

   **OR** Use a direct query:

   ```json
   {
     "parameters": {
       "operation": "get",
       "table": "recipes",
       "filter": {
         "user_id": "={{ $json.userId }}"
       },
       "options": {
         "textSearch": {
           "column": "searchable_text",
           "query": "={{ $json.message }}"
         }
       }
     },
     "type": "@n8n/n8n-nodes-supabase.supabase"
   }
   ```

### Option 2: Use Supabase REST API via HTTP Request

**Benefits:**
- No additional n8n nodes needed
- Works with existing HTTP Request node
- Can use Supabase's PostgREST API

**Steps:**

1. **Update RAG Search Node** in n8n workflow:

   Change the HTTP Request node configuration:

   ```json
   {
     "parameters": {
       "url": "https://vcovstjdevclkxxkiwic.supabase.co/rest/v1/rpc/search_recipes_semantic",
       "authentication": "genericCredentialType",
       "genericAuthType": "httpHeaderAuth",
       "sendHeaders": true,
       "headerParameters": {
         "parameters": [
           {
             "name": "apikey",
             "value": "={{ $env.SUPABASE_ANON_KEY }}"
           },
           {
             "name": "Authorization",
             "value": "Bearer {{ $env.SUPABASE_ANON_KEY }}"
           },
           {
             "name": "Content-Type",
             "value": "application/json"
           }
         ]
       },
       "sendBody": true,
       "bodyContentType": "json",
       "jsonBody": "={{ {\"query_embedding\": $json.queryEmbedding, \"user_id\": $json.userId, \"match_threshold\": 0.7, \"match_count\": 5} }}",
       "options": {}
     },
     "type": "n8n-nodes-base.httpRequest"
   }
   ```

2. **Set Environment Variables in n8n**:
   - Go to n8n Settings → Environment Variables
   - Add:
     - `SUPABASE_ANON_KEY` = Your Supabase anon key
     - `SUPABASE_URL` = `https://vcovstjdevclkxxkiwic.supabase.co`

### Option 3: Keep Current Backend API (Simplest)

**Benefits:**
- No changes to n8n workflow needed
- Backend handles all Supabase logic
- Easier to maintain

**Steps:**

1. **Ensure Backend RAG API has Supabase Credentials**:
   
   In your backend environment (where `server.js` runs), ensure these are set:
   ```env
   SUPABASE_URL=https://vcovstjdevclkxxkiwic.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-here
   OPENAI_API_KEY=your-openai-key-for-embeddings
   ```

2. **Update RAG Search Node URL** (if needed):
   
   The current config uses:
   ```json
   "url": "={{ $json.ragEndpoint || 'http://localhost:3000/api/rag/search' }}"
   ```
   
   For production, update to:
   ```json
   "url": "https://your-backend-domain.com/api/rag/search"
   ```

3. **Verify Backend is Running**:
   - The backend server must be accessible from n8n
   - If n8n is on a different machine, use the machine's IP or public URL

## Recommended Approach: Hybrid Solution

**For RAG Search:**

1. **Generate Embedding** (if needed):
   - Use HTTP Request to call OpenAI API for embedding generation
   - OR use Supabase's built-in embedding function if available

2. **Query Supabase Directly**:
   - Use Supabase node or HTTP Request to call `search_recipes_semantic` RPC function
   - Pass: `query_embedding`, `user_id`, `match_threshold`, `match_count`

3. **Format Results**:
   - Transform Supabase response into format expected by RAG Chat Agent
   - Include recipe context in the prompt

## Updated n8n Workflow Configuration

Here's the updated RAG Search section:

```json
{
  "parameters": {
    "operation": "executeFunction",
    "functionName": "search_recipes_semantic",
    "arguments": {
      "query_embedding": "={{ $json.queryEmbedding }}",
      "user_id": "={{ $json.userId }}",
      "match_threshold": 0.7,
      "match_count": 5
    }
  },
  "type": "@n8n/n8n-nodes-supabase.supabase",
  "name": "Supabase RAG Search",
  "position": [224, 100],
  "credentials": {
    "supabaseApi": {
      "id": "your-credential-id",
      "name": "Supabase Production"
    }
  }
}
```

**Before this node**, add an "Generate Embedding" node:

```json
{
  "parameters": {
    "url": "https://api.openai.com/v1/embeddings",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "Authorization",
          "value": "Bearer {{ $env.OPENAI_API_KEY }}"
        },
        {
          "name": "Content-Type",
          "value": "application/json"
        }
      ]
    },
    "sendBody": true,
    "bodyContentType": "json",
    "jsonBody": "={{ {\"model\": \"text-embedding-3-small\", \"input\": $json.message} }}",
    "options": {}
  },
  "type": "n8n-nodes-base.httpRequest",
  "name": "Generate Embedding",
  "position": [112, 100]
}
```

**After Supabase RAG Search**, add a "Format Context" node:

```json
{
  "parameters": {
    "jsCode": "// Format recipes for context\nconst recipes = $input.all();\nconst context = recipes.map(recipe => {\n  return `Title: ${recipe.title}\\nDescription: ${recipe.description}\\nIngredients: ${JSON.stringify(recipe.ingredients)}\\nInstructions: ${JSON.stringify(recipe.instructions)}`;\n}).join('\\n\\n---\\n\\n');\n\nreturn {\n  json: {\n    recipeContext: context,\n    message: $json.message,\n    userId: $json.userId\n  }\n};"
  },
  "type": "n8n-nodes-base.code",
  "name": "Format Recipe Context",
  "position": [336, 100]
}
```

## Environment Variables Needed in n8n

Set these in n8n Settings → Environment Variables:

```env
SUPABASE_URL=https://vcovstjdevclkxxkiwic.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here (optional, for admin operations)
OPENAI_API_KEY=your-openai-key-here (for embeddings)
```

## Testing the Integration

1. **Test Supabase Connection**:
   - Create a test workflow in n8n
   - Add Supabase node
   - Try a simple query: `SELECT * FROM recipes LIMIT 1`
   - Verify it returns data

2. **Test RAG Search**:
   - Send a test message: "Find recipes with chicken"
   - Check if embedding is generated
   - Verify Supabase returns recipes
   - Confirm context is formatted correctly

3. **Check Logs**:
   - Monitor n8n execution logs
   - Check for any Supabase connection errors
   - Verify RLS policies allow the query

## Troubleshooting

### Issue: "Permission denied" or RLS errors

**Solution:**
- Use Service Role Key instead of Anon Key (bypasses RLS)
- OR ensure RLS policies allow the user_id query
- OR use authenticated Supabase client with user's JWT token

### Issue: "Function not found" for RPC calls

**Solution:**
- Verify `search_recipes_semantic` function exists in Supabase
- Check function name spelling
- Ensure function is in `public` schema

### Issue: Embedding dimension mismatch

**Solution:**
- Ensure OpenAI embedding model matches Supabase vector dimension
- `text-embedding-3-small` = 1536 dimensions
- Verify Supabase `recipe_embeddings` table uses correct dimension

## Next Steps

1. Choose your integration approach (Option 1 recommended)
2. Install Supabase node in n8n (if using Option 1)
3. Configure Supabase credentials
4. Update the RAG Search node in your workflow
5. Test the integration
6. Update environment variables as needed

## References

- [Supabase n8n Node Documentation](https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.supabase/)
- [Supabase REST API](https://supabase.com/docs/reference/javascript/introduction)
- [Supabase RPC Functions](https://supabase.com/docs/guides/database/functions)

