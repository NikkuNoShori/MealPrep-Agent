# RAG Integration Audit

> Per-surface evaluation of where semantic search / embedding-based RAG genuinely earns its keep across the MealPrep Agent app — and where simpler mechanisms (PostgreSQL full-text, ingredient lookup, client-side filters) are honestly the right tool.

**Date:** 2026-06-04
**Author:** Claude (with user direction)
**Status:** Replaces the AI Integration Audit's MOP-0007 framing. Decisions herein supersede the audit's "wire RAG into Recipes page" recommendation.

---

## TL;DR

RAG is genuinely valuable in a **narrow set** of surfaces (4 places). For everything else — direct UI search, filter chips, ingredient lookup — simpler mechanisms beat semantic search on latency, cost, and result quality.

**The Recipes page does not need RAG search.** The current `title.includes()` is too weak, but the right replacement is `search_recipes_text` (full-text via PostgreSQL `ts_vector`) — ~30-80ms, no LLM cost, catches ingredients + instructions automatically. Semantic embedding adds 250-500ms latency for a 100-recipe personal collection where the user is typing a word they know.

**The infrastructure is over-built** relative to what wants to consume it. 5 RPCs exist. 1.5 are wired to actual consumers. The audit's prior recommendation to "wire RAG everywhere" came from chat-style thinking (where natural language is the input modality). Direct UI search has different requirements.

---

## What's actually live today

| Surface | Mechanism | Status | Latency |
|---|---|---|---|
| **Chat agent `search_recipes` tool** | "Hybrid": `generateEmbedding(query)` → run `search_recipes_semantic` (override threshold to **0.5**, not the migration default 0.7) + `search_recipes_text` in parallel → dedupe by id with **semantic-first ordering, NO weighting** (the old 0.7/0.3 vector/text weighting was in retired `server.js`/`backend/rag-api.js` — not re-implemented in edge-function path) | ✅ Live (MOP-0008) | 250-500ms `[verify in prod]` |
| **Recipe save flow (`StructuredRecipeDisplay`)** | `checkSimilarRecipes` — runs at save time, pauses for user confirmation if duplicate-shaped | ✅ Live | ~300ms (embedding + RPC) |
| **Recipe-pipeline load stage** | `generateRecipeEmbedding(openRouter, recipe)` writes `embedding_vector` column on save (non-fatal — recipe saves even if embedding fails) | ✅ Live | ~200-400ms async, doesn't block save |
| **Trigger: clear embedding on content change** | `update_recipe_embedding` trigger sets `embedding_vector := NULL` when title/description/ingredients/instructions/tags change | ✅ Live | <1ms |
| **`RecipeList.tsx` search bar** | Client-side `recipe.title.toLowerCase().includes(query.toLowerCase())` | ⚠ Title-only — misses ingredient/description matches | <5ms |
| **`RecipeList.tsx` filter chips (dietary, prep time, difficulty)** | Client-side filter on already-loaded recipes | ✅ Already wired (I was wrong in earlier audits) | <5ms |

## What's built but unused

| Asset | Built in | Wired to | Status |
|---|---|---|---|
| `search_recipes_semantic` RPC (1536-dim) | migration 004 | Chat agent tool | ✅ used |
| `search_recipes_text` RPC | migration 004 | Chat agent tool (parallel with semantic) | ✅ used |
| `find_similar_recipes` RPC (1536-dim) | migration 004 | (nothing) | ❌ unused — clearest gap |
| `search_recipes_by_ingredients` RPC | migration 004 | (nothing) | ❌ unused |
| `get_recipe_recommendations` RPC | migration 004 | (nothing) | ❌ unused — **important:** this is pure SQL scoring, NOT embedding-based |
| `search_similar_recipes` RPC (384-dim) | migration 004 | (nothing — orphan?) | ❌ unused — different embedding dimension than the rest |
| `apiClient.ragSearch`, `ragSimilar`, `ragRecommendations`, `ragIngredients` | api.ts | (nothing) | ❌ dead — point at non-existent edge function endpoints per ADR-0004 |

---

## Per-surface evaluation

For each user-facing search/discovery surface, here's the honest call.

### 1. Recipes page — search bar

