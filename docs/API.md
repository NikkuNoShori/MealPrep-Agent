# API Reference

> Edge functions, RPC contracts, OpenRouter endpoints, and request/response shapes for MealPrep Agent.

**Last reviewed:** 2026-03-10
**Last updated:** 2026-03-10 (initial canonical doc creation)

---

## Edge Functions

### POST `/functions/v1/chat-api`

Main chat endpoint with intent routing and multi-modal support.

**Location:** `supabase/functions/chat-api/index.ts`

**Headers:**
```
Authorization: Bearer <supabase-jwt>
Content-Type: application/json
```

**Request body:**
```json
{
  "message": "string (required)",
  "images": ["base64-encoded-string (optional, max 4)"],
  "conversationId": "uuid (optional)",
  "sessionId": "string (optional)"
}
```

**Response:**
```json
{
  "intent": "recipe_extraction | rag_search | general_chat",
  "response": "string (AI response text)",
  "recipe": {
    "title": "string",
    "description": "string",
    "ingredients": [{"name": "...", "amount": 1, "unit": "cup"}],
    "instructions": ["step 1", "step 2"],
    "prepTime": 15,
    "cookTime": 30,
    "servings": 4,
    "difficulty": "easy | medium | hard",
    "cuisine": "string",
    "tags": ["string"]
  },
  "conversationId": "uuid"
}
```

**Intent routing:**
| Intent | Model | Behavior |
|--------|-------|----------|
| `recipe_extraction` | `qwen/qwen-2.5-vl-7b-instruct` | Extracts structured recipe JSON from text/images |
| `rag_search` | `qwen/qwen-3-8b` | Searches user recipes via hybrid search, returns contextual response |
| `general_chat` | `qwen/qwen-3-8b` | General cooking conversation |

**Error responses:**
- `401` — Missing or invalid JWT
- `400` — Missing required `message` field
- `429` — Rate limited
- `500` — Internal error (OpenRouter failure, DB error)

---

## Supabase RPC Functions

All RPCs are called via `supabase.rpc('function_name', params)`.

### search_recipes_semantic

Semantic similarity search using vector embeddings.

```sql
search_recipes_semantic(
  query_embedding VECTOR(1536),
  user_id UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10
)
```

**Returns:** Matching recipes with `similarity` score (0–1, higher is better).

---

### search_recipes_text

Full-text search using PostgreSQL tsvector.

```sql
search_recipes_text(
  search_query TEXT,
  user_uuid UUID,
  max_results INT DEFAULT 10
)
```

**Returns:** Matching recipes ranked by `ts_rank` relevance.

---

### search_recipes_by_ingredients

Search recipes by ingredient names.

```sql
search_recipes_by_ingredients(
  ingredient_list TEXT[],
  user_id UUID,
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 10
)
```

**Returns:** Recipes containing the specified ingredients, ranked by match.

---

### find_similar_recipes

Find recipes similar to a given recipe.

```sql
find_similar_recipes(
  recipe_id UUID,
  user_id UUID,
  similarity_threshold FLOAT DEFAULT 0.7,
  max_results INT DEFAULT 5
)
```

**Returns:** Similar recipes (excludes the input recipe).

---

### get_recipe_recommendations

Preference-based recipe recommendations.

```sql
get_recipe_recommendations(
  user_id UUID,
  preference_difficulty VARCHAR DEFAULT NULL,
  preference_tags TEXT[] DEFAULT NULL,
  max_prep_time_minutes INT DEFAULT NULL,
  limit_count INT DEFAULT 10
)
```

**Scoring:** difficulty match (1.0/0.5) + tags match (1.0/0.5) + rating/5 + prep_time constraint (1.0/0.3)

**Returns:** Ranked recipe recommendations with `recommendation_score`.

---

## Frontend API Client

`src/services/api.ts` — singleton HTTP client wrapping Supabase calls.

### Recipes

| Method | Description |
|--------|-------------|
| `getRecipes()` | List all user recipes |
| `getRecipe(id)` | Get single recipe by ID |
| `createRecipe(data)` | Create new recipe |
| `updateRecipe(id, data)` | Update existing recipe |
| `deleteRecipe(id)` | Delete recipe |
| `searchRecipes(query)` | Search recipes (text) |

### Chat

| Method | Description |
|--------|-------------|
| `sendMessage(data)` | Send chat message |
| `getChatHistory(limit)` | Get conversation list |
| `getConversationMessages(id)` | Get messages for conversation |
| `deleteConversation(id)` | Delete conversation |

### Meal Plans

| Method | Description |
|--------|-------------|
| `getMealPlans()` | List all meal plans |
| `createMealPlan(data)` | Create new meal plan |

### Preferences

| Method | Description |
|--------|-------------|
| `getPreferences()` | Get user preferences |
| `updatePreferences(data)` | Update preferences |

### Images

| Method | Description |
|--------|-------------|
| `uploadImage(file, userId)` | Upload to `recipe-images` bucket |

### RAG

| Method | Description |
|--------|-------------|
| `ragSearch(request)` | Semantic/text/hybrid search |
| `ragEmbedding(request)` | Generate recipe embedding |
| `ragSimilar(recipeId, userId, limit)` | Find similar recipes |
| `ragIngredients(ingredients, userId, limit)` | Ingredient-based search |
| `ragRecommendations(userId, preferences, limit)` | Get recommendations |

### Field Mapping

The API client automatically converts between frontend camelCase and database snake_case:
- `userId` ↔ `user_id`
- `prepTime` ↔ `prep_time`
- `createdAt` ↔ `created_at`
- etc.

---

## OpenRouter API

**Base URL:** `https://openrouter.ai/api/v1`
**Client:** `src/lib/openrouter.ts`

### Models Used

| Model ID | Purpose |
|----------|---------|
| `qwen/qwen-3-8b` | Text chat, intent detection |
| `qwen/qwen-2.5-vl-7b-instruct` | Vision (recipe image extraction) |
| `qwen/qwen-2.5-7b-instruct` | JSON structured output |

### Client Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `chat` | `(systemPrompt, message, model?)` | Simple text completion |
| `chatWithHistory` | `(systemPrompt, history, message, model?)` | Multi-turn conversation |
| `chatWithImages` | `(systemPrompt, message, images, model?)` | Vision/multi-modal |
| `chatJSON` | `(systemPrompt, message, model?)` | Structured JSON output |
| `chatCompletion` | `(options)` | Raw API call |

### Embedding Model

| Model | Dimensions | Purpose |
|-------|-----------|---------|
| `text-embedding-ada-002` | 1536 | Recipe embeddings for semantic search |

Generated via `src/services/embeddingService.js` methods:
- `generateEmbedding(text)` — single text
- `generateEmbeddings(texts)` — batch
- `generateRecipeEmbedding(recipe)` — recipe-specific (concatenates title + description + ingredients + instructions)
