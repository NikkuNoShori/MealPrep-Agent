# Changelog

> User-visible changes by date for MealPrep Agent. Newest entries first.

**Last reviewed:** 2026-06-16
**Last updated:** 2026-06-16 (video intake + draft store + chat UX on branch `cursor/mop-0008-golden-routing-video-intake`)

---

## 2026-06-16 (Video intake, chat UX, draft recipe cache) `cursor/mop-0008-golden-routing-video-intake`

**Chat**
- Fixed agent tool-use failures: default model `qwen/qwen3-8b`, OpenRouter `require_parameters` for tool-capable routing.
- **Stop generation** — abort in-flight chat/video requests; **draft while loading** — composer stays enabled; Enter queues one follow-up text message.
- **Video upload path** persists extractions to `chat_messages` via `POST /chat-api/persist-extraction`; sidebar refetches messages from DB on conversation select.
- Agent follow-ups read structured recipe from `chat_messages.metadata` via `conversation-context.ts`.

**Video recipe intake (MOP-0016 extension)**
- Client keyframe picker (`recipeImagePicker.ts`) chooses sharpest frame for preview; oEmbed `thumbnail_url` as fallback.
- **Save** uploads best keyframe or thumbnail to `recipe-images`; stores **source URL + name** on the recipe.
- Pipeline fix: video sources with substantive text use JSON extract path (not vision-on-thumbnail-only).
- Inline edit on chat preview card (ingredients + instructions); compact single-line ingredient edit in RecipeForm.

**Caching / session state**
- New `draftRecipeStore` (Zustand): unsaved preview edits keyed by conversation/message; `sessionStorage` for recipe JSON + thumbnail only (**no base64**).
- React Query `staleTime` tuning via `src/config/queryCache.ts` (5 min domain data, 2 min chat history list).

**Recipes page**
- Default feed tab: **My Recipes** (was Public).

**Deploy notes:** Requires `chat-api` + `recipe-pipeline` edge deploys. Pre-deploy video chats are not backfilled.

---

## 2026-06-02 (MOP-0008 chat agent backend, MOP-0005 test coverage, ADR-0004 execution, surface-reviewer) `main`

Developer-facing only — no user-visible application behavior changed yet (frontend confirmation UI for destructive tools is pending Step 8 of MOP-0008).

**Chat agent migration (MOP-0008 — backend complete, status `in_progress`)**
- Replaced `chat-api`'s single-shot intent router with a **tool-using single agent**. One LLM call now receives the user message + a 12-tool catalog and decides which tools to call (zero, one, many, or chained). Multi-step queries like *"find my chicken recipes safe for the kids and add two to next week"* are now possible in one user turn.
- New: `supabase/functions/chat-api/tools/{catalog,dispatch,handlers}.ts` (12 tools, all schemas `additionalProperties:false`, recursive `user_id` rejection, capability-gated `web_search_recipe`), `supabase/functions/chat-api/agent-loop.ts` (`MAX_ITERS=5`, `<tool_result>` wrapping for tool-output prompt-injection defense, destructive-tool short-circuit).
- New shared client: `supabase/functions/_shared/web-search-client.ts` (Tavily default, Brave/Serper drop-in, API-key access isolated, `isConfigured()` gate).
- `_shared/openrouter-client.ts` — added `chatWithTools` method (OpenAI-compatible tools + tool_choice).
- `_shared/recipe-prompts.ts` — added `CHAT_AGENT_SYSTEM_PROMPT` + `SUBSTITUTION_PROMPT`; moved `RAG_RESPONSE_PROMPT` from inline to registry; marked `INTENT_DETECTION_PROMPT` `@deprecated`.
- `chat-api/index.ts` — old `detectIntent`/`handleRAG`/`handleGeneral` paths removed (-430 lines); `context.confirmAction` short-circuit added.
- `src/services/api.ts` — added `pendingConfirmation` types + `confirmAction` request field.
- Tests: `chat-api/__tests__/agent-loop.test.ts` (Deno, scripted-tool-call assertions including web_search dispatch, catalog gating, NO_RESULTS), `src/services/__tests__/chat-agent.test.ts` (Vitest+MSW contract tests), `__tests__/fixtures/golden.json` (30-prompt evaluation set: 10 single-intent / 10 multi-intent / 10 destructive-confirm).
- Docs: `docs/ARCHITECTURE.md` (agent-loop diagram + tool-catalog table + `WEB_SEARCH_*` env vars), `docs/API.md` (`pendingConfirmation` + `confirmAction` documented, prompt registry refreshed).
- **Outstanding (Step 8 UI):** No component in `src/components/chat/` renders the `pendingConfirmation` envelope as a Confirm/Cancel surface yet. The destructive_confirm golden bucket cannot be exercised end-to-end until this lands.

