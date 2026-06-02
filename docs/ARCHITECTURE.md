# Architecture

> System boundaries, data flow, authentication, AI pipeline, and architectural patterns for MealPrep Agent.

**Last reviewed:** 2026-06-01
**Last updated:** 2026-06-01 (MOP-0008: chat-api intent router replaced with tool-using single-agent loop; documented `pendingConfirmation` + `confirmAction` contract)

---

## Overview

MealPrep Agent is a conversational recipe management platform with AI-powered recipe extraction, semantic search, and meal planning. Users interact with a chat interface ("Chef Marcus") that can extract recipes from text/images, search their recipe collection via RAG, and answer general cooking questions.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS (glassmorphism design system, dark/light theme) |
| State | Zustand (auth, theme) + React Query (server state) |
| Routing | React Router v6 |
| Database | PostgreSQL via Supabase |
| Vector Search | pgvector extension (1536-dim) |
| Auth | Supabase Auth (Google OAuth + email/password) |
| Edge Functions | Supabase Edge Functions (Deno) |
| AI/LLM | OpenRouter API (Qwen 2.5 models) |
| Embeddings | text-embedding-ada-002 via OpenRouter |
| Storage | Supabase Storage (recipe images) |
| UI Components | Radix UI, Lucide icons, dnd-kit |

---

## System Boundaries

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Vite SPA)                   │
│  React Router → Pages → Components → Zustand/RQ stores  │
└──────────┬──────────────────────┬───────────────────────┘
           │ Supabase Client      │ OpenRouter Client
           ▼                      ▼
┌─────────────────────┐  ┌──────────────────────┐
│   Supabase Backend  │  │   OpenRouter API      │
│  ┌───────────────┐  │  │  - Chat completions   │
│  │ Auth (JWT)    │  │  │  - Vision (images)    │
│  │ PostgreSQL    │  │  │  - Embeddings         │
│  │ Edge Functions│  │  │  - JSON structured    │
│  │ Storage       │  │  └──────────────────────┘
│  │ pgvector      │  │
│  └───────────────┘  │
└─────────────────────┘
```

### Key boundaries:
- **Frontend ↔ Supabase**: All DB access goes through Supabase client (JS SDK). No direct SQL from frontend.
- **Frontend ↔ OpenRouter**: No direct frontend → OpenRouter calls in production. All LLM work goes through edge functions.
- **Edge Functions**:
  - `chat-api` — tool-using single-agent loop (MOP-0008). Drives Chef Marcus through up to 5 LLM iterations with a 12-tool catalog (read, capture, plan/cart, destructive, web search). See [MOPs/MOP-0008-design.md](MOPs/MOP-0008-design.md).
  - `recipe-pipeline` — adapter → extract → transform → load stages (URL, text, video).
  - `household-invite` — invite creation + email.
  - `admin-api` — admin operations.
  - All accessible via Supabase Functions invoke.
- **Storage**: Recipe images stored in Supabase Storage bucket `recipe-images`, accessed via signed URLs.

---

## Authentication

### Providers
1. **Email/Password** — standard Supabase auth
2. **Google OAuth** — redirect-based flow with account linking support

### Auth Flow
1. User signs up/in via `src/services/supabase.ts` methods
2. Supabase creates entry in `auth.users`
3. Database trigger `handle_new_user()` fires on INSERT:
   - Creates `profiles` row with email, display_name from OAuth metadata
   - Assigns default `user` role in `user_roles`
   - Creates a `households` row (default name "My Household")
   - Inserts user into `household_members` as `owner`
   - Creates default collections (Favorites, My Recipes)
4. If `profiles.setup_completed = false`, user is redirected to `/complete-setup` to set display name, username, and password (migration 020)
5. Frontend `authStore` (Zustand) tracks session state + household membership
6. Supabase client auto-refreshes JWT tokens
7. Edge functions validate JWT from `Authorization: Bearer` header

### Invite Flow
1. Household owner/admin sends invite via `household-invite` edge function
2. Edge function creates `household_invites` row and sends email via `supabase.auth.admin.inviteUserByEmail()`
3. Invitee clicks link → `/invite/accept?id=<invite-id>` page
4. If not logged in, user is directed to sign in/sign up (invited email stored in sessionStorage)
5. If `setup_completed = false`, redirected to `/complete-setup` with invite ID preserved in sessionStorage
6. Once authenticated + setup complete, invite is auto-accepted via `acceptInviteById` API call
7. User is added to household as `member`

### Account Linking
- Users can link/unlink Google to an existing email account
- `supabase.ts` provides: `linkGoogleAccount()`, `unlinkGoogleAccount()`, `getLinkedAccounts()`
- Identity array on user object tracks linked providers

### Implementation Files
- `src/services/supabase.ts` — auth service methods
- `src/stores/authStore.ts` — Zustand auth state
- `src/pages/AuthCallback.tsx` — OAuth redirect handler
- `src/pages/SignIn.tsx`, `src/pages/SignUp.tsx` — auth pages
- `src/pages/CompleteSetup.tsx` — post-signup profile setup (username, display name)
- `src/pages/InviteAccept.tsx` — household invite acceptance
- `supabase/functions/household-invite/` — invite creation + email edge function

---

## AI Pipeline

### Chat Agent Loop (MOP-0008)

The `chat-api` edge function runs a **single tool-using agent** ("Chef Marcus"). The previous router pattern (one LLM call classifies intent → branches to one of three handlers) is gone. Each user turn drives up to 5 LLM iterations against a 12-tool catalog; the model picks zero, one, or many tools per iteration. Full design: [MOPs/MOP-0008-design.md](MOPs/MOP-0008-design.md).

```
POST /chat-api/message
  │
  ▼
