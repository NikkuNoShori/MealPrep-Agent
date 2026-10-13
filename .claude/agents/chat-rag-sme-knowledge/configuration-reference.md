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
| Model | `AGENT_MODEL` (default `qwen/qwen3.7-plus`) → fallbacks `AGENT_MODEL_FALLBACKS` | imported from `_shared/models.ts` at `agent-loop.ts:22`; fallback loop at `agent-loop.ts:30` (verified 2026-10-12) |
| Temperature (in loop) | 0.2 | `agent-loop.ts:225` |
| `tool_choice` | `"required"` on iteration 1 **when images are attached**, else `"auto"` | `agent-loop.ts:213-219`. Exists so small models can't ignore the image hint and reply in prose. If an image upload yields prose instead of a recipe card, check this first. |
| `tool_choice` (closing call after MAX_ITERS) | `"none"` | `agent-loop.ts:348,357` |
| Max tokens (in-loop call) | 1024 | `agent-loop.ts:225` |
| Max tokens (closing call) | 600 | `agent-loop.ts:348,357` |
| MAX_ITERS | 5 | `agent-loop.ts:24` |
| Tool result wrapping | `<tool_result>{json}</tool_result>` | `wrapToolResult` at `agent-loop.ts:171` |

## Tool catalog

| Knob | Value | Source |
|---|---|---|
| Total tools | 12 (11 always + 1 capability-gated) | `catalog.ts TOOL_CATALOG.length` |
| Effective tools when web search gate off | 11 | `catalog.ts available()` predicate |
| `DESTRUCTIVE_TOOLS` | `{update_recipe, delete_recipe, update_member_allergens}` | `catalog.ts:768-772` (verified 2026-10-12) |
| `CONDITIONALLY_DESTRUCTIVE` | `{assign_recipe_to_meal_plan_slot}` | `catalog.ts:778-780` |
| Capability gate | `WEB_SEARCH_API_KEY` env var | `catalog.ts:337` `available()` predicate `[verify]` |

## Model registry — `_shared/models.ts` (single source of truth)

> Added 2026-10-12. At time of writing `models.ts` is **untracked/uncommitted** in the working tree. Verify it is on `main` before relying on these line refs. Every model slug in `chat-api` and `recipe-pipeline` now resolves here. **Env var overrides win over the file default.** On a model deprecation, update the default **and** run `supabase secrets unset <VAR>` (user runs this; never run it yourself), or a stale override silently brings the retired slug back.

| Token | Default | Env override | Consumers |
|---|---|---|---|
| `AGENT_MODEL` | `qwen/qwen3.7-plus` | `OPENROUTER_AGENT_MODEL` | `chat-api/agent-loop.ts:22,30` (must support tool calling) |
| `AGENT_MODEL_FALLBACKS` | `["qwen/qwen3.7-plus", "openai/gpt-4o-mini"]` | `OPENROUTER_AGENT_MODEL_FALLBACKS` (comma/space-separated) | `agent-loop.ts:30`. Every entry must support `tools`; vision-only models are invalid here |
| `UTILITY_TEXT_MODEL` | `qwen/qwen-2.5-7b-instruct` | `OPENROUTER_UTILITY_MODEL` | title generation `chat-api/index.ts:438,567`; substitution `tools/handlers.ts:766`; text extraction `recipe-pipeline/stages/extract.ts:96` |
| `DEFAULT_CHAT_MODEL` | `qwen/qwen3.7-plus` | `OPENROUTER_CHAT_MODEL` | `_shared/openrouter-client.ts` default param for chat / chatWithHistory / chatWithTools |
| `VISION_MODELS` | `["qwen/qwen3-vl-8b-instruct", "qwen/qwen2.5-vl-72b-instruct", "google/gemini-2.0-flash-001"]` | `OPENROUTER_VISION_MODELS` | image extraction loop `extract.ts:63` |
| `VISION_MODEL` | `VISION_MODELS[0]` | (derived) | `openrouter-client.ts` `chatWithImages` default; `recipe-pipeline/adapters/video-adapter.ts` frame OCR |
| `WHISPER_MODEL` | `openai/whisper-large-v3` | `OPENROUTER_WHISPER_MODEL` | `_shared/transcribe-media.ts:57` |
| `TRANSCRIPTION_MODEL` | `google/gemini-2.5-flash` | `OPENROUTER_TRANSCRIPTION_MODEL` | `transcribe-media.ts:105` (fallback when Whisper fails) |

**Gotcha (2026-10-12):** `qwen/qwen3.7-plus` is **text-only**. Do not use it in a vision slot. `qwen/qwen3-8b` (bare, no `vl`) was retired by OpenRouter on 2026-10-09. A live 404 naming it means the deployed `chat-api` predates HEAD or a stale `OPENROUTER_AGENT_MODEL*` secret is set.

## Models used (across the entire AI surface)

| Use | Model token (see registry above) | Where called | Temperature |
|---|---|---|---|
| Chat agent loop | `AGENT_MODEL` + `AGENT_MODEL_FALLBACKS` | `agent-loop.ts` | 0.2 |
| Title generation (first chat msg) | `UTILITY_TEXT_MODEL` | `chat-api/index.ts:438,567` | 0.3 `[verify]` |
| General chat (legacy `handleGeneralChat`) | — | deleted post-MOP-0008 | n/a |
| Recipe extraction (text) | `UTILITY_TEXT_MODEL` | `recipe-pipeline/stages/extract.ts:96` | 0.1 `[verify]` |
| Recipe extraction (image/vision) | `VISION_MODELS` (ordered chain) | `extract.ts:63` | 0.1 `[verify]` |
| Video frame OCR | `VISION_MODEL` | `video-adapter.ts` | `[verify]` |
| Audio transcription | `WHISPER_MODEL` → `TRANSCRIPTION_MODEL` | `_shared/transcribe-media.ts` | n/a |
| Substitution suggestions (chat tool) | `UTILITY_TEXT_MODEL` | `tools/handlers.ts:766` | 0.3 `[verify]` |

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
4. **`apiClient.rag*` methods in `api.ts`**: point at non-existent endpoints. Dead.
5. **Deployed vs HEAD model slugs**: env overrides (`OPENROUTER_*_MODEL*`) win over `_shared/models.ts` defaults, and the deployed function can lag HEAD. When logs name a model that isn't in HEAD, suspect a stale deploy or stale secret before suspecting the code.
6. **Line-number refs in this KB**: `agent-loop.ts` has grown a lot since MOP-0008 (resilient fallback, streaming, image `tool_choice`). Refs marked "verified 2026-10-12" are current as of that date. Re-verify anything else before citing it.