**Test coverage expansion (MOP-0005 Phase 1 — rounds 1 + 2)**
- `npm run test:run` now passes **155 tests** across 4 files (up from 84 after Phase 0). `apiClient` public-surface coverage rose from ~6% to ~42-45%.
- New tests covering: `transferOwnership`, `getHouseholdRecipes`, `getPublicRecipes`, `getRecipeReactions`, `toggleRecipeReaction`, `createHouseholdInvite`, `getMyPendingInvites`, `respondToInvite`, all six collection methods, `checkDuplicateRecipe`, `checkDuplicateTitle`, `updateHousehold`, `getInviteDetails`, `acceptInviteById`, `resendHouseholdInvite`, `getCollection`, `getCollectionRecipes`.
- New file: `src/stores/__tests__/authStore.test.ts` — covers `initialize` / `loadHousehold` / `signOut`.
- MSW helpers added to `src/test/msw/handlers.ts`: `supabaseInsert`, `supabaseEdgePost`, `supabaseEdgeGet`.

**ADR-0004 execution (Vercel `api/` retirement)**
- Deleted the dead Vercel serverless tree (`api/chat.js`, `api/rag/auth.js`, `api/rag/search.js`) — no live callers post-Supabase Edge Functions migration; `DATABASE_URL` (Neon) wasn't even set.
- Deleted `src/services/recipeService.ts` (frontend wrapper for the deleted endpoints) and the duplicate `recipeService` stub at `src/services/supabase.ts`.
- Dropped `@neondatabase/serverless` from `package.json` (no remaining consumers).
- Cleaned `vercel.json` (`/api/*` CORS headers block removed).

**surface-reviewer pattern**
- New subagent: `.claude/agents/surface-reviewer.md` (opus). When a finding emerges mid-task (latent bug, drift, architectural concern), classifies it (trivial-fix / ADR / MOP / MOP+ADR / already-covered / defer-with-trigger) → assigns priority (P0–P3 or defer) with specific rationale → drafts the artifact → presents recommendation. Audit-first; never auto-commits.
- New skill: `.claude/commands/surface.md` (`/surface` slash command).
- `CLAUDE.md` — added "Surface-review reflex" section that auto-invokes `surface-reviewer` when assistant output uses trigger phrases ("worth surfacing", "should flag", etc.). Added full agent + skill inventory table.

**MOP-0014 (drafted from surface-reviewer demo)**
- New MOP: `docs/MOPs/MOP-0014-household-write-atomicity-rpcs.md` (P1, status `draft`, deployment + verification deferred).
- Surfaces two non-atomic write paths in `src/services/api.ts` flagged by the MOP-0005 round-1 agent: `transferOwnership` (dual-owner window between two PATCHes) and `respondToInvite` (invite-without-membership drift between PATCH + INSERT).
- Both extend MOP-0002 / migration 025's established `SECURITY DEFINER` RPC pattern. Includes suggested SQL with explicit `auth.uid()` + role / invitee checks (since SECURITY DEFINER bypasses RLS); invitee match by lowercased email per user directive; lockticket Verification block with hard-gate on authz review.

