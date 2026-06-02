# MealPrep Context

> Concrete map of the current MealPrep AI architecture. Update when the architecture changes.

**Last verified:** 2026-06-01

## Stack

- **Frontend:** React 18 + TypeScript + Vite. State: Zustand (client) + React Query (server).
- **Backend:** Supabase (PostgreSQL + Edge Functions on Deno).
- **LLM provider:** OpenRouter, primarily Qwen 2.5 family.
- **Embeddings:** OpenAI `text-embedding-ada-002` (1536-dim).
- **Vector store:** `pgvector` on PostgreSQL.

## Edge functions (where AI lives)

```
supabase/functions/
├── _shared/
│   ├── openrouter-client.ts      # OpenRouterClient class + createOpenRouterClient()
│   ├── embedding-utils.ts        # Embedding generation helpers
│   ├── recipe-prompts.ts         # PROMPT REGISTRY — all prompts live here
│   ├── recipe-schema.ts          # Recipe extraction schema (validation)
│   ├── cors.ts
│   └── supabase-client.ts
├── chat-api/
│   └── index.ts                  # Intent router (current) → tool-using agent (proposed)
├── recipe-pipeline/
│   ├── index.ts                  # Entry point
│   ├── pipeline.ts               # Orchestrates extract → transform → load
│   ├── adapters/
│   │   ├── url-adapter.ts        # URL → text/HTML
│   │   ├── text-adapter.ts       # User-pasted text
│   │   └── video-adapter.ts      # Video frames → OCR text
│   └── stages/
│       ├── extract.ts            # Text/HTML → structured recipe JSON
│       ├── transform.ts          # Normalize, validate, enrich
│       └── load.ts               # Persist + embed
├── admin-api/
└── household-invite/
```

### chat-api current flow

```
POST /chat-api/message
  ↓
detectIntent(message)              [LLM call: qwen-2.5-7b-instruct, JSON, t=0.1]
  ↓
switch (intent):
  case recipe_extraction → invoke recipe-pipeline
  case rag_search        → handleRAGSearch (embedding + RPC + LLM)
  case general_chat      → handleGeneralChat (LLM)
  ↓
maybeGenerateTitle (first message only)  [LLM call: qwen-2.5-7b-instruct, t=0.3, 20 tokens]
  ↓
return response
```

Limitation: single intent per turn. No tool use. No multi-step plans.

### recipe-pipeline current flow

```
POST /recipe-pipeline/{ingest|extract-only}
  ↓
adapter (url|text|video) → raw text + optional images
  ↓
extract stage  [LLM call: qwen-2.5-7b text, OR qwen-2.5-vl-7b vision]
  ↓ (validates against recipe schema)
transform stage  (normalize units, enrich tags)
  ↓
load stage  (insert + embedding)
  ↓
return recipe(s)
```

## Models in use

| Model | Used for | Settings |
|---|---|---|
| `qwen/qwen-2.5-7b-instruct` | Intent detection, RAG response, general chat, conversation titles, text extraction | JSON mode for structured calls, t=0.1; t=0.7 for chat |
| `qwen/qwen-2.5-vl-7b-instruct` | Image / video frame extraction | t=0.1, JSON mode |
| `google/gemini-2.0-flash-001` | Vision fallback when qwen-vl fails | t=0.1, JSON mode |
| `text-embedding-ada-002` | Recipe embeddings, RAG query embeddings | 1536-dim |

## RPCs (database tools the bot uses)

These already exist and can be wrapped as tools in a tool-using agent:

| RPC | What it does | Used by |
|---|---|---|
| `search_recipes_semantic(query_embedding, user_id, threshold, limit)` | Cosine similarity search | chat-api RAG |
| `search_recipes_text(query, user_id, limit)` | Postgres full-text search | chat-api RAG fallback |
| `hybrid_search(embedding, query, user_id, limit)` | Semantic + text combined | chat-api RAG |
| `search_recipes_by_ingredients(ingredients[], user_id, limit)` | Find recipes that match given pantry | Not used by any UI today |
| `find_similar_recipes(recipe_id, user_id, threshold, limit)` | Given a recipe, find similar ones | Used in `StructuredRecipeDisplay` (similarity check on save) |
| `get_recipe_recommendations(user_id, preferences, limit)` | Personalized scoring | Not used by any UI today |
| `get_my_household()` | Returns household + members + invites | Household page |
| `toggle_recipe_reaction(recipe_id, reaction_type)` | Atomic upsert/delete reaction | Recipe card |