**Current:** `recipe.title.toLowerCase().includes(query)` client-side
**Right answer:** `search_recipes_text` RPC (full-text via ts_vector on `searchable_text`)
**Why NOT RAG:**
- Personal collections are small (10-500 recipes typical). At that scale, semantic ranking adds noise on exact-term queries ("chicken", "carbonara", "cookies") where lexical match is the right answer.
- Latency: 250-500ms (embedding generation dominates) vs ~30-80ms for full-text — directly visible in search UX (300ms is the user-perceived "instant" threshold).
- Cost: ~$0.0001/query × thousands of searches/user/month = real money for a query type that doesn't benefit.
- The `searchable_text` column already indexes title + description + difficulty + tags + ingredients + instructions via trigger (migration 004 lines 34-53). Full-text catches ingredient/instruction matches automatically.
**Action:** Wire `search_recipes_text` into the search bar. Drop `title.includes()`. **Do not wire `ragSearch`.**

### 2. Recipes page — filter chips (dietary, prep time, difficulty)

**Current:** Client-side filter on already-loaded recipes — **already wired** (verified RecipeList.tsx:70-93)
**Right answer:** Leave as-is
**Why:** Structured filters on bounded enums (difficulty: easy/medium/hard; dietary tags from a small set) are exact, instant, zero-cost. RAG offers nothing here.
**Action:** None. (Earlier audits incorrectly claimed these were decorative. They are not.)

### 3. RecipeDetail page — "Similar to this recipe" rail