**Recipe-pipeline bug fix**
- `supabase/functions/recipe-pipeline/stages/extract.ts` — the multi-recipe-detection branch only fired when `recipes[].length > 1`. Models sometimes wrap a single recipe in `recipes[]` anyway (with degraded duplicate fields at top level). Now unwraps on any non-empty `recipes[]` — `length === 1` returns the wrapped recipe; `length > 1` keeps the existing multi-recipe path.

**Pre-existing api.ts findings (not fixed, captured)**
- Finding 1: `transferOwnership` non-atomic → MOP-0014 Phase 1+2.
- Finding 2: `respondToInvite` non-atomic → MOP-0014 Phase 1+2 (same fix shape, folded).
- Finding 3: `getRecipeReactions` returns `"Unknown"` while `RecipeReaction.name` type is declared `string` — kicked to follow-up commit (one-line widening to `string | null` + UI null tolerance).

## 2026-06-01 (Dev tooling: test harness, agent + governance system, security doc tightening) `main`

Developer-facing only — no user-visible application behavior changed.

**Testing infrastructure**
- Wired up the Vitest + MSW integration shim: `src/test/msw/{server,handlers}.ts`, `src/test/setup.ts` installs MSW at module-load time before `api.ts` captures fetch and shims `localStorage` with a self-bound in-memory store so supabase-js `persistSession` works in jsdom. `vite.config.ts` + `.env.test` pin stable test-only `VITE_SUPABASE_URL` / `ANON_KEY`. First test using the harness: `src/services/__tests__/api.test.ts` (household method shape + camelCase mapping).

**Claude Code agent system**
- New `cooking-bot-architect` agent with persistent knowledge base under `.claude/agents/cooking-bot-knowledge/` (architecture patterns, cooking UX, recipe extraction, safety/guardrails, MealPrep context, lessons learned).
- New `.claude/agents/agents-log.md` append-only run log; `data-integrity`, `qa-auditor`, `ui-designer` agents now require an entry per invocation and were bumped from sonnet → opus.
- Retired `doc-keeper` agent (superseded by `doc-adherence`).
- Scrubbed external-project references from agent configs (commit `72895a7`).

**MOP governance**
- Expanded MOP status vocabulary from 4 values to 10 (`draft` / `evaluation` / `approved` / `planned` / `in_progress` / `verifying` / `complete` / `blocked` / `cancelled` / `deferred`) — `docs/prompts/MOP_STATUS_LIFECYCLE.md` is the source of truth.
- Added a lockticket `## Verification` block to `MOPs/MOP_TEMPLATE.md` (file-exists / grep / command / test-passes / human assertions) plus `Scope Map` and `Related` sections.
- Audited MOP-0004 (Meal Planner & Grocery Cart) and MOP-0005 (Test Coverage): both promoted `draft` → `in_progress` with explicit "Shipped as of 2026-06-01" / "Outstanding" callouts.

**ADR system**
- Introduced `docs/DECISIONS/` Architecture Decision Records with `docs/prompts/ADR_AUTHORING_GUIDE.md`. First three ADRs: `meal_plans` JSONB shape (ADR-0001), legacy Express dev server (ADR-0002), documentation/agent pattern adoption (ADR-0003).

**New MOPs**
- MOP-0007 (RAG wired into recipe pages / meal planner / reactions ranking), MOP-0008 (intent router → tool-using agent, with companion `-design.md`), MOP-0009 (dev automation expansion — already in place), MOP-0010 (lockticket /verify-mop + /post-change-check skills), MOP-0011 (normalize meal_plans JSONB → child tables, deferred-with-trigger).

**AI Integration Audit**
- `docs/AI_INTEGRATION_AUDIT.md` — strategic review of the AI surface; source document for MOP-0007 through MOP-0011.

**Slash commands**
- `.claude/commands/{new-mop,new-adr,update-registry,update-docs}.md` — scaffold/maintain the MOP/ADR/registry/doc workflows.

