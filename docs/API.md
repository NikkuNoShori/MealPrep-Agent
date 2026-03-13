# API Reference

> Edge functions, RPC contracts, OpenRouter endpoints, and request/response shapes for MealPrep Agent.

**Last reviewed:** 2026-03-12
**Last updated:** 2026-03-12 (removed isPublic/is_public mapping — column dropped in migration 013)

---

## Edge Functions

### POST `/functions/v1/chat-api/message`

Main chat endpoint with intent routing and multi-modal support.

**Location:** `supabase/functions/chat-api/index.ts`

**Headers:**
```
Authorization: Bearer <supabase-jwt>
Content-Type: application/json
apikey: <supabase-anon-key>
```

**Request body:**
```json
{
  "message": "string (required unless images provided)",
  "images": ["base64-data-url (optional, max 4)"],
  "sessionId": "string (optional — groups messages into a conversation)",
  "intent": "recipe_extraction (optional — force intent, otherwise AI detects)",
  "context": {
    "conversationId": "uuid (optional — resume existing conversation)",
    "recentMessages": ["array (optional — recent message context)"],
    "metadata": {}
  }
}
```

**Response:**
```json
{
  "message": "Message processed successfully",
  "response": {
    "id": "uuid",
    "content": "string (AI response text)",
    "sender": "ai",
    "timestamp": "ISO 8601"
  },
  "recipe": { "..." },
  "recipes": [{ "..." }, { "..." }],
  "conversationId": "uuid",
  "sessionId": "string",
  "intentMetadata": {
    "source": "ai | manual",
    "detectedIntent": "recipe_extraction | rag_search | general_chat",
    "reason": "string",
    "confidence": 0.95
  },
  "title": "string (AI-generated conversation title, first message only)"
}
```

**`recipe` object shape:**
```json
{
  "title": "string",
  "description": "string | null",
  "ingredients": [{"name": "...", "amount": 1, "unit": "cup", "category": "pantry", "notes": ""}],
  "instructions": ["step 1", "step 2"],
  "prepTime": 15,
  "cookTime": 30,
  "totalTime": 45,
  "servings": 4,
  "difficulty": "easy | medium | hard",
  "cuisine": "string | null",
  "tags": ["string"],
  "nutrition": {"calories": 350, "protein": 12, "carbs": 45, "fat": 10},
  "imageUrl": "string | null"
}
```

**Multi-recipe:** When multiple recipes are extracted, `recipes` contains an array of recipe objects (max 5). The first recipe is also in `recipe` for backwards compatibility. `recipes` is omitted when only one recipe is found.

**Intent routing:**
| Intent | Model | Behavior |
|--------|-------|----------|
| `recipe_extraction` | `qwen/qwen-2.5-vl-7b-instruct` (vision) or `qwen/qwen-2.5-7b-instruct` (text) | Delegates to `recipe-pipeline/extract-only` for structured recipe extraction |
| `rag_search` | `qwen/qwen-2.5-7b-instruct` | Hybrid search (semantic + text) via Supabase RPCs, then contextual AI response |
| `general_chat` | `qwen/qwen-2.5-7b-instruct` | Direct OpenRouter chat with conversation history |

**Error responses:**
- `401` — Missing or invalid JWT
- `400` — Missing required `message` field (when no images provided)
- `500` — Internal error (OpenRouter failure, DB error)

---

### GET `/functions/v1/chat-api/history`

Get conversation list or messages for a specific conversation.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `conversationId` | uuid | If provided, returns messages for this conversation |
| `limit` | number | Max conversations to return (default 50) |

---

### DELETE `/functions/v1/chat-api/history`

Delete a conversation or all history.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `conversationId` | uuid | If provided, deletes only this conversation. Otherwise deletes all. |

---

### POST `/functions/v1/recipe-pipeline/ingest`

Full pipeline: adapter → extract → transform → load.

**Location:** `supabase/functions/recipe-pipeline/`

**Request body:**
```json
{
  "source_type": "text | url | video",
  "text": "string (required for text source_type)",
  "url": "string (required for url source_type)",
  "images": ["base64-data-url (optional, max 4, for text source_type)"],
  "video_url": "string (for video source_type)",
  "frame_urls": ["string (for video source_type)"],
  "transcript": "string (for video source_type)",
  "auto_save": true
}
```

**Response (`PipelineResult`):**
```json
{
  "success": true,
  "recipe_id": "uuid (if auto_save)",
  "recipe": { "ValidatedRecipe object" },
  "recipe_ids": ["uuid", "uuid"],
  "recipes": [{ "ValidatedRecipe" }, { "ValidatedRecipe" }],
  "source_metadata": {
    "source_type": "text | url | video",
    "source_url": "string | undefined",
    "extracted_at": "ISO 8601",
    "adapter_version": "1.0.0"
  },
  "errors": [{"stage": "extract", "code": "EXTRACTION_FAILED", "message": "..."}]
}
```