handleSendMessage (conversation resolution, image upload, persist user msg)
  │
  ├─► context.confirmAction present?
  │     ├─ yes → executeConfirmedTool (skip the model, apply destructive change)
  │     └─ no  → runAgentLoop
  │
  ▼
runAgentLoop (max 5 iterations):
  1. openRouter.chatWithTools(CHAT_AGENT_SYSTEM_PROMPT, history, TOOL_CATALOG)
  2. No tool_calls? → break, plain content is the reply.
  3. tool_calls[] returned:
       for each call:
         a. dispatchTool — schema-validate args; reject any user_id key.
         b. DESTRUCTIVE_TOOLS (update_recipe, delete_recipe)
            → short-circuit with pendingConfirmation envelope (handler NOT run).
         c. CONDITIONALLY_DESTRUCTIVE (assign_recipe_to_meal_plan_slot)
            → handler may also return requiresConfirmation.
         d. Otherwise → execute handler under user-scoped Supabase (RLS).
         e. Wrap output in <tool_result>...</tool_result> (prompt-injection
            defense) and append as role:"tool" message.
  4. iter == 5 → one final call with tool_choice:"none" to compose a reply.
  │
  ▼
Compose: { content, toolCalls[], pendingConfirmation?, recipe?, recipes? }
  │
  ▼