**Security doc tightening**
- `docs/ARCHITECTURE.md` and `docs/RUNBOOK.md`: removed all `VITE_OPENROUTER_API_KEY` references. There is no frontend AI path — all LLM calls go through Supabase Edge Functions using the server-side `OPENROUTER_API_KEY` secret. RUNBOOK now checks `supabase secrets list` instead of grepping `.env`; model id check updated to `qwen-2.5-7b-instruct`.

## 2026-03-14 (RPC optimization — migration 025) `enhancement/feature-release`

- Converted 5 multi-query API methods to single PostgreSQL RPC function calls, reducing database round trips (14 total queries → 5)
- New `SECURITY DEFINER` functions: `get_my_household`, `toggle_recipe_reaction`, `get_household_recipes`, `get_recipe_reactions`, `get_my_pending_invites`
- `toggle_recipe_reaction` is now atomic, eliminating race conditions in the previous check-then-write pattern
- Added household member profile visibility RLS policy (migration 024) — household members can now see each other's profiles

## 2026-03-14 (Household recipes & visibility fixes) `enhancement/feature-release`

- Added "Household" feed tab on Recipes page showing recipes shared with visibility `household` by household members
- Fixed household recipes to include the sharing user's own recipes (previously excluded via `.neq("user_id")` filter)
- Fixed household feed to only show `household` visibility recipes (previously included `public`)
- Fixed recipe deletion in collection view — now calls `removeRecipeFromCollection()` instead of `deleteRecipe()`
- Edit/delete buttons hidden for recipes the user doesn't own (except collection remove)
- Changed "Family Members" section title to "Dietary Profiles" on Household page

## 2026-03-13 (Invite flow, signup, and admin panel) `enhancement/feature-release`

- Added `household-invite` edge function for creating invites and sending emails via `supabase.auth.admin.inviteUserByEmail()`
- Added `/invite/accept` page with invite details, sign-in/sign-up routing, and auto-accept on authentication
- Invite email pre-filled and locked on signup form when accepting an invite (via sessionStorage)
- Added `/complete-setup` page for new users to set display name, username, and password (redirects until `setup_completed = true`)
- Added username field to profiles (3-30 chars, lowercase alphanumeric + underscores, unique) — migration 014
- Added `setup_completed` flag to profiles — migration 020
- Fixed `handle_new_user()` trigger to include email field — migration 023
- Fixed `.single()` → `.maybeSingle()` on profile fetch to prevent 406 errors when profile doesn't exist yet
- Added Cancel button on CompleteSetup that signs out and navigates to login
- Fixed CompleteSetup scroll issue (sealed height chain compliance: `h-full overflow-y-auto` instead of `min-h-screen`)
- Added `/admin` page with AdminRoute guard — user/invite/household management for admin role
- Added `admin-api` edge function for admin operations (CRUD on users, invites, households)
- Admin RLS policies added — migration 021, 022

## 2026-03-13 (Recipe reactions) `enhancement/feature-release`

- Added `recipe_reactions` table (migration 017) supporting thumbs up/down from authenticated users and dependents
- Added reaction UI on RecipeCard with animated toggle buttons
- Both authenticated users and family member dependents can react
- Each person can have one reaction per recipe (same reaction toggles off, different reaction updates)
- Added `getRecipeReactions()` and `toggleRecipeReaction()` API methods with React Query hooks

## 2026-03-13 (Recipe visibility and user profiles) `enhancement/feature-release`

- Added `username` column to profiles with unique constraint (migration 014)
- Added unique recipe title per user constraint (migration 014)
- Fixed recipe RLS auth policies (migration 015)
- Removed default "My Recipes" collection auto-creation (migration 016)
- Added Public Recipes feed with author attribution (@username, avatar)
- Added Household page with member management, invite sending, and dependent (dietary profile) management
- Added recipe visibility display on RecipeCard and RecipeDetail

