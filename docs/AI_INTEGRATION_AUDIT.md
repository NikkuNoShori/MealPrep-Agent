# AI Integration Audit

> Strategic review of where AI (LLMs, embeddings, tool use) is — and isn't — applied across the MealPrep Agent product and its development workflow.

**Date:** 2026-06-01
**Reviewer:** Nick Neal (with Claude Code)
**Status:** Initial pass — input for follow-on MOPs

---

## TL;DR

**Product-side**: the LLM/RAG infrastructure is over-built relative to what the UI actually consumes. Five semantic-search RPCs ship and only two are used. `recipe_reactions` and `dietary_tags` are write-only. The single biggest leverage move in the codebase is wiring the existing RAG infrastructure into the Recipes page and meal planner — no new backend work required.

**Dev-side**: four subagents (`doc-keeper`, `qa-auditor`, `data-integrity`, `ui-designer`) cover docs/architecture/data/UI. The gaps that hurt today are around (a) protecting against destructive remote-DB operations (HARD RULE enforcement), (b) scaffolding MSW handlers + tests as `api.ts` grows, and (c) verifying RLS + `search_path` on new migrations.

**Two immediate cleanup items** surfaced that aren't gaps but liabilities:
- `src/lib/openrouter.ts` + `src/services/embeddingService.{ts,js}` are dead code that still leaks `VITE_OPENROUTER_API_KEY` into the frontend bundle. Delete.
- The dietary / prep-time / difficulty filter chips in `RecipeSearch.tsx` update state but `RecipeList.tsx` never reads them. Misleading UI.

---

## 1. Product-Side: Current AI Footprint

All AI calls go through edge functions (CLAUDE.md rule followed in practice):

| Surface | Call site | Model | Trigger |
|---|---|---|---|
| Chat intent detection | `chat-api/index.ts → detectIntent()` | qwen-2.5-7b-instruct (JSON, t=0.1) | Every chat message |
| General chat | `chat-api/index.ts → handleGeneralChat()` | qwen-2.5-7b-instruct (t=0.7) | intent=`general_chat` |
| RAG over recipes | `chat-api/index.ts → handleRAGSearch()` | ada-002 + qwen-2.5-7b | intent=`rag_search` |
| Recipe extraction (text) | `recipe-pipeline/stages/extract.ts` | qwen-2.5-7b (JSON, t=0.1) | source_type=text |
| Recipe extraction (image) | `extract.ts` (vision fallback chain) | qwen-2.5-vl-7b → gemini-2.0-flash | images attached |
| Recipe extraction (URL) | `adapters/url-adapter.ts` | JSON-LD first, LLM fallback | URL detected |
| Recipe extraction (video) | `adapters/video-adapter.ts` | qwen-2.5-vl-7b OCR on frames | source_type=video |
| Embedding on save | `_shared/openrouter-client.ts` | ada-002 (1536-dim) | insert / RAG query |
| Conversation title | `chat-api/index.ts` (inline) | qwen-2.5-7b (20 tokens, t=0.3) | first message only |
| Similar-recipe pre-save | `StructuredRecipeDisplay.tsx` | ada-002 + `find_similar_recipes` RPC | user clicks Save |

## 2. Product-Side: Gaps

### Top 5 product recommendations (ranked)

1. **Wire RAG into the Recipes page.** Five RPCs (`search_recipes_semantic`, `_text`, `_by_ingredients`, `find_similar_recipes`, `get_recipe_recommendations`) and matching `apiClient.rag*` wrappers are built. Only `_semantic` and `_text` are called — from chat-api only. `RecipeList.tsx` does `title.includes(query)`. Replacing it with `apiClient.ragSearch` and surfacing `find_similar_recipes` as a rail on `RecipeDetail` is the highest-leverage week of work in the codebase. **Effort S, Impact High.**

2. **Build MOP-0003 Phase 1: allergen detection at extract time.** Dietary safety is a credible product line. The MOP is fully scoped; the lookup → LLM-fallback → cache-back shape is right. Without this, `family_members.allergies` data sits inert. **Effort M, Impact High.**

