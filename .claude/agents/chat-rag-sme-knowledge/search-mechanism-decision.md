# Search Mechanism Decision Matrix

> When semantic RAG is the right tool, and when full-text / structured filter / SQL scoring is the right tool. **Source-of-truth: [docs/RAG_AUDIT.md](../../../../docs/RAG_AUDIT.md)** (2026-06-04). This file is the agent's quick-reference distillation.

## TL;DR

Four mechanisms exist for finding recipes. Each has a sweet spot:

| Mechanism | Sweet spot | Latency | LLM cost |
|---|---|---|---|
| **Client-side `.includes()` / filter chips** | Bounded enums (difficulty, tag exact match), exact-title lookup on small collections | <5ms | $0 |
| **Full-text via `search_recipes_text`** | Direct search bar on personal collections; "find by ingredient" | 30-80ms | $0 |
| **Ingredient lookup via `search_recipes_by_ingredients`** | Pantry-style "what can I make with X" | 40-100ms | $0 |
| **Semantic RAG via `search_recipes_semantic` + `find_similar_recipes`** | Natural-language queries (chat) + similarity comparisons (similar rail) | 250-500ms (query embedding) OR 50-100ms (no query embedding) | ~$0.0001/query when embedding needed |
| **Scoring via `get_recipe_recommendations`** | Recommendations / "suggest a week" | 20-60ms | $0 |

User-perceived "instant" threshold is ~300ms. Anything above that feels like a wait.

## Where RAG genuinely earns its keep

| Surface | Live? | Why RAG is right |
|---|---|---|
| Chat agent `search_recipes` tool | ✅ Live (MOP-0008) | User types natural language ("anything cozy for a rainy night"); semantic understanding is the whole point |
| Recipe save flow `checkSimilarRecipes` | ✅ Live | Catches paraphrased duplicate titles ("Carbonara" vs "Spaghetti Carbonara"); good lexical equivalents don't exist |
| `find_similar_recipes` rail on RecipeDetail | 🟡 Proposed (MOP-0007 Phase 2) | Pure semantic compare; no good lexical equivalent for "similar recipe" |
| Meal Planner suggestion re-ranker (optional) | 🟡 Phase 2 polish (MOP-0007 Phase 4b) | Re-rank scored results by seed-recipe embedding distance — narrow use case |

That's it. **Four surfaces.** Everything else uses simpler primitives.

## Where simpler mechanisms are the right answer

| Need | Right tool | Why not RAG |
|---|---|---|
| Recipes-page search bar (user types "chicken") | `search_recipes_text` | Personal-collection scale + lexical match is what user wants 80% of the time + 6-10× faster + no LLM cost |
| Filter chips (dietary, prep time, difficulty) | Client-side structured filter | Bounded enums = exact match is correct, fastest, free, already wired (verify RecipeList.tsx:70-93) |
| Tag-based discovery | `recipe.tags && tag_list` (Postgres array overlap) | O(1) set membership; RAG can't beat exact |
| Sort by rating / date | `ORDER BY` | Built into Postgres |
| Pantry-style ingredient lookup | `search_recipes_by_ingredients` | Ingredients are tokens, not concepts |
| Recommendation scoring | `get_recipe_recommendations` (pure SQL scoring) | The RPC is already scoring-based; embedding re-rank is optional Phase 2 polish |

## The "always wire RAG" assumption is wrong

The original AI Integration Audit framed MOP-0007 as "wire the RAG infrastructure everywhere." That framing was **wrong**. RAG is the right tool for:

- Natural-language input (chat is the only modality)
- Concept comparison without good lexical analog (similar rail)

It is the WRONG tool for:

- Direct search bar (latency + zero benefit for lexical queries)
- Bounded filters (exact match wins)
- Pantry / ingredient lookup (full-text on ingredient column is faster and more precise)

The 2026-06-04 audit re-scoped MOP-0007 with mechanism-per-surface choices. Anyone asking "should I wire RAG into X" should be answered: "It depends — what's the input modality, what's the latency budget, and is there a good lexical equivalent?"

## Per-query decision tree (use this when diagnosing or recommending)

```
Is the input from a chat / natural-language modality?
├─ Yes → RAG (semantic component, hybrid with text is fine)
└─ No (direct UI surface):
    │
    Is the query exact-token / known-vocabulary ("chicken", "carbonara", "easy")?
    ├─ Yes → Full-text (search_recipes_text) or client-side filter for bounded enums
    └─ No (vague concept like "cozy" or "hearty"):
        │
        Is there an existing tag system that captures this?
        ├─ Yes → Tag-based filter (free, exact, instant)
        └─ No:
            │
            Is the latency budget tight (< 100ms)?
            ├─ Yes → Don't ship it semantic; tighten tag taxonomy or accept lexical search
            └─ No (accepts 250-500ms) → RAG is OK
```

## The latency budget math (memorize this)

```
Embedding generation (ada-002 via OpenRouter) = 150-300ms  ← dominates RAG latency
Vector search (pgvector ivfflat 1536-dim) = 20-50ms
PostgreSQL ts_vector full-text = 20-50ms
Client-side filter on 500 recipes = <5ms
Network RTT frontend → edge fn → DB → response = 50-150ms (Supabase)
```

If you need a query embedding (chat, search bar), you can't beat ~250ms.
If you DON'T need a query embedding (find_similar_recipes works from stored vector), you can hit ~70-100ms.
If you don't need embeddings at all, you can hit ~30-100ms for text/score RPCs.

When recommending a mechanism, name the latency component you'd add and how much.

## Important caveats

1. **Semantic results are degraded for any user who has edited their recipes**, due to the no-backfill issue (see `rag-pipeline.md`). When diagnosing "RAG returns nothing useful for this user," check `embedding_vector IS NULL` count first. The pathology silently degrades quality without throwing errors.

2. **Chat agent's "hybrid" is dedupe-first, not weighted**. Despite the audit's earlier "0.7 vector / 0.3 text weighting" claim, the current `searchRecipes` handler runs both RPCs in parallel and dedupes by id with semantic-first ordering. The old weighting was in `server.js` (retired per ADR-0004). When asked "what's the hybrid weight?", the answer is "there isn't one in current code; it's dedupe-first."

3. **`get_recipe_recommendations` is pure SQL**. It does NOT use embeddings. The scoring is: `(difficulty match) + (tag overlap) + (rating) + (prep_time fit)` divided by 4.0. When asked "how do recommendations work?", say "SQL scoring formula" — don't call it RAG.