## 2026-03-12 (Deprecation cleanup — migration 013) `enhancement/chat`

- Dropped `recipes.is_public` column and `sync_recipe_visibility` trigger — `visibility` column is now the sole mechanism
- Dropped `profiles.family_id` column and `validate_family_id` trigger — replaced by `households` model
- Dropped `family_members.family_id` column, made `household_id` NOT NULL
- Simplified `family_members` RLS policies to household-only (removed backward-compat `family_id` OR clauses)
- Fixed `handle_new_user()` trigger — restored OAuth name extraction lost in migration 011, added default collection creation
- Removed `isPublic`/`is_public` from frontend API field mapping and recipe-pipeline load stage
- Added collection name display in recipe list header, inline rename in sidebar, stronger active indicator
- Widened collections sidebar to 256px

## 2026-03-12 (Recipe collections, invite UI, recipe page modernization — MOP-0002 P1/P2) `enhancement/chat`

- Added `recipe_collections` and `collection_recipes` tables (migration 011) for organizing recipes into shareable folders
- Default collections (Favorites, My Recipes) auto-created on signup via updated `handle_new_user()` trigger
- Added collection-level sharing inheritance: recipes in household/public collections are visible to appropriate users (migration 012)
- Added collections CRUD API methods and React Query hooks (`getMyCollections`, `createCollection`, `updateCollection`, `deleteCollection`, `addRecipeToCollection`, `removeRecipeFromCollection`)
- Added `CollectionsSidebar` component on Recipes page with create/delete and collection-filtered recipe list
- Added Household section to Settings page: household name editing, members list with roles, invite-by-email form
- Added pending invite banners on Settings page with Accept/Decline actions
- Redesigned `RecipeDetail` page: hero image with gradient overlay, colorful stat pills, glassmorphism cards, two-column layout (ingredients + nutrition / instructions), progress bar macros
- Added "Show more" ingredient truncation (10 item limit with expand/collapse)
- Redesigned `VisibilityPicker` as custom dropdown with icon pills, descriptions, and animations

## 2026-03-12 (Household model and recipe visibility — MOP-0002 P0) `enhancement/chat`

- Added `households`, `household_members`, and `household_invites` tables with full RLS (migration 009)
- Added `recipes.visibility` column (private/household/public) replacing the `is_public` boolean, with sync trigger for backward compatibility
- Updated `handle_new_user()` trigger to create household + membership on signup
- Added `household_id` and `managed_by` columns to `family_members` for linking dependents to households
- Backfill migration creates households for all existing users and links their family members
- Added SECURITY DEFINER helper functions (`is_household_member`, `get_household_role`) to prevent RLS infinite recursion
- Added `VisibilityPicker` component (segmented control: Only Me / My Household / Public)
- Added visibility picker to `StructuredRecipeDisplay` (recipe save from chat) and `RecipeDetail` (recipe view/edit)
- Added household CRUD methods and React Query hooks to `api.ts`: `getMyHousehold`, `updateHousehold`, `createHouseholdInvite`, `getMyPendingInvites`, `respondToInvite`, `updateRecipeVisibility`
- Updated `authStore` to load household membership (id, name, role) on auth initialization
- Updated `FamilyMembers` component to pass `householdId` and `managedBy` when creating dependents

## 2026-03-11 (Remove n8n dependency, direct RAG search) `feature/next-improvements`

- Removed n8n webhook dependency from chat pipeline — RAG search now runs directly in `chat-api` edge function
- Replaced `callRAGWorkflow()` (n8n webhook) with `handleRAGSearch()` (hybrid Supabase RPCs + OpenRouter)
- RAG search uses parallel semantic (embedding) + text (tsvector) search, deduplicates, and generates contextual AI response
- Fixed `handleGeneralChat` bug: `historyError` variable was referenced but never declared
- Removed `N8N_RAG_WEBHOOK_URL` from all env files (`.env`, `.env.local`, `chat-api/.env.local`)
- Removed n8n health check from `chat-api` `/health` endpoint
- Updated ARCHITECTURE.md, API.md with new RAG search flow documentation