**Critical:** several RPCs accept a `user_id` parameter. This is a privilege escalation vector. When wrapping as tools, **strip `user_id` and force `auth.uid()` server-side**. See MOP-0007 (proposed) for the fix.

## `meal_plans` schema shape

`meal_plans` is one row per plan, with `meals` and `grocery_list` stored as JSONB columns (per migration `20251201000000_001_core_schema.sql:136`) — NOT as normalized child tables. Tool catalogs, queries, and tool handlers must accommodate JSONB read-modify-write patterns:

- `meals` is keyed by date string, with sub-keys per slot (`breakfast` / `lunch` / `dinner` / `snack`) pointing at `recipe_id`.
- `grocery_list` is an array of item objects with `{ item, amount, unit, category, source }` shape.
- No FK to `recipes` from inside the JSONB — a deleted recipe can leave a dangling `recipe_id`. Handle gracefully on read.
- Concurrent edits use last-write-wins on the whole row. Two household members editing the same week can lose each other's writes.

**Normalization is a documented follow-on (MOP-0011, deferred).** When designing features that need cross-plan aggregation, per-row RLS, or concurrent-edit safety, check whether MOP-0011's trigger conditions have fired. If yes, the normalization migration takes priority over building on JSONB.

## Prompts registry

All prompts live in `supabase/functions/_shared/recipe-prompts.ts`. Current contents:

- `INTENT_DETECTION_PROMPT` — used by chat-api `detectIntent()`
- `RECIPE_EXTRACTION_PROMPT` — used by recipe-pipeline text extraction
- `IMAGE_EXTRACTION_PROMPT` — used by recipe-pipeline vision extraction
- `GENERAL_CHAT_PROMPT` — Chef Marcus persona for general_chat
- *(Missing — inline in chat-api/index.ts:)* `RAG_RESPONSE_PROMPT` — should be moved here

Rule: **no inline prompts in edge function code.** Every prompt goes in this file. If a prompt is inline, flag it and propose the migration.

## Auth model

- Frontend: Supabase Auth (Google OAuth + email/password).
- Edge functions: receive JWT in `Authorization: Bearer <token>` header.
- Edge functions extract the user via `supabase.auth.getUser(token)`.
- All subsequent DB operations use the user's auth context — RLS enforces visibility.
- `SECURITY DEFINER` functions: must include `SET search_path = public` (migration 026 retrofitted this).

## RLS policy summary

Every table has RLS enabled. Visibility model for recipes:

| Visibility | Who can read | Who can write |
|---|---|---|
| `private` | Owner only | Owner only |
| `household` | Household members | Owner only |
| `public` | All authenticated users | Owner only |

When designing bot tools that surface recipes, respect these. RAG should never return a recipe the user can't see.

## Cost shape (rough, 2026-06)

| Operation | Approx cost | Notes |
|---|---|---|
| Intent detection | ~$0.0001 | 150 tokens, t=0.1 |
| RAG response (with embedding) | ~$0.0005 | Embedding + LLM |
| General chat | ~$0.0010 | Up to 500 tokens |
| Text extraction | ~$0.003 | 6k char input, up to 4k token output |
| Vision extraction (image) | ~$0.020 | 4 images, 4k token output |
| Vision extraction (video) | ~$0.080 | Multiple frames |
| Conversation title | ~$0.00005 | 20 tokens |

Dominant cost driver: recipe extraction (especially vision/video). Optimize there first.

## MOPs that depend on this context

- **MOP-0003** — Dietary Profiles & Allergen Detection (draft). Will add allergen LLM-fallback to extraction.
- **MOP-0007** (proposed) — Wire RAG into Recipes page + Meal Planner suggestions.
- **MOP-0008** (proposed) — Chat intent-routing → tool-use migration.
- **MOP-0009** (proposed) — Dev automation expansion.

When working on any of these, this context file is required reading.

## What NOT to change without an architectural review

- The "edge functions only" rule for AI calls.
- The prompt registry location (`_shared/recipe-prompts.ts`).
- The schema validation pattern on extraction.
- The RLS-as-security-boundary stance.
- The single-Supabase-client pattern in edge functions (no parallel clients with different auth).

If a design requires changing any of these, surface the conflict to the user before implementing.
