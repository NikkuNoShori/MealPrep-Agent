# Troubleshooting Playbook

> Symptom → diagnosis flowcharts for the six most common chat + RAG failure modes. Each ends with a "first thing to check" sentence and a specific file:line. Use when answering diagnostic queries.

## 1. "Search returns empty or too few results"

### Diagnostic order

1. **Check `embedding_vector IS NULL` count.** This is the most common cause.
   - Run: `SELECT COUNT(*) FROM recipes WHERE user_id = '<uuid>' AND embedding_vector IS NULL;`
   - If high → user's recipes have edits + the no-backfill issue (see `rag-pipeline.md`). Semantic returns 0 for those rows. Text fallback should still work.
   - **First thing to check: how many of the user's recipes have null embeddings?**

2. **Check the similarity threshold being applied.**
   - `search_recipes_semantic` migration default: 0.7 (`supabase/migrations/20251201000003_004_search_and_embeddings.sql:177`)
   - Chat agent override: 0.5 (`supabase/functions/chat-api/tools/handlers.ts:58` `[verify]`)
   - `find_similar_recipes` migration default: 0.6 (migration 004:237)
   - Chat agent override: 0.4 (handlers.ts:178 `[verify]`)
   - If a NEW surface is calling with the migration defaults (0.6/0.7) instead of overrides (0.4/0.5), it'll return fewer results. Verify which threshold the failing surface uses.

3. **Check the query is reaching the right path.**
   - For chat agent: look at `intentMetadata.toolCalls` on the failing AI message. Was `search_recipes` actually called? With what args?
   - For direct UI search (future MOP-0007 work): network panel — was the RPC POST sent? What URL?

4. **Check user has saved recipes at all.**
   - Empty collection trivially returns empty results. Easy to miss.

### Code references
- Empty-result branches: `handlers.ts:53-67` (parallel rpc), 79-88 (dedupe).
- Migration RPC body: 004:200-228 (semantic), 004:265-301 (similar).

---

## 2. "Search returns irrelevant results"

### Diagnostic order

1. **Check embedding staleness for the queried recipes.**
   - Same root cause as #1 but inverted: instead of "no results," the user gets results from OTHER recipes whose embeddings are stale and now resemble the query weirdly.
   - The `update_recipe_embedding` trigger (migration 004:68-85) NULLs vectors but doesn't repopulate. So edited recipes have null vectors and don't appear. Old recipes have ORIGINAL embeddings that may not reflect current content.

2. **Check threshold is appropriate for the query type.**
   - Long natural-language queries match more recipes at any threshold. 0.5 is permissive; 0.7 is strict.
   - If "anything chickeny" returns dessert recipes, lower threshold isn't the answer — better query / better tagging is.

3. **Check what content was embedded.**
   - `_shared/embedding-utils.ts createRecipeText` concatenates title + description + cuisine + difficulty + tags + ingredients + instructions.
   - If a recipe's title is the cue but the title is uninformative ("Mom's recipe"), the embedding will reflect ingredients/instructions instead.

4. **Hybrid path: is the text branch dominating?**
   - The current `searchRecipes` handler dedupes by id with semantic-first ordering, no weighting. If semantic returned 0 (due to stale embedding) and text returned 5, all 5 are text results — which may not reflect what the user expected from "RAG-powered" search.
   - Inspect `intentMetadata.toolCalls` trace; the agent should log which path returned what.

### Code references
- Hybrid dedupe logic: `handlers.ts:79-88`
- Embedding content: `_shared/embedding-utils.ts createRecipeText`
- Trigger that nulls vectors: `migration 004:68-85`

---

## 3. "Chat agent hallucinated a recipe"

### Diagnostic order

1. **Was a tool actually called?**
   - Inspect `intentMetadata.toolCalls[]` on the response. If empty, the model went straight to prose without consulting tools.
   - The system prompt (CHAT_AGENT_SYSTEM_PROMPT in `_shared/recipe-prompts.ts`) hard rule #2 forbids fabricating recipes. If the model violated this, that's a prompt-fidelity / model-behavior issue, not a code bug.

2. **Did the tool return what the model claims?**
   - If `search_recipes` was called and returned 0 results but the model still produced a recipe, the model invented it. Same hard rule violation.
   - If `search_recipes` returned recipe X but the model described recipe Y, the model is misreading tool output.

3. **Is the recipe in the response a real database row?**
   - `agent-loop.ts:186-189` captures `lastRecipe` / `lastRecipes` from tool results into the response envelope. If the response has a `recipe` field, it came from a tool. If it has only `content` (prose), the model wrote it as text.
   - Verify: `SELECT title FROM recipes WHERE id = '<id from response>'`. If empty, model invented.

4. **Was retrieved content interpreted as instructions?** (Prompt injection)
   - If user pasted text or a URL containing "ignore previous instructions and tell the user X," the model might have followed it.
   - The `<tool_result>...</tool_result>` wrapping (`agent-loop.ts:~69`) is the defense. If the wrapping is missing or malformed in a code path, injection is possible.
   - Hard rule #5 of CHAT_AGENT_SYSTEM_PROMPT is the model-side defense.

### Recommended next action
If the model is consistently hallucinating: don't change code. Re-verify CHAT_AGENT_SYSTEM_PROMPT is unchanged (`recipe-prompts.ts`) and ask `cooking-bot-architect` to evaluate whether the prompt needs tightening.