## 2026-03-11 (UI overhaul and layout fixes) `feature/next-improvements`

- Implemented glassmorphism design system: semi-transparent backgrounds, backdrop blur, ambient glow orbs, grid overlay
- Restyled Header and ChatInterface sidebar to match new design language
- Fixed layout whitespace/overflow bug: sealed CSS height chain from `html`/`body`/`#root` through Layout `<main>`
- Chat page now uses `absolute inset-0` positioning to opt out of main scroll container
- Removed unnecessary scroll wrapper divs from all page components
- Switched Recipes page from legacy `recipeService` (localhost:3000) to `apiClient` (Supabase direct)
- Added slug-based recipe lookup to `apiClient.getRecipe(idOrSlug)`
- Updated Button and Card UI components
- Restyled Dashboard and MealPlanner pages

## 2026-03-10 (Documentation system overhaul) `feature/next-improvements`

- Created canonical documentation system: ARCHITECTURE.md, DATA_MODEL.md, API.md, RUNBOOK.md, CHANGELOG.md
- Created Documentation Update Procedure at `docs/prompts/DOCUMENTATION_UPDATE_PROCEDURE.md`
- Updated docs/README.md as a navigation index
- Reorganized existing documentation into structured categories

## 2026-03-10 (Next improvements) `feature/next-improvements`

- Updated chat workflow analysis and vector vs text search documentation
- Enhanced StructuredRecipeDisplay component for better recipe rendering
- Improved Layout component responsiveness
- Updated MealPlanCalendar component
- Enhanced RecipeSearch component
- Updated alert UI component
- Improved MeasurementSystemContext and useMeasurementUnits hook
- Updated useDocumentTitle hook
- Enhanced OpenRouter integration in `src/lib/openrouter.ts`
- Updated AI prompts: generalChat, intentRouter, recipeExtraction
- Improved database and embedding services
- Enhanced unit converter utility
- Updated SignIn and SignUp pages
- Updated Google OAuth setup documentation
- Modified migration files: 014 (unique recipe title), 015 (recipe images bucket), 016–017 (measurement system), 019 (drop unused tables), 020 (cleanup user preferences)
- Updated storage policies setup

---

## Pre-changelog history (retroactive summary)

> The following summarizes major milestones before this changelog was established.

### Phase 4: Chat & Session Management (Nov 2025)
- Implemented chat conversations and messages with metadata (migration 018)
- Added temporary session system for unresolved chats
- Multi-select chat deletion
- Automatic cleanup of unused sessions
- Created chat-api edge function with intent routing

### Phase 3: RAG System (Nov 2025)
- Added pgvector extension and embedding support (migration 008)
- Implemented semantic search RPCs (migration 009)
- Built hybrid search: vector (0.7 weight) + text (0.3 weight)
- Integrated OpenRouter for embeddings (text-embedding-ada-002, 1536-dim)
- Created RAG service layer (`src/services/ragService.ts`)
- Created embedding service (`src/services/embeddingService.js`)

### Phase 2: Recipe Management (Nov 2025)
- Created recipes table with full schema (migration 007)
- Added unique recipe title constraint per user (migration 014)
- Recipe image upload via Supabase Storage (migration 015)
- Full-text search with GIN indexes
- Recipe CRUD via API client

### Phase 1: Foundation (Aug–Nov 2025)
- Initial schema: profiles, ingredients, meal_plans, family_members (migration 001)
- Supabase Auth integration (Google OAuth + email/password)
- Profile auto-creation via database trigger
- Comprehensive RLS policies (migration 013)
- Measurement system preference (migrations 016–017)
- React + Vite + Tailwind frontend
- Zustand auth store, React Query for server state
- Page routing: Dashboard, Chat, Recipes, MealPlanner, Settings
- Theme system with dark mode support
