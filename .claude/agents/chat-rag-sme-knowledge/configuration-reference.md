# Configuration Reference

> Every tunable knob in the chat + RAG system, in one place, with file:line citations. Source-of-truth for "what's the current value?" queries.

## Embeddings

| Knob | Value | Source |
|---|---|---|
| Model | `text-embedding-ada-002` (OpenAI via OpenRouter) | `supabase/functions/_shared/openrouter-client.ts` (verify generateEmbedding method) |
| Dimensions | 1536 | Same |
| Storage column | `recipes.embedding_vector` | migration 004 (recipes table prior migrations) |
| Index | IVFFlat cosine, `lists = 100` | `migration 004:88-100` |
| Generation cost | ~$0.0001 per embedding | OpenAI pricing |
| Generation trigger | Recipe save via pipeline | `supabase/functions/recipe-pipeline/stages/load.ts:33-34` |
| Invalidation trigger | NULL on edit (title/desc/ingredients/instructions/tags changed) | `migration 004:68-85` |
| Backfill job | **DOES NOT EXIST IN REPO** — see `rag-pipeline.md` critical issue | `[verify external workers]` |

### Orphan embedding table

| Knob | Value | Source |
|---|---|---|
| `recipe_embeddings.embedding` | 384-dim vector | `migration 004:10-18` |
| Read by | `search_similar_recipes` RPC only | `migration 004:105-135` |
| Written by | **NOTHING in current Deno edge-function code** | `[verify external integrations]` |
| Status | Orphan / dead — likely leftover from earlier smaller-model architecture | Candidate for ADR + drop migration |

## Similarity thresholds (NOTE: migration defaults differ from runtime overrides)