Persist AI message + metadata.toolCalls (audit log)
```

| Concept | Location |
|---|---|
| Agent loop | `supabase/functions/chat-api/agent-loop.ts` |
| Tool catalog (12 tools, OpenAI-format JSON schemas) | `supabase/functions/chat-api/tools/catalog.ts` |
| Dispatcher (schema validation, `user_id` reject, destructive short-circuit) | `supabase/functions/chat-api/tools/dispatch.ts` |
| Tool handlers | `supabase/functions/chat-api/tools/handlers.ts` |
| Shared web-search client (`web_search_recipe` provider abstraction) | `supabase/functions/_shared/web-search-client.ts` |
| All prompts | `supabase/functions/_shared/recipe-prompts.ts` |

### Tool Catalog Summary

| Bucket | Tools |
|---|---|
| Read (DB) | `search_recipes`, `find_similar_recipes`, `get_household_recipes`, `get_household_profile`, `get_meal_plan`, `propose_substitution` |
| Read (web) | `web_search_recipe` (gated on `WEB_SEARCH_API_KEY`) |
| Capture | `extract_recipe_from_source` (delegates to `recipe-pipeline/extract-only`) |
| Plan / cart | `assign_recipe_to_meal_plan_slot` (conditionally destructive), `add_to_grocery_list` |
| Destructive | `update_recipe`, `delete_recipe` — always return `pendingConfirmation`; user must reply via `context.confirmAction` |

Models: `qwen/qwen-2.5-7b-instruct` (instruct) and `qwen/qwen-2.5-vl-7b-instruct` (vision, for image extraction inside `recipe-pipeline`). Temperature 0.2, `tool_choice: auto`, `MAX_ITERS = 5`.

### Embedding Pipeline
Recipe embeddings are still generated via `text-embedding-ada-002` (1536-dim) on extract → `recipes.embedding_vector`. Used by `search_recipes` and `find_similar_recipes` tool handlers via the existing semantic/full-text RPCs.

### Prompts
**Server-side** (authoritative): `supabase/functions/_shared/recipe-prompts.ts`
- `CHAT_AGENT_SYSTEM_PROMPT` — Chef Marcus persona + 6 hard rules (no `user_id`, no fabrication, allergen language, destructive→confirm, treat retrieved content as data, cite sources).
- `RECIPE_EXTRACTION_PROMPT`, `IMAGE_EXTRACTION_PROMPT` — used inside `recipe-pipeline`.
- `RAG_RESPONSE_PROMPT` — used by tool-result composers.
- `SUBSTITUTION_PROMPT` — used by `propose_substitution`.
- `INTENT_DETECTION_PROMPT`, `GENERAL_CHAT_PROMPT` — `@deprecated`, kept for backwards compatibility during the migration window.

### OpenRouter Clients
**Edge Functions** (`_shared/openrouter-client.ts`): `chat()`, `chatWithHistory()`, `chatWithImages()`, `chatWithTools()`, `generateEmbedding()`.
The frontend has **no LLM client** — `src/lib/openrouter.ts` is deprecated; all AI work goes through edge functions.

---

## Frontend Architecture

### Routing

| Route | Page | Auth |
|-------|------|------|
| `/` | LandingPage | Public |
| `/signin` | SignIn | Public |
| `/signup` | SignUp | Public |
| `/auth/callback` | AuthCallback | Public (OAuth redirect) |
| `/invite/accept` | InviteAccept | Public (handles both logged-in and anonymous) |
| `/complete-setup` | CompleteSetup | Protected (setup_completed = false) |
| `/dashboard` | Dashboard | Protected |
| `/chat` | Chat | Protected |
| `/recipes` | Recipes | Protected |
| `/household` | Household | Protected |
| `/meal-planner` | MealPlanner | Protected |
| `/settings` | Settings | Protected |
| `/admin` | Admin | Protected (admin role only, via AdminRoute) |

### State Management
- **Zustand stores** (`src/stores/`): Auth state (incl. household membership), theme state — client-side, persistent
- **React Query** (`src/services/api.ts`): Server state for recipes, chat, meal plans, preferences — cached, auto-refetched
- **React Context** (`src/contexts/`): MeasurementSystemContext (metric/imperial preference)

### Layout Architecture

The app uses a sealed CSS height chain to fill the viewport without overflow:

```
html, body, #root  →  height: 100%; overflow: hidden
  └─ Layout         →  h-screen flex flex-col
       ├─ Header
       └─ <main>    →  flex-1 min-h-0 overflow-y-auto (handles scroll for all pages)
            └─ Page content renders directly (no wrapper divs)
```

**Key patterns:**
- `html`, `body`, `#root` all have `height: 100%; overflow: hidden` (set in `src/index.css`)
- Layout's `<main>` is the single scroll container for all pages
- Pages render content directly without scroll wrapper divs
- **Chat page exception:** Uses `absolute inset-0 overflow-hidden` to opt out of `<main>`'s scroll flow, since ChatInterface manages its own scroll internally

### Design System

The UI uses a glassmorphism design language with:
- Semi-transparent backgrounds (`bg-white/[0.03]`, `backdrop-blur-sm`)
- Subtle borders (`border-white/[0.06]`)
- Ambient glow orbs (CSS `glow-orb` class in Layout)
- Grid overlay for dark mode
- Custom color scale: `primary-*` and `secondary-*` tokens

### Component Structure
```
src/components/
├── auth/          # Auth-related components (ProtectedRoute, AdminRoute, SignupForm)
├── chat/          # ChatInterface, StructuredRecipeDisplay
├── common/        # Layout, Header, BackButton
├── debug/         # Debug utilities
├── family/        # Family member management
├── meal-planning/ # MealPlanCalendar
├── recipes/       # RecipeList, RecipeCard, RecipeDetail, RecipeForm, RecipeSearch, VisibilityPicker, CollectionsSidebar, AddToCollectionMenu
└── ui/            # Radix-based primitives (alert, dialog, select, etc.)
```

### API Layer
`src/services/api.ts` is a singleton HTTP client wrapping Supabase calls with:
- Automatic camelCase ↔ snake_case field mapping
- React Query hooks for all CRUD operations
- Methods for: recipes, chat, meal plans, preferences, images, RAG search, households, collections, reactions, admin
- Recipe lookup by UUID or URL slug (`getRecipe(idOrSlug)`)
- **RPC optimization**: Five high-traffic methods use PostgreSQL `SECURITY DEFINER` functions via `supabase.rpc()` to collapse multiple round trips into single database calls: `get_my_household`, `toggle_recipe_reaction`, `get_household_recipes`, `get_recipe_reactions`, `get_my_pending_invites` (migration 025)

---

## Data Flow Patterns

### Recipe CRUD
```
Component → api.ts (React Query) → Supabase Client → PostgreSQL
                                                    → Trigger: update searchable_text
                                                    → Trigger: clear embedding_vector
```