3. **"Suggest meals for this week" in the meal planner.** MOP-0004 explicitly defers AI generation. Planner is the headline feature and is 100% manual today. A single LLM call given (household preferences, recipe collection summary, reactions, days to fill) → slot assignments converts planner from form to assistant. `get_recipe_recommendations` already exists for scoring. **Effort M, Impact High.**

4. **Migrate chat from intent routing to tool use.** Single-shot router caps chat at three behaviors. A tool-use loop (`search_recipes`, `find_similar`, `add_to_plan`, `extract_recipe`, `get_allergens`) unlocks "find my chicken recipes safe for the kids and add two to next week" in one message. **Effort L, Impact High** — natural product evolution.

5. **Reactions and dietary tags as ranking signals.** `recipe_reactions` ships and is recorded; nothing reads it. Feed it (plus `detected_allergens` once MOP-0003 ships) into `get_recipe_recommendations` so search/suggestions get smarter with use. **Effort S, Impact Med** — cheapest way to make the product feel personalized.

### Secondary product gaps (worth a MOP entry but lower priority)

- **Ingredient normalization in grocery cart** — `ingredientAggregator.ts` treats "scallions" and "green onions" as separate rows; LLM-classify novel ingredients into a canonical name + category when string match fails.
- **Ingredient substitution suggestions** — one-click "what can I sub for X?" on each row. Cheap LLM call, high perceived intelligence.
- **Recipe Q&A** — "Ask about this recipe" button feeding recipe context into `general_chat`. All infrastructure exists.
- **Pantry / "what can I make tonight?"** — `search_recipes_by_ingredients` RPC is built and unused. Needs a pantry surface.
- **Household-scoped RAG** — `handleRAGSearch` filters by `user_id`. RPC would need to honor household visibility.
- **Nutrition estimation** — `nutrition_info` column is sparse; LLM-estimate from ingredients at save time.
- **Conversational onboarding** — `CompleteSetup.tsx` is fields-only; conversational intake could populate more.

### Architectural observations

- **Frontend OpenRouter client is dead and leaky.** `src/lib/openrouter.ts`, `src/services/embeddingService.{ts,js}`, and `VITE_OPENROUTER_API_KEY` should all be removed. `VITE_` prefix means the key is in the bundle. (Low risk if quota-limited, but the dead code provides no value.)
- **Decorative AI-shaped UI.** `RecipeSearch.tsx` exposes filter chips that don't filter. Either wire them or remove them.
- **No prompt-injection hardening on URL adapter.** Arbitrary HTML is fed to the extraction LLM. Low risk today (output structurally validated), worth a defense-in-depth note.
- **Single shared prompts file is healthy** — `_shared/recipe-prompts.ts`. The `RAG_RESPONSE_PROMPT` is inline in `chat-api/index.ts` and should move into the shared file for consistency.
- **RLS on RAG RPCs.** The semantic search RPC accepts a `user_id` parameter — needs `auth.uid()` enforcement before household / public-recipe exposure.
- **Latency budgets are loose.** Recipe extraction has `AbortSignal.timeout(50000)`. Fine for batch ingest, too long for chat UX. A fast lane / slow lane split would help.

---

## 3. Dev-Side: Current Inventory

| Name | Type | What it does |
|---|---|---|
| `doc-keeper` | Subagent | Samples doc claims → greps for violations → surgical edits |
| `qa-auditor` | Subagent | Branch diff vs `main` against architectural rules; read-only |
| `data-integrity` | Subagent | Targeted Vitest + RLS suites with deterministic seed |
| `ui-designer` | Subagent | Warm-editorial restyles (Fraunces/DM Sans, `--rs-*` tokens) |
| harness skills | Skills | `simplify`, `review`, `security-review`, `init`, `loop`, `schedule`, `claude-api`, `update-config`, `fewer-permission-prompts`, `keybindings-help` |
| `.claude/settings.json` | Permissions only | No hooks defined |

## 4. Dev-Side: Gaps

### Top 5 dev recommendations (ranked)

