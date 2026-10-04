# RAG Pipeline — Embedding Lifecycle

> How embeddings flow through MealPrep Agent. Source-of-truth files: `supabase/migrations/20251201000003_004_search_and_embeddings.sql`, `supabase/functions/_shared/embedding-utils.ts`, `supabase/functions/recipe-pipeline/stages/load.ts`.

## Model + dimensions

- **Model:** `text-embedding-ada-002` (OpenAI, via OpenRouter)
- **Dimensions:** 1536
- **Generator:** `supabase/functions/_shared/openrouter-client.ts` (verify exact method name + line) — wrapped by `generateRecipeEmbedding` in `_shared/embedding-utils.ts`
- **Cost:** ~$0.0001 per embedding generation

## Storage — TWO embedding tables exist, ONLY ONE IS LIVE

| Storage location | Dimension | Live in current code? | Notes |
|---|---|---|---|
| `recipes.embedding_vector` column | 1536 | ✅ Yes — this is the live path | Written by recipe-pipeline load stage; read by `search_recipes_semantic` + `find_similar_recipes` RPCs |
| `recipe_embeddings` table (`embedding` column) | 384 | ❌ No — orphan | Defined in migration 004:10-18; `search_similar_recipes` RPC (migration 004:105-135) reads it; **no current Deno edge-function code writes to it**. Likely leftover from an earlier smaller-model architecture. `[verify]` whether external integrations (n8n, retired `server.js`) use it before dropping. |

When asked "where are embeddings stored?", answer `recipes.embedding_vector` (1536-dim) and explicitly note the orphan table.

## Embedding content — what goes into the vector

Source: `_shared/embedding-utils.ts` `createRecipeText` (read the file to confirm exact field order and current shape).

The embedded text concatenates:
- Title
- Description
- Cuisine
- Difficulty
- Tags (joined)
- Ingredients (flattened — each ingredient object's text representation)
- Instructions (joined)

`[verify]` exact field list against current `embedding-utils.ts` — fields may have shifted as the recipe schema evolved.

**Why this matters for diagnosis:** if a user added a tag to a recipe and it's not surfacing in semantic search results for that tag, the cause might be: (1) the embedding includes tags so it SHOULD work — verify the embedding was actually regenerated after the tag was added (see no-backfill below); (2) the embedding's tag contribution is small relative to title+ingredients+instructions, so the tag signal is weak.

## Embedding generation triggers

| Trigger | Where | When |
|---|---|---|
| Recipe save via recipe-pipeline | `supabase/functions/recipe-pipeline/stages/load.ts:33-34` | At every successful recipe insert via the pipeline (chat extraction path, etc.). Non-fatal — if `generateRecipeEmbedding` throws, the recipe still saves with `embedding_vector = NULL` |
| Manual edit via API client | None — `apiClient.updateRecipe` does not regenerate inline | Recipe edits via the frontend (RecipeDetail edit) set `needs_reembed = true`; the async refresh job regenerates within 5 minutes |
| Async refresh job | `supabase/functions/embedding-refresh/index.ts` | Scheduled every 5 min; picks up all rows where `needs_reembed = true`, regenerates, clears flag |

## Embedding refresh lifecycle (MOP-0015 — shipped 2026-09-06)

**Previous behavior (FIXED):** the `update_recipe_embedding` trigger nulled `embedding_vector` on edit. Nothing regenerated it. Edited recipes became permanently invisible to semantic search.

**Current behavior:** the trigger sets `needs_reembed = true` instead of nulling. The stale vector stays queryable. The `embedding-refresh` edge function runs on a 5-minute cron, regenerates embeddings for all flagged rows in batches of 50, and clears the flag. Recipes are invisible to semantic search for at most ~5 minutes after an edit, then reappear with a fresh vector.

**Migration 029** (`20260604000001_029_embedding_refresh_lifecycle.sql`):
- Adds `recipes.needs_reembed BOOLEAN NOT NULL DEFAULT false`
- Replaces trigger function body (no longer nulls vector)
- Adds partial index `idx_recipes_needs_reembed` for fast cron scans
- One-time backfill: `UPDATE recipes SET needs_reembed = true WHERE embedding_vector IS NULL`

**Operational diagnostics:** RUNBOOK § "Embedding refresh: job not processing flagged recipes"

## Embedding lifecycle summary diagram

```
[Recipe extraction in chat]
    → recipe-pipeline/stages/load.ts:33-34
    → generateRecipeEmbedding(openRouter, recipe)
    → INSERT INTO recipes (embedding_vector = '[...]')
    → ✅ Vector populated

[User edits the recipe via UI]
    → apiClient.updateRecipe (api.ts)
    → UPDATE recipes SET title='new'...
    → trigger update_recipe_embedding fires
    → needs_reembed := true  (vector kept intact)
    → ⏳ Stale vector still queryable

[embedding-refresh cron fires (every 5 min)]
    → SELECT ... WHERE needs_reembed = true LIMIT 50
    → generateRecipeEmbedding(openRouter, row)
    → UPDATE recipes SET embedding_vector = '[new]', needs_reembed = false
    → ✅ Fresh vector, recipe visible in semantic search again

[Semantic search runs]
    → WHERE embedding_vector IS NOT NULL filter
    → Edited recipe included (stale or fresh vector, either is valid)
    → Result: recipe present in semantic results within ~5 min of edit
```

## RPCs that consume embeddings (all read `recipes.embedding_vector`)

- `search_recipes_semantic` (migration 004:173-229) — query → similarity search. Migration default threshold 0.7; handler overrides to 0.5 (handlers.ts:58 — `[verify]`)
- `find_similar_recipes` (migration 004:234-302) — recipe id → similar recipes. Migration default threshold 0.6; handler overrides to 0.4 (handlers.ts:178 — `[verify]`)

## RPCs that do NOT consume embeddings (commonly mistaken as RAG)

- `search_recipes_text` — full-text via `ts_vector` on `searchable_text` column (migration 004:140-168). NO embedding generation needed. ~30-80ms.
- `search_recipes_by_ingredients` — full-text via `ts_rank` (migration 004:307-367). NO embedding. ~40-100ms.
- `get_recipe_recommendations` — pure SQL scoring formula (migration 004:372-435): difficulty match + tag overlap + rating + prep_time fit. NO embedding. ~20-60ms.
- `search_similar_recipes` (384-dim) — orphan, see above.

When recommending wiring or troubleshooting, distinguish embedding-based RPCs from text/scoring RPCs explicitly.

## Search-side embedding generation

Both the chat agent's `search_recipes` tool and the recipe save flow's `checkSimilarRecipes` generate a query embedding at call time. This is where the 250-500ms RAG latency comes from — it's the embedding generation, not the vector search itself.

- `search_recipes` (handlers.ts ~45-55): generates embedding via `ctx.openRouter.generateEmbedding(query)`. On embedding failure (logged via `console.warn`), the path falls back to text-only without failing the request.
- `checkSimilarRecipes` (`apiClient.checkSimilarRecipes` calls a recipe-pipeline endpoint — verify exact path in api.ts:899 and the pipeline target).

`find_similar_recipes` does NOT generate a query embedding — it reads the source recipe's stored embedding and searches from there. That's why it's faster (~50-100ms total).