**Current:** Doesn't exist
**Right answer:** `find_similar_recipes` RPC (~50-100ms; just one vector lookup, no query embedding to generate)
**Why YES RAG:**
- Comparing two recipe embeddings is exactly what pgvector is for.
- "Similar" has no good lexical equivalent — `carbonara` and `cacio e pepe` are semantically similar but share zero tokens.
- One-time lookup (when user opens the recipe), so latency is amortized over the page-view.
- Cost: no embedding generation needed at runtime (recipe's embedding is already stored).
**Action:** Add a "Similar to this" rail on RecipeDetail. Call `find_similar_recipes` with `match_count = 5`. **Note on threshold:** migration 004:237 has default `match_threshold = 0.6` but the chat agent's `findSimilarRecipes` handler currently overrides to `0.4` (handlers.ts:178). The migration default is what nothing calls; the handler override is what production uses. Verify which threshold to apply when wiring the rail — recommend matching the handler's `0.4` for consistency, then surface a knob.

### 4. Recipe save flow (chat → save extracted recipe)

**Current:** `checkSimilarRecipes` already runs at save time — pauses if duplicates found
**Right answer:** Leave as-is, optionally tighten threshold based on observed false-positive rate
**Why:** This is a duplicate-prevention pattern — the user is about to add a recipe; we want to surface anything that's already there. Semantic similarity catches paraphrased titles ("Carbonara" vs "Spaghetti Carbonara" vs "Pasta alla Carbonara") where literal text match would miss.
**Action:** No change. Monitor false-positive rate; tune threshold if needed.

### 5. Chat agent — `search_recipes` tool

**Current:** Hybrid (semantic + text in parallel) per MOP-0008
**Right answer:** Leave as-is
**Why:** Natural-language input modality — user types "anything cozy and warm for a rainy night" — semantic understanding is the whole point of the chat surface.
**Action:** No change. The MOP-0008 design is correct here.

### 6. Meal Planner — "Suggest a week" / "Recommended recipes"

**Current:** Doesn't exist
**Right answer:** `get_recipe_recommendations` RPC for the structured filter pass + (optionally) embedding-based re-ranking for the top N
**Important nuance:** `get_recipe_recommendations` is **pure SQL scoring** — it does NOT use embeddings. It scores recipes by difficulty match + tag overlap + rating + prep_time fit. That's actually the right primary tool here. Embeddings would be a secondary re-rank layer.
**Action:** Wire `get_recipe_recommendations`. Plumb reactions into the scoring (`recipe_reactions` is currently write-only). Embedding re-ranking is a Phase 2 optimization.

### 7. Dashboard / Home — "Recommended for you"

**Current:** Doesn't exist
**Right answer:** Same as #6 — `get_recipe_recommendations` based on household preferences + reactions
**Why:** This is recommendation, not search. Structured preference scoring with optional embedding nearness is the standard pattern.
**Action:** Out of MOP-0007 scope. Phase 2 work.

### 8. Pantry / "What can I make with…"

**Current:** Doesn't exist (no pantry feature)
**Right answer:** `search_recipes_by_ingredients` RPC if a pantry feature ships
**Why:** This is ingredient lookup, not semantic. Full-text `ts_rank` against ingredient text is the right primitive.
**Action:** Defer until pantry feature exists.

### 9. Empty-state on Recipes / Meal Planner

**Current:** Empty
**Right answer:** Surface `get_recipe_recommendations` results when the user has nothing relevant
**Why:** Recommendation, not search. Empty states are a natural recommendation surface.
**Action:** Out of MOP-0007 scope. Phase 2.

---

## Where RAG genuinely earns its keep (summary)

Four surfaces. Two live, two proposed:

1. ✅ Chat agent `search_recipes` (live, MOP-0008)
2. ✅ Recipe save flow `checkSimilarRecipes` (live)
3. 🟡 RecipeDetail "Similar to this" rail (proposed — MOP-0007 keeps this)
4. 🟡 Meal Planner recommendation re-rank (proposed — MOP-0007 keeps this as Phase 2 polish on top of `get_recipe_recommendations`)

That's it. Everything else either uses simpler mechanisms or doesn't ship in MOP-0007 scope.

---

## Where simpler mechanisms are the honest answer

| Need | Best mechanism | Why not RAG |
|---|---|---|
| Search bar on personal recipe collection | `search_recipes_text` (PostgreSQL full-text) | 6-10× faster, no LLM cost, lexical match is what user wants 80% of the time |
| Filter chips | Structured client-side filter | Exact, instant, zero-cost — already wired |
| Tag-based discovery | `recipe.tags` array overlap | Pure SQL `array && array` is O(1) |
| Sort by rating / date | `ORDER BY` | Built into Postgres |
| Pantry-style ingredient lookup | `search_recipes_by_ingredients` (ts_rank on ingredient text) | Ingredients are tokens, not concepts |
| Recommendation scoring | `get_recipe_recommendations` (SQL scoring) | This RPC is already scoring-based — no embedding needed for the primary pass |

---

## Cleanup recommended alongside MOP-0007

These are dead-code items the audit revealed. Not blocking, but worth a cleanup pass:

- **Dead `apiClient` methods:** `ragSearch`, `ragSimilar`, `ragRecommendations`, `ragIngredients` all point at edge function URLs that don't exist post-ADR-0004 (`SUPABASE_FUNCTIONS_URL/rag/*` — no Supabase function at that path). Zero callers from `src/components/`, `src/pages/`, `src/hooks/`. Safe to delete.
- **Orphan RPC:** `search_similar_recipes` (384-dim) appears unused — different embedding dimension than the rest (1536). Either there's a separate embedding pipeline that died, or this is leftover from an earlier architecture. **[verify]** before deletion — check if any external integration (n8n? legacy server.js?) calls it.

---

## Latency / cost picture (for the SME agent's reference)

| Mechanism | Latency | Cost per query |
|---|---|---|
| `title.includes()` (current search) | < 5ms (client) | $0 |
| `search_recipes_text` (full-text RPC) | 30-80ms | $0 |
| `search_recipes_by_ingredients` (ts_rank RPC) | 40-100ms | $0 |
| `find_similar_recipes` (one vector lookup, no embedding gen) | 50-100ms | $0 |
| `get_recipe_recommendations` (SQL scoring) | 20-60ms | $0 |
| RAG search via chat-api (`search_recipes` tool: hybrid) | 250-500ms | ~$0.0001 |
| Chat turn end-to-end (intent → tool → reply) | 1.5-8s | ~$0.005 |

User-perceived "instant" threshold: ~300ms. Anything in the first five rows feels instant; anything in the last two is visibly a wait.

---

## Revised MOP-0007 scope (recommendation)

**KEEP from original MOP-0007:**
- `find_similar_recipes` rail on `RecipeDetail` (genuine RAG win)
- Meal Planner "Suggest a week" (primary: `get_recipe_recommendations` SQL scoring; secondary: embedding re-rank)
- Reactions feeding into `get_recipe_recommendations` scoring

**DROP from original MOP-0007:**
- Replacing `RecipeList.tsx` search with `apiClient.ragSearch` (wrong tool for direct UI search)
- "Wire decorative filter chips" — they're already wired, audit was wrong about this

**ADD to MOP-0007:**
- Replace `title.includes()` search with `search_recipes_text` RPC (full-text via ts_vector — catches ingredients + descriptions, 30-80ms latency, no LLM cost)
- Delete dead `apiClient.rag*` methods (4 methods, zero callers)
- Update `RecipeList.tsx` to call the new search via `useRecipeTextSearch` hook

**Deferred (Phase 2 — not in MOP-0007):**
- Dashboard "Recommended for you"
- Empty-state recommendations
- Pantry feature + `search_recipes_by_ingredients`
- Embedding re-rank on top of `get_recipe_recommendations`

---

## Acceptance criteria for revised MOP-0007

- [ ] `RecipeList.tsx` search bar uses `search_recipes_text` RPC instead of `title.includes()`
- [ ] `RecipeDetail` page has a "Similar to this recipe" rail backed by `find_similar_recipes` (threshold 0.6, limit 5)
- [ ] Meal Planner exposes a "Suggest meals for this week" action calling `get_recipe_recommendations` with household preferences
- [ ] `recipe_reactions` are read by `get_recipe_recommendations` scoring (positive reactions boost, negative reactions demote)
- [ ] `apiClient.ragSearch`, `ragSimilar`, `ragRecommendations`, `ragIngredients` deleted from `src/services/api.ts` (no callers; the chat agent uses its own tool handler path)
- [ ] No regression in chat agent's `search_recipes` tool (still hybrid semantic + text)

---

## Open questions for the user

1. **The 384-dim `search_similar_recipes` RPC + `recipe_embeddings` table** — verified (by SME-build agent's read pass) that current Deno edge-function code does NOT use either. The 1536-dim path on `recipes.embedding_vector` is the live one. The 384-dim table appears to be an orphan from an earlier smaller-model architecture. Two embedding tables, one in use. Candidate for ADR + drop migration. **[verify]** that no external integration (n8n, retired `server.js`) calls it before deletion.
2. **Reaction-as-signal in `get_recipe_recommendations`** — should a thumbs_down hard-exclude or just demote? Default suggestion: demote (multiply score by 0.3 or similar) so a single dislike doesn't bury a recipe forever.
3. **"Suggest a week" UX** — single-click "fill the week" or guided ("pick 5 dinners")? Default suggestion: guided with a "fill rest" shortcut.
4. **Threshold reconciliation** — migrations and handler call-sites have different defaults:
   - `search_recipes_semantic`: migration default 0.7; handler calls 0.5
   - `find_similar_recipes`: migration default 0.6; handler calls 0.4
   The migration defaults are dead code (nothing calls them with defaults). Either align migrations to actual usage, or remove the defaults so the call-site is unambiguously the source of truth.

---

## 🚨 CRITICAL FINDING (surfaced during SME agent build pass)

### Stale embeddings — no backfill job

**Pathology:** `update_recipe_embedding` trigger (migration 004:68-85) NULLs `embedding_vector` whenever title/description/ingredients/instructions/tags change. **Nothing in the repo re-generates the embedding.** Result: every recipe that has ever been edited currently has `embedding_vector IS NULL`, making it **invisible to semantic search** (the RPC's `WHERE r.embedding_vector IS NOT NULL` filter excludes it).

**Impact:**
- Semantic search results progressively degrade as the user edits recipes
- `find_similar_recipes` rail will show NOTHING for edited recipes (the source's vector is null)
- Chat agent's `search_recipes` hybrid path silently falls back to text-only for edited recipes
- The longer a user uses the app, the more recipes drop out of semantic results

**Mitigations:**
- Short-term: change the trigger to instead set a `needs_reembed BOOLEAN` flag instead of nulling the vector. Keep the stale vector queryable while flagged for refresh.
- Medium-term: cron / scheduled job (could be a Supabase Edge Function on a schedule) that re-embeds rows where `embedding_vector IS NULL OR needs_reembed = true`.
- Document the lifecycle and add monitoring.

**Recommendation:** This is a real bug that affects every wired RAG surface (chat agent, similar rail, save-time dedup). Worth its own MOP. Suggest **MOP-0015: Embedding Refresh Lifecycle** — P1 priority, should land before MOP-0007 Phase 2 (similar rail) ships because the rail will be broken on edited recipes without it.

`[verify]` whether a cron exists outside the repo (Supabase Dashboard scheduled function, external worker, n8n workflow). The SME-build agent's read pass found no in-repo evidence; user should confirm.