1. **`migration-rls-checker` subagent.** 40+ migrations, no automation verifies new tables have `ENABLE ROW LEVEL SECURITY` + ≥1 policy, or that new `SECURITY DEFINER` functions have `SET search_path = public`. Migration 026 had to retrofit `search_path` retroactively. **Subagent, Effort S, Impact High.**

2. **PreToolUse hook blocking remote-DB Bash commands.** Cheapest enforcement of the HARD RULE — block any Bash call containing `supabase db push`, `supabase migration push`, or `--linked`. One `settings.json` entry. Pure safety net, no friction. **Hook, Effort S, Impact High.**

3. **`/scaffold-api-method` skill.** Every new `api.ts` method needs a hand-written MSW handler and test block. MOP-0005 Phase 1 is mid-rollout — exactly where this accelerates. Generates method shell + MSW handler in `src/test/msw/handlers.ts` + test block. **Skill, Effort S, Impact High.**

4. **`recipe-pipeline-tester` subagent + fixture set.** URL/text/video adapters are the highest-variance code in the repo (LLM output, fragile parsers) with zero tests. Subagent runs adapters against fixtures and diffs against golden JSON. **Subagent, Effort M, Impact High.**

5. **`runbook-recorder` subagent.** After resolving a non-trivial bug, drafts a `docs/RUNBOOK.md` entry from diff + commit message. Low cost, compounds over time. **Subagent, Effort S, Impact Med.**

### Secondary dev gaps

- `/scaffold-edge-function` skill — Deno template with CORS, OpenRouter wiring, error shape.
- `edge-fn-deno-linter` subagent — once Deno is installed locally on Windows.
- `types-regen` skill — wraps `supabase gen types typescript --local` (depends on MOP-0006).
- Extend `data-integrity` to roundtrip-check `snakeToCamel` / `camelToSnake` on new RPC-returning methods.

### Skills vs Subagents vs Hooks — decision policy

- **Subagent** when multi-step + benefits from a persistent system prompt (the four current agents).
- **Skill** when single-shot procedure with templated output (scaffolders, regeneration).
- **Hook** only as a **safety net for destructive operations**. Not as a quality gate (MOP-0005 Notes explicitly avoids auto-running quality checks).

---

## 5. Suggested Follow-On MOPs

These audits surface enough work to warrant new MOPs:

| Proposed MOP | Scope | Source |
|---|---|---|
| **MOP-0007** | Wire RAG into Recipes page + Meal Planner suggestions + reactions/tags as ranking signal | Product top 1, 3, 5 |
| **MOP-0008** | Chat tool-use migration (single-shot router → tool-call loop) | Product top 4 |
| **MOP-0009** | Dev automation expansion: `migration-rls-checker`, remote-DB hook, `/scaffold-api-method`, `recipe-pipeline-tester`, `runbook-recorder` | Dev top 1–5 |

MOP-0003 (allergen detection) is already drafted — promote to `planned` and start Phase 1.

## 6. Immediate cleanup (no MOP needed)

- Delete `src/lib/openrouter.ts`, `src/services/embeddingService.{ts,js}`, remove `VITE_OPENROUTER_API_KEY` from frontend env.
- Decide: wire the `RecipeSearch.tsx` filter chips to `RecipeList.tsx` or remove them.
- Move `RAG_RESPONSE_PROMPT` from `chat-api/index.ts` into `_shared/recipe-prompts.ts`.

---

## Appendix: Stale registry entries

The audit revealed two MOPs whose registry status is out of date:

- **MOP-0004 Meal Planner & Grocery Cart** — registry says `draft`, but commits [074ee59](.) and [4ade741](.) shipped substantial portions. Needs phase audit.
- **MOP-0005 Test Coverage** — registry says `draft`, but Phase 0 + Phase 5 are effectively complete and Phase 1 is partially shipped (see [src/services/__tests__/api.test.ts](src/services/__tests__/api.test.ts), [src/test/msw/](src/test/msw/)).

Recommend a doc-keeper pass on `REGISTRY.md` before drafting MOP-0007+.