| RPC | Migration default | Runtime override | Source |
|---|---|---|---|
| `search_recipes_semantic` | 0.7 | 0.5 (chat agent's `searchRecipes` handler) | `migration 004:177`; `handlers.ts:58` `[verify]` |
| `find_similar_recipes` | 0.6 | 0.4 (chat agent's `findSimilarRecipes` handler) | `migration 004:237`; `handlers.ts:178` `[verify]` |
| `search_recipes_by_ingredients` | 0.5 | (no current caller) | `migration 004:310` |
| `search_similar_recipes` (384-dim, orphan) | 0.7 | (no current caller) | `migration 004:108` |

**Migration defaults are dead code.** Nothing in production calls these RPCs without specifying a threshold. The override values are the actual production thresholds. When the user asks "what's the threshold for X?", give both citations.

## Hybrid search

| Knob | Value | Source |
|---|---|---|
| Strategy | Run semantic + text in parallel, dedupe by id, semantic-first ordering | `handlers.ts:53-88` `[verify]` |
| Weighting | **NONE** — dedupe-first, not weighted blend | Same; the 0.7/0.3 weighting from old `server.js` does NOT exist in current code |
| Fallback on embedding failure | Continue with text-only (silent — logged to console.warn) | `handlers.ts:47-50` `[verify]` |

When asked "what's the vector vs text weight?", the answer is "there isn't one in current code; old `server.js` had 0.7/0.3 but that path was retired per ADR-0004."

## Agent loop

| Knob | Value | Source |
|---|---|---|
| Model | `qwen/qwen-2.5-7b-instruct` | `agent-loop.ts` (top of file `[verify line]`) |
| Temperature (in loop) | 0.2 | `agent-loop.ts` `[verify line]` |
| `tool_choice` | `"auto"` | `agent-loop.ts` |
| Max tokens (in-loop call) | 1024 | `agent-loop.ts` `[verify line]` |
| Max tokens (closing call) | 600 | `agent-loop.ts` `[verify line]` |
| MAX_ITERS | 5 | `agent-loop.ts:21` (near constants) `[verify]` |
| Tool result wrapping | `<tool_result>{json}</tool_result>` | `agent-loop.ts:~69` `[verify]` |

## Tool catalog

| Knob | Value | Source |
|---|---|---|
| Total tools | 12 (11 always + 1 capability-gated) | `catalog.ts TOOL_CATALOG.length` |
| Effective tools when web search gate off | 11 | `catalog.ts available()` predicate |
| `DESTRUCTIVE_TOOLS` | `{update_recipe, delete_recipe}` | `catalog.ts DESTRUCTIVE_TOOLS` |
| `CONDITIONALLY_DESTRUCTIVE` | `{assign_recipe_to_meal_plan_slot}` | `catalog.ts CONDITIONALLY_DESTRUCTIVE` |
| Capability gate | `WEB_SEARCH_API_KEY` env var | `catalog.ts:337` `available()` predicate `[verify]` |

## Models used (across the entire AI surface)

| Use | Model | Where called | Temperature |
|---|---|---|---|
| Chat agent loop | `qwen/qwen-2.5-7b-instruct` | `agent-loop.ts` `[verify]` | 0.2 |
| Title generation (first chat msg) | `qwen/qwen-2.5-7b-instruct` | `chat-api/index.ts:322` `[verify]` | 0.3 |
| General chat (legacy `handleGeneralChat` — removed?) | — | post-MOP-0008, this path was deleted from `chat-api/index.ts` | n/a |
| Recipe extraction (text) | `qwen/qwen-2.5-7b-instruct` | `recipe-pipeline/stages/extract.ts` `[verify exact ID]` | 0.1 |
| Recipe extraction (image/vision) | `qwen/qwen-2.5-vl-7b-instruct` | `recipe-pipeline/stages/extract.ts` `[verify]` | 0.1 |
| Vision fallback | `google/gemini-2.0-flash-001` | `recipe-pipeline/stages/extract.ts` `[verify chain]` | 0.1 |
| Substitution suggestions (chat tool) | `qwen/qwen-2.5-7b-instruct` (per MOP-0008 design) | `handlers.ts proposeSubstitution` `[verify]` | 0.3 |

## Token budgets (verified where possible)

| Call | Max tokens | Notes |
|---|---|---|
| Agent loop, in-loop turn | 1024 | `agent-loop.ts` `[verify]` |
| Agent loop, closing turn | 600 | `agent-loop.ts` `[verify]` |
| Title generation | 20 | `chat-api/index.ts:322` area `[verify]` |
| Recipe extraction (text path) | 2000 | `_shared/openrouter-client.ts:197` `[verify]` |
| Recipe extraction (vision) | 4000 | Per MOP-0008 design / `[verify]` |
| Substitution | (verify against handler default) | `handlers.ts` |

## Capability gates

| Capability | Gate | Behavior when gate is off |
|---|---|---|
| Web search (`web_search_recipe` tool) | `WEB_SEARCH_API_KEY` env var present | Tool omitted from `TOOL_CATALOG`; model literally doesn't see it |
| (No other gates currently) | — | — |

## Frontend RAG-adjacent configuration

| Knob | Value | Source |
|---|---|---|
| Search bar mechanism | `title.toLowerCase().includes(query)` (client-side) | `src/components/recipes/RecipeList.tsx:60-68` |
| Filter chips | Client-side filter (dietary, prep time, difficulty) — actually wired | `src/components/recipes/RecipeList.tsx:70-93` |
| `apiClient.ragSearch` | **DEAD** — points at non-existent edge fn | `src/services/api.ts ragSearch`; per ADR-0004 |
| `apiClient.ragSimilar`, `ragRecommendations`, `ragIngredients` | **DEAD** — same | Same |

## What's NOT configurable today (would require code change)

- Hybrid search weighting (would have to be added; currently dedupe-only)
- Per-user threshold tuning
- Per-tool MAX_ITERS
- Streaming response (entire response is buffered)

## Drift watch

When investigating discrepancies between docs and code, check these high-drift areas first:

1. **Migration defaults vs handler overrides** — already noted; 4 RPCs affected.
2. **The 384-dim `recipe_embeddings` table** — referenced in migrations but never written; expectation of "RAG uses two tables" is wrong.
3. **Audit's claim of `0.7/0.3` hybrid weighting** — that was the old retired `server.js`. Current code dedupes only.
4. **`apiClient.rag*` methods in `api.ts`** — point at non-existent endpoints. Dead.
