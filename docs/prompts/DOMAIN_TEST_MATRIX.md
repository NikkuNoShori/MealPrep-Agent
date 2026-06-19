# Domain Test Matrix

> **Source of truth** for routing integrity checks and domain SME invocation. Consumed by `integrity-orchestrator`, `/integrity-check`, and MOP `## Verification` authoring.

**Last updated:** 2026-06-14

---

## How to use

1. **After a code change:** match changed file paths against `scope_globs` → run the listed `integrity_commands` in order.
2. **Before MOP `complete`:** every domain touched by the MOP's `## Scope Map` must have its integrity commands passing.
3. **Troubleshooting:** invoke the `domain_sme` for explanation/diagnosis (read-only). The SME does not run tests unless asked to interpret orchestrator output.

---

## Domains

### `chat-rag`

| Field | Value |
|-------|-------|
| **Description** | Chat agent loop, tool catalog, embeddings, semantic/text search, RAG RPCs |
| **Domain SME** | `chat-rag-sme` |
| **KB** | `.claude/agents/chat-rag-sme-knowledge/` |
| **Scope globs** | `supabase/functions/chat-api/**`, `supabase/functions/_shared/openrouter-client.ts`, `supabase/functions/_shared/web-search-client.ts`, `src/components/chat/**`, `src/services/api.ts` (sendMessage section), `supabase/migrations/*search*`, `supabase/migrations/*embedding*` |
| **Integrity commands** | `npm run test:run -- src/services/__tests__/chat-agent.test.ts`, `npm run test:run -- src/components/chat/__tests__`, `deno test --config supabase/functions/deno.json --allow-env --allow-net supabase/functions/chat-api/__tests__/agent-loop.test.ts`, `deno test --config supabase/functions/deno.json --allow-env --allow-net supabase/functions/chat-api/__tests__/golden-routing.test.ts` (or `npm run test:golden-routing`) |
| **Optional integration** | Golden set eval script (MOP-0008 — not yet automated) |
| **Data-integrity targets** | — |

### `recipe-pipeline`

| Field | Value |
|-------|-------|
| **Description** | URL/text/video ingestion, extraction stages, load + embedding on save |
| **Domain SME** | `recipe-pipeline-sme` |
| **KB** | `.claude/agents/recipe-pipeline-sme-knowledge/` |
| **Scope globs** | `supabase/functions/recipe-pipeline/**`, `supabase/functions/_shared/recipe-prompts.ts`, `supabase/functions/_shared/platform-oembed.ts`, `supabase/functions/_shared/link-extractor.ts`, `supabase/functions/_shared/transcribe-media.ts`, `supabase/functions/_shared/video-url-utils.ts`, `src/utils/videoFrameExtractor.ts`, `src/services/videoIntake.ts` |
| **Integrity commands** | `npm run build` (TypeScript surfaces broken imports), `deno test supabase/functions/_shared/link-extractor_test.ts` (when Deno available), `deno test supabase/functions/recipe-pipeline/__tests__` (when fixtures exist per MOP-0012) |
| **Data-integrity targets** | Embedding shape (1536-dim), duplicate detection RPC |

### `recipes-library`

| Field | Value |
|-------|-------|
| **Description** | Recipe CRUD, search, reactions, collections, visibility, recipe UI |
| **Domain SME** | `recipe-pipeline-sme` (extraction overlap) + `chat-rag-sme` (search overlap) |
| **KB** | `.claude/agents/recipe-pipeline-sme-knowledge/` |
| **Scope globs** | `src/components/recipes/**`, `src/pages/Recipes.tsx`, `src/services/api.ts` (recipe/collection/reaction methods) |
| **Integrity commands** | `npm run test:run -- src/services/__tests__/api.test.ts` (recipe/collection/reaction describes), `npm run test:run -- src/components/recipes/__tests__` |
| **Data-integrity targets** | Reaction counts, visibility (RLS) |

### `meal-planning`