**Multi-recipe:** When `auto_save: false`, multiple recipes return in `recipes[]`. When `auto_save: true`, each recipe is saved independently; per-recipe load errors appear in `errors[]` without failing the batch.

### POST `/functions/v1/recipe-pipeline/extract-only`

Same as `/ingest` but with `auto_save: false` — extract and validate without saving to DB.

---

## Image Handling

### Constraints

| Parameter | Value | Enforced At |
|-----------|-------|-------------|
| Max images per message | 4 | Frontend + text adapter |
| Max file size (raw) | 5 MB | Frontend validation |
| Max dimension after compression | 1200px (longest side) | Frontend compression |
| Compression format | JPEG, quality 0.8 | Frontend compression |
| Accepted types | `image/*` | Frontend validation |

### Image Flow

1. **Select/Paste** → `validateAndCompressImage()` validates type, size, compresses via canvas
2. **Send** → converted to base64 data URL via `FileReader.readAsDataURL()`
3. **Extract** → sent to vision model (`qwen/qwen-2.5-vl-7b-instruct`) as `image_url` content parts
4. **Save** (optional) → on recipe save, first user image uploaded to Supabase Storage (`recipe-images` bucket), public URL set as recipe `image_url`

### Image Upload

`apiClient.uploadImage(file, folder)` — uploads to `recipe-images` bucket in Supabase Storage.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `file` | File | required | Image file to upload |
| `folder` | string | `"recipes"` | Subfolder within the bucket |

Returns the public URL of the uploaded image.

---

## Multi-Recipe Support

### Detection

The extract stage checks for a `"recipes"` key in the LLM response. If found with >1 item, returns `ExtractedRecipe[]`.

| Parameter | Value |
|-----------|-------|
| Max recipes per request | 5 |
| Response key (single) | `"recipe"` |
| Response key (multiple) | `"recipes"` |

### Pipeline Behavior

- Each recipe is transformed and loaded independently
- Per-recipe errors don't fail the batch
- `PipelineResult.recipe` contains the first recipe (backwards compatible)
- `PipelineResult.recipes` contains all recipes

### Frontend Behavior

- Each recipe renders as a separate `StructuredRecipeDisplay` card
- Each card has an independent "Save Recipe" button
- Save feedback is per-card (toast + injected message)

---

## System Prompts

All AI behavior is controlled by system prompts. Edit these files to customize the AI persona.

### Active Prompts (Backend — used in production)

**File:** `supabase/functions/_shared/recipe-prompts.ts`

| Export | Used By | Purpose |
|--------|---------|---------|
| `RECIPE_EXTRACTION_PROMPT` | Extract stage (text) | Structured recipe extraction from text input |
| `IMAGE_EXTRACTION_PROMPT` | Extract stage (images) | Specialized extraction for cookbook pages, handwritten notes, screenshots |
| `INTENT_DETECTION_PROMPT` | Chat API | Classifies user messages as `recipe_extraction`, `rag_search`, or `general_chat` |
| `GENERAL_CHAT_PROMPT` | Chat API | Conversational cooking assistant persona |