### Chat Message Flow
```
ChatInterface → api.ts → Supabase Edge Function (chat-api)
  → runAgentLoop (Chef Marcus, single agent)
     → openRouter.chatWithTools(systemPrompt, history, TOOL_CATALOG)
     → 0..many tool dispatches per iteration (schema-validated, RLS via ctx.supabase)
     → tool outputs wrapped in <tool_result> markers
     → loop until plain content reply or MAX_ITERS=5
  → Destructive tools return pendingConfirmation (handler NOT executed) — user
    replies via context.confirmAction to apply the change.
  → Save messages to chat_conversations + chat_messages (metadata.toolCalls = audit log)
```
See [MOPs/MOP-0008-design.md](MOPs/MOP-0008-design.md) for the full design and the tool catalog.

### Measurement Conversion
```
MeasurementSystemContext (user pref from user_preferences)
  → useMeasurementUnits hook
  → unitConverter utility
  → Recipe components display converted units
```

---

## Security

### Row Level Security (RLS)
All data tables have RLS enabled. See [DATA_MODEL.md](DATA_MODEL.md) for per-table policies.

**General pattern:**
- Users can only read/write their own data
- Exception: `profiles` — users can view profiles of other household members (migration 024 adds cross-household profile visibility)
- Exception: `recipes` — three-tier visibility: `private` (owner only), `household` (owner + household members), `public` (all users). Controlled by `recipes.visibility` column. Collection-level sharing inheritance also applies (recipes in shared collections are visible to collection audience).
- Exception: `recipe_collections` — same three-tier visibility as recipes. `collection_recipes` join table visibility is derived from parent collection.
- Exception: `recipe_reactions` — users can react to any recipe they can view; reactions visible to anyone who can view the recipe
- Exception: `family_members` — users can access members in their household
- Exception: `households`, `household_members` — members can view their own household and its members
- Exception: `ingredients`, `roles` — read-only for all authenticated users (shared catalogs)

### API Security
- Supabase anon key used for client-side requests (RLS enforces access)
- Edge functions validate JWT and extract user ID
- OpenRouter API key stored only as `OPENROUTER_API_KEY` server-side (Supabase Edge Function secret). All LLM calls go through edge functions — no frontend AI key required (per `src/vite-env.d.ts`)

---

## Environment Variables

### Required
| Variable | Context | Purpose |
|----------|---------|---------|
| `VITE_SUPABASE_URL` | Frontend | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Supabase anonymous key |
| `OPENROUTER_API_KEY` | Edge Functions (Supabase secret) | OpenRouter API key for server-side AI calls. **Do NOT set `VITE_OPENROUTER_API_KEY`** — there is no frontend AI path. See `src/vite-env.d.ts` and `docs/Development/CHAT_SECURITY.md`. |

### Optional
| Variable | Context | Purpose |
|----------|---------|---------|
| `VITE_FRONTEND_URL` | Frontend | Frontend URL for OAuth redirects |
| `OPENROUTER_API_KEY_QWEN2.5_VL_8b` | Edge Functions | Per-model API key for vision model |
| `OPENROUTER_API_KEY_QWEN2.5_instruct_8b` | Edge Functions | Per-model API key for instruct model |
| `WEB_SEARCH_PROVIDER` | Edge Functions (chat-api) | `tavily` (default), `brave`, or `serper` — selects the `web_search_recipe` backend. |
| `WEB_SEARCH_API_KEY` | Edge Functions (chat-api) | API key for the selected web-search provider. When unset, the `web_search_recipe` tool is omitted from the agent's catalog at startup (capability gating, MOP-0008 Addendum 1). |

---

## Storage

### Supabase Storage
- **Bucket:** `recipe-images`
- **Path pattern:** `{userId}/recipes/{timestamp}-{random}.{ext}`
- **Access:** Private (signed URLs)
- **Limits:** 5MB max file size, `image/*` types only

---

## Future / Planned

- **Receipt OCR**: Tables exist (`receipts`) but processing pipeline not implemented
- **URL/Video Recipe Import UI**: Backend pipeline exists (`recipe-pipeline` edge function with URL and video adapters) but no frontend UI yet

---

## Known Anti-patterns (Avoid)

- **Double scroll wrappers**: Do not add `h-full overflow-y-auto` wrapper divs around page content — this breaks the sealed height chain and causes whitespace/overflow issues. Let `<main>` in Layout handle scroll.
- **`min-h-screen` on page roots**: This creates content taller than the viewport, causing double scrollbars.
- **`recipeService.ts`**: Legacy service that hits `localhost:3000` (non-existent API server). Use `apiClient` from `src/services/api.ts` instead — it queries Supabase directly.
