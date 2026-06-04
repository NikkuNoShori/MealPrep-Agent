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
| Manual edit via API client | None — `apiClient.updateRecipe` does not regenerate | Recipe edits via the frontend (RecipeDetail edit) update the row but do NOT regenerate the embedding |
| Backfill job | **DOES NOT EXIST IN CURRENT CODE** | See critical issue below |

## 🚨 CRITICAL ISSUE — No embedding backfill

### The pathology

- Migration 004:68-85 defines `update_recipe_embedding` trigger that **NULLs `embedding_vector`** whenever `title`, `description`, `ingredients`, `instructions`, or `tags` change.
- Nothing re-generates the embedding after that NULL.
- Result: every recipe a user has ever edited (after initial save) has `embedding_vector IS NULL` and is **invisible to semantic search** — the `WHERE r.embedding_vector IS NOT NULL` filter in `search_recipes_semantic` (migration 004:224) and `find_similar_recipes` (migration 004:297) drops it.

### Impact on each surface

| Surface | Behavior when embeddings are stale |
|---|---|
| Chat agent `search_recipes` | Hybrid path silently falls back to text-only (semantic returns 0; text returns whatever it has). User sees results, just missing the semantic signal. |
| Recipe save flow `checkSimilarRecipes` | Embedding generated at save (load stage) so this is fine for NEWLY saved recipes. For users with mostly-old recipes, the duplicate check could miss matches. |
| `find_similar_recipes` rail (proposed in MOP-0007 Phase 2) | **Will show nothing** when the source recipe's vector is NULL. Empty rail = bad UX. |
| `search_recipes_semantic` standalone | Returns 0 results for any user whose recipes are all edited. |

### The longer a user uses the app, the worse it gets

Initial saves get embeddings. Every edit nulls the vector and nothing repopulates. Steady-state for an active user: most recipes have null vectors → semantic search is effectively useless for them.

### Mitigation paths (recommend; do not implement)

1. **Short-term (minimal change):** modify the trigger to set a boolean flag `needs_reembed` instead of nulling the vector. Keep the stale vector queryable for searches while the flag indicates regeneration is needed.
2. **Medium-term (proper fix):** scheduled Supabase Edge Function (cron) that scans `WHERE embedding_vector IS NULL OR needs_reembed = true` and regenerates in batches. Bound by API rate limits.
3. **Tactical (during refactor):** regenerate on the edit path — when `apiClient.updateRecipe` is called and any embedding-affecting field changes, call the embedding service inline. Adds 200-400ms to save latency.

### `[verify]` external workers

The SME-build agent's read pass found no in-repo backfill. **Confirm with user** whether a scheduled function in the Supabase Dashboard or an external worker (n8n, etc.) handles this. If yes, the pipeline is healthy; if no, this is a real bug.

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
    → embedding_vector := NULL
    → ❌ Vector nulled, never regenerated

[Semantic search runs]
    → WHERE embedding_vector IS NOT NULL filter
    → Edited recipe excluded
    → Result: missing from semantic results
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