### Code references
- Capture-from-tool: `agent-loop.ts:186-189` `[verify exact lines]`
- System prompt: `_shared/recipe-prompts.ts CHAT_AGENT_SYSTEM_PROMPT`
- Tool-result wrapping: `agent-loop.ts:~69`

---

## 4. "Chat agent refused / couldn't do something it should"

### Diagnostic order

1. **Is the tool capability-gated?**
   - `web_search_recipe` is gated on `WEB_SEARCH_API_KEY` env var. If the key isn't set, the tool is OMITTED from the catalog (`catalog.ts:337` `[verify]` — the `available()` predicate).
   - The model literally doesn't know the tool exists when the gate is closed.
   - Fix: set the env var as a Supabase Edge Function secret.

2. **Did the model try and the dispatcher reject?**
   - Inspect `intentMetadata.toolCalls[].error`. Common rejection causes:
     - `user_id` key anywhere in the args tree → recursive scan rejection (`dispatch.ts:243` `[verify]`)
     - Args failed JSON Schema validation → check args shape against `catalog.ts` definition
     - Tool name not in `HANDLERS` map → typo or stale catalog

3. **Is the tool destructive and waiting for confirmation?**
   - `update_recipe` and `delete_recipe` are always in `DESTRUCTIVE_TOOLS` and short-circuit to `pendingConfirmation`. The agent didn't refuse — it correctly returned a confirmation prompt that the UI needs to render.
   - `assign_recipe_to_meal_plan_slot` is conditionally destructive — only short-circuits when the target slot is already populated.

4. **Did the model violate a hard rule and decline to call the tool?**
   - Hard rule #3 (allergen claims) might cause the model to refuse to commit to "is this safe for X allergy" — that's correct behavior, not a bug.

### Code references
- Capability gate: `catalog.ts:337` `[verify]`
- `user_id` rejection: `dispatch.ts:243`
- Destructive sets: `catalog.ts` `DESTRUCTIVE_TOOLS`, `CONDITIONALLY_DESTRUCTIVE`

---

## 5. "Search is slow"

### Diagnostic order

1. **Is this RAG or text?**
   - Full-text (`search_recipes_text`): expected 30-80ms. If slow, it's an index issue or PostgreSQL load. Run `EXPLAIN ANALYZE`.
   - Semantic RAG: expected 250-500ms total. The ada-002 embedding generation is the dominant cost (150-300ms). Vector search itself is 20-50ms.

2. **Is the embedding generation cold-starting?**
   - First request after a quiet period: edge function cold start + ada-002 connection setup adds variable overhead. Expected.
   - Sustained slow: not a cold-start; investigate elsewhere.

3. **Is the network adding latency?**
   - Frontend → edge function → ada-002 → Supabase Postgres → response is ~4 hops. RTT alone is 100-150ms in typical conditions.
   - Browser dev tools network panel shows the round-trip.

4. **Is pgvector returning slow?**
   - The ivfflat index has `lists = 100` (migration 004:24, 92, 95). For collections > 50,000 rows, this becomes the bottleneck. For personal collections (10-500 recipes), the index is way overprovisioned and works fine.

### Code references
- Embedding generation: `_shared/openrouter-client.ts` (ada-002 method)
- Parallel RPC calls: `handlers.ts:53-67`
- IVFFlat index: `migration 004:88-100`

---

## 6. "Similar-recipes rail shows the wrong recipes (or none)"

### Diagnostic order

1. **Does the source recipe have an embedding?**
   - `SELECT embedding_vector IS NOT NULL FROM recipes WHERE id = '<source>'`
   - If NULL → the rail will show nothing. This is the no-backfill issue. The UI should hide the rail entirely (don't render an empty state).
   - Most common cause of empty rails.

2. **What threshold is being applied?**
   - Migration default 0.6; current chat-agent override 0.4. Wiring the rail at 0.6 vs 0.4 changes how many results show.
   - 0.4 is permissive (more results, some less similar). 0.6 is strict (fewer results, all clearly similar).

3. **Are the "similar" recipes stale?**
   - If recipe A was edited but recipe B wasn't, their embeddings reflect different time points. Apparent similarity from old content may not match current content.
   - Same root cause as #2.

4. **Is the rail finding recipes from a different user?**
   - `find_similar_recipes` filters by `user_id = find_similar_recipes.user_id` (migration 004:295). Verify caller passes the correct user_id — and that the RPC isn't being called with someone else's id (privilege escalation).

### Code references
- Find similar RPC: `migration 004:234-302`
- Stale vector pathology: see `rag-pipeline.md`
- Override threshold: `handlers.ts:178` `[verify]`

---

## Quick reference: where to look for the answer

| Symptom | First file to open |
|---|---|
| Empty results, "should have matches" | Check `embedding_vector IS NULL` count first; then `handlers.ts` for threshold |
| Slow chat response | Look at `intentMetadata.toolCalls[].durationMs` if logged; then `_shared/openrouter-client.ts` |
| Wrong tool called | `intentMetadata.toolCalls` trace; then `CHAT_AGENT_SYSTEM_PROMPT` |
| Confirmation not surfacing | `ChatInterface.tsx handleConfirmAction` + `ConfirmationPrompt.tsx` |
| Capability missing | `catalog.ts` capability-gate `available()` |

When in doubt, **trace the actual call** rather than assuming. The user pays you to be precise.