| Field | Value |
|-------|-------|
| **Description** | Meal plans, calendar, grocery cart, ingredient aggregation, shopping mode |
| **Domain SME** | `meal-planning-sme` |
| **KB** | `.claude/agents/meal-planning-sme-knowledge/` |
| **Scope globs** | `src/pages/MealPlanner.tsx`, `src/components/meal-planning/**`, `src/components/grocery/**`, `src/utils/ingredientAggregator.ts`, `src/types/mealPlan.ts`, `supabase/migrations/*meal_plan*` |
| **Integrity commands** | `npm run test:run -- src/utils/__tests__/ingredientAggregator.test.ts`, `npm run test:run -- src/services/__tests__/api.test.ts` (meal plan describes) |
| **Data-integrity targets** | Grocery aggregation sums, manual item persistence, serving scale |

### `household-sharing`

| Field | Value |
|-------|-------|
| **Description** | Households, invites, roles, dependents, family members, shared visibility |
| **Domain SME** | `household-sme` |
| **KB** | `.claude/agents/household-sme-knowledge/` |
| **Scope globs** | `src/pages/Household.tsx`, `src/pages/InviteAccept.tsx`, `supabase/functions/household-invite/**`, `supabase/migrations/*household*`, `supabase/migrations/*invite*`, `supabase/migrations/*family_member*` |
| **Integrity commands** | `npm run test:run -- src/services/__tests__/api.test.ts` (household/invite/family describes), `npm run test:run -- src/pages/__tests__/Household.test.tsx` |
| **Optional integration** | `RUN_INTEGRATION_TESTS=1 npm run test:integration` (RLS — requires `.env` Supabase keys; no Docker) |
| **Data-integrity targets** | RLS private/household/public, `get_my_household` shape |

### `platform-auth`

| Field | Value |
|-------|-------|
| **Description** | Auth store, profiles, settings, username, protected routes |
| **Domain SME** | `platform-auth-sme` |
| **KB** | `.claude/agents/platform-auth-sme-knowledge/` |
| **Scope globs** | `src/stores/authStore.ts`, `src/components/auth/**`, `src/pages/Settings.tsx`, `src/pages/CompleteSetup.tsx`, `src/pages/AuthCallback.tsx`, `src/pages/VerifyEmail.tsx`, `src/services/supabase.ts` |
| **Integrity commands** | `npm run test:run -- src/stores/__tests__/authStore.test.ts`, `npm run test:run -- src/services/__tests__/api.test.ts` (profile/username describes) |

### `testing-infra`

| Field | Value |
|-------|-------|
| **Description** | Vitest, MSW, Playwright, integration harness |
| **Domain SME** | `integrity-orchestrator` |
| **Scope globs** | `src/test/**`, `src/integration/**`, `e2e/**`, `vite.config.ts`, `playwright.config.ts` |
| **Integrity commands** | `npm run test:run`, `npm run build` |
| **Optional integration** | `RUN_INTEGRATION_TESTS=1 npm run test:integration` |
| **Optional e2e** | `npm run test:e2e` (requires dev server + Playwright browsers) |

---

## Global gates (every MOP completion)

These run regardless of domain:

```bash
npm run lint
npm run build
npm run test:run
```

---

## Routing algorithm (for `integrity-orchestrator`)

```
1. Collect changed paths (git diff or explicit file list from user/MOP Scope Map).
2. For each domain, if any changed path matches a scope_glob → add domain to scope set.
3. Union all integrity_commands for matched domains + global gates.
4. Deduplicate commands; run in order: lint → build → domain unit tests → optional integration.
5. If any command exits non-zero → FAIL. Report failing domain + command + SME to invoke.
6. For aggregation/RLS changes, also invoke data-integrity targets from matched domains.
```

---

## MOP → domain mapping (quick reference)

| MOP | Primary domain(s) |
|-----|-------------------|
| 0001 | recipe-pipeline |
| 0002 | household-sharing |
| 0003 | household-sharing, recipes-library |
| 0004 | meal-planning |
| 0005 | testing-infra |
| 0006 | platform-auth (types) |
| 0007 | chat-rag, recipes-library |
| 0008 | chat-rag |
| 0014 | household-sharing |
| 0015 | chat-rag, recipe-pipeline |
| 0016 | recipe-pipeline |