> **Note:** Legacy frontend prompts that previously lived in `src/prompts/` have been removed. All prompt configuration is in the single backend file above.

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
  similarity_threshold FLOAT DEFAULT 0.6,
  max_results INT DEFAULT 5
)
```

**Returns:** Similar recipes (excludes the input recipe) with `similarity_score`. Returns empty if no recipes exceed the threshold or if the target recipe has no embedding vector.

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
| `getRecipe(idOrSlug)` | Get single recipe by UUID or URL slug |
| `createRecipe(data)` | Create new recipe |
| `updateRecipe(id, data)` | Update existing recipe |
| `deleteRecipe(id)` | Delete recipe |
| `searchRecipes(query)` | Search recipes (text) |
| `checkDuplicateRecipe(title, excludeId?)` | Check if recipe name already exists |

### Chat

| Method | Description |
|--------|-------------|
| `sendMessage(data)` | Send chat message (text + optional images) |
| `addRecipeViaChat(data)` | Shortcut: send text with `recipe_extraction` intent |
| `getChatHistory(limit)` | Get conversation list |
| `getConversationMessages(id)` | Get messages for conversation |
| `deleteConversation(id)` | Delete conversation |
| `clearChatHistory()` | Delete all conversations |

### Recipe Pipeline

| Method | Description |
|--------|-------------|
| `ingestRecipeFromUrl(url, autoSave)` | Extract recipe from URL |
| `ingestRecipeFromText(text, images?, autoSave)` | Extract recipe from text/images |
| `ingestRecipeFromVideo(data, autoSave)` | Extract recipe from video |
| `extractRecipeOnly(sourceType, data)` | Extract without saving |

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
| `uploadImage(file, folder)` | Upload to `recipe-images` bucket |

### RAG

| Method | Description |
|--------|-------------|
| `ragSearch(request)` | Semantic/text/hybrid search |
| `ragEmbedding(request)` | Generate recipe embedding |
| `ragSimilar(recipeId, userId, limit)` | Find similar recipes |
| `ragIngredients(ingredients, userId, limit)` | Ingredient-based search |
| `ragRecommendations(userId, preferences, limit)` | Get recommendations |

### Households

| Method | Description |
|--------|-------------|
| `getMyHousehold()` | Get user's household with members and dependents |
| `updateHousehold(id, data)` | Update household name |
| `createHouseholdInvite(householdId, email)` | Send invite to email |
| `getMyPendingInvites()` | Get invites addressed to current user |
| `respondToInvite(inviteId, accept)` | Accept or decline invite |
| `updateRecipeVisibility(recipeId, visibility)` | Set recipe visibility (private/household/public) |

**React Query hooks:** `useMyHousehold`, `useUpdateHousehold`, `useCreateHouseholdInvite`, `useMyPendingInvites`, `useRespondToInvite`, `useUpdateRecipeVisibility`

### Recipe Collections

| Method | Description |
|--------|-------------|
| `getMyCollections()` | Get all collections owned by the current user |
| `getCollection(collectionId)` | Get a single collection by ID |
| `getCollectionRecipes(collectionId)` | Get recipes in a collection (with full recipe data) |
| `createCollection(name, description?, icon?)` | Create a new collection |
| `updateCollection(collectionId, updates)` | Update collection name, description, icon, or visibility |
| `deleteCollection(collectionId)` | Delete a collection (recipes are not deleted) |
| `addRecipeToCollection(collectionId, recipeId)` | Add a recipe to a collection |
| `removeRecipeFromCollection(collectionId, recipeId)` | Remove a recipe from a collection |

**React Query hooks:** `useMyCollections`, `useCollection`, `useCollectionRecipes`, `useCreateCollection`, `useUpdateCollection`, `useDeleteCollection`, `useAddRecipeToCollection`, `useRemoveRecipeFromCollection`

### Field Mapping

The API client automatically converts between frontend camelCase and database snake_case:
- `userId` ↔ `user_id`
- `prepTime` ↔ `prep_time`
- `cookTime` ↔ `cook_time`
- `totalTime` ↔ `total_time`
- `imageUrl` ↔ `image_url`
- `nutritionInfo` ↔ `nutrition_info`
- `sourceUrl` ↔ `source_url`
- `visibility` ↔ `visibility`
- `householdId` ↔ `household_id`
- `managedBy` ↔ `managed_by`
- `createdAt` ↔ `created_at`
- `updatedAt` ↔ `updated_at`

---

## OpenRouter API

**Base URL:** `https://openrouter.ai/api/v1`
**Backend Client:** `supabase/functions/_shared/openrouter-client.ts`
**Frontend Client (legacy):** `src/lib/openrouter.ts`

### Models Used

| Model ID | Purpose | Used In |
|----------|---------|---------|
| `qwen/qwen-2.5-7b-instruct` | Intent detection, general chat, RAG responses, text extraction | Chat API, Extract stage |
| `qwen/qwen-2.5-vl-7b-instruct` | Vision — recipe image extraction, video frame OCR | Extract stage (when images present) |

### Client Methods (Backend)

| Method | Signature | Description |
|--------|-----------|-------------|
| `chat` | `(systemPrompt, message, model, options?)` | Simple text completion |
| `chatWithHistory` | `(systemPrompt, history, message, model, options?)` | Multi-turn conversation |
| `chatWithImages` | `(systemPrompt, message, images, model, options?)` | Vision/multi-modal (max 4 images) |
| `generateEmbedding` | `(text)` | Generate embedding vector |

### LLM Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `temperature` | number | varies | Randomness (0.1 for extraction, 0.5-0.7 for chat) |
| `max_tokens` | number | varies | Max response tokens (4000 for extraction, 500-800 for chat) |
| `response_format` | object | — | `{ type: "json_object" }` for structured extraction |

### Embedding Model

| Model | Dimensions | Purpose |
|-------|-----------|---------|
| `text-embedding-ada-002` | 1536 | Recipe embeddings for semantic search |

Generated via `src/services/embeddingService.js` methods:
- `generateEmbedding(text)` — single text
- `generateEmbeddings(texts)` — batch
- `generateRecipeEmbedding(recipe)` — recipe-specific (concatenates title + description + ingredients + instructions)

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `OPENROUTER_API_KEY` | Yes (edge functions) | OpenRouter API key for LLM calls |
