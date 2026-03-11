# Architecture

> System boundaries, data flow, authentication, AI pipeline, and architectural patterns for MealPrep Agent.

**Last reviewed:** 2026-03-11
**Last updated:** 2026-03-11 (layout architecture, glassmorphism design system, recipe service migration)

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
- **Frontend ↔ OpenRouter**: Direct API calls from `src/lib/openrouter.ts` for chat, embeddings, and intent detection.
- **Edge Functions**: `chat-api` handles server-side chat processing with intent routing, accessible via Supabase Functions invoke.
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
4. Frontend `authStore` (Zustand) tracks session state
5. Supabase client auto-refreshes JWT tokens
6. Edge functions validate JWT from `Authorization: Bearer` header

### Account Linking
- Users can link/unlink Google to an existing email account
- `supabase.ts` provides: `linkGoogleAccount()`, `unlinkGoogleAccount()`, `getLinkedAccounts()`
- Identity array on user object tracks linked providers

### Implementation Files
- `src/services/supabase.ts` — auth service methods
- `src/stores/authStore.ts` — Zustand auth state
- `src/pages/AuthCallback.tsx` — OAuth redirect handler
- `src/pages/SignIn.tsx`, `src/pages/SignUp.tsx` — auth pages

---

## AI Pipeline

### Intent Detection
When a user sends a message, the system classifies intent into one of three categories:

| Intent | Description | Model |
|--------|-------------|-------|
| `recipe_extraction` | User is sharing/adding a recipe (text or image) | `qwen/qwen-2.5-vl-7b-instruct` (vision) |
| `rag_search` | User is searching their recipe collection | `qwen/qwen-3-8b` |
| `general_chat` | General cooking questions, conversation | `qwen/qwen-3-8b` |

Intent detection runs via OpenRouter with a classification prompt defined in `src/prompts/intentRouter.ts`.

### RAG Search Pipeline
1. User query → `EmbeddingService.generateEmbedding()` (ada-002, 1536-dim)
2. Hybrid search executes in parallel:
   - **Vector search**: cosine similarity against `recipes.embedding_vector` (weight: 0.7, threshold: 0.5)
   - **Text search**: PostgreSQL full-text search against `recipes.searchable_text` (weight: 0.3)
3. Results deduplicated by recipe ID, combined scores ranked
4. Top K results returned as context for AI response generation
5. AI generates contextual response using recipe context

### Recipe Extraction Pipeline
1. User sends text/images (up to 4 images supported)
2. Vision model (`qwen-2.5-vl-7b-instruct`) processes content
3. Structured JSON recipe extracted (title, ingredients, instructions, metadata)
4. Recipe saved to `recipes` table
5. Embedding generated and stored in `recipes.embedding_vector`
6. Full-text index updated automatically via trigger

### Prompts
System prompts are defined in `src/prompts/`:
- `intentRouter.ts` — intent classification prompt
- `recipeExtraction.ts` — recipe extraction prompt
- `generalChat.ts` — Chef Marcus conversational prompt

### OpenRouter Client
`src/lib/openrouter.ts` provides:
- `chat()` — simple text completion
- `chatWithHistory()` — stateful multi-turn chat
- `chatWithImages()` — multi-modal (vision) completion
- `chatJSON()` — structured JSON output

---

## Frontend Architecture

### Routing

| Route | Page | Auth |
|-------|------|------|
| `/` | LandingPage | Public |
| `/signin` | SignIn | Public |
| `/signup` | SignUp | Public |
| `/auth/callback` | AuthCallback | Public (OAuth redirect) |
| `/dashboard` | Dashboard | Protected |
| `/chat` | Chat | Protected |
| `/recipes` | Recipes | Protected |
| `/meal-planner` | MealPlanner | Protected |
| `/settings` | Settings | Protected |

### State Management
- **Zustand stores** (`src/stores/`): Auth state, theme state — client-side, persistent
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
├── auth/          # Auth-related components
├── chat/          # ChatInterface, StructuredRecipeDisplay
├── common/        # Layout, Header
├── debug/         # Debug utilities
├── family/        # Family member management
├── meal-planning/ # MealPlanCalendar
├── recipes/       # RecipeList, RecipeCard, RecipeDetail, RecipeForm, RecipeSearch
└── ui/            # Radix-based primitives (alert, dialog, select, etc.)
```

### API Layer
`src/services/api.ts` is a singleton HTTP client wrapping Supabase calls with:
- Automatic camelCase ↔ snake_case field mapping
- React Query hooks for all CRUD operations
- Methods for: recipes, chat, meal plans, preferences, images, RAG search
- Recipe lookup by UUID or URL slug (`getRecipe(idOrSlug)`)

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
ChatInterface → OpenRouter (intent detection)
             → OpenRouter (chat/vision/RAG based on intent)
             → Supabase (save conversation + messages)
             → If recipe_extraction: save recipe → generate embedding
```

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
- Exception: `recipes` — users can read public recipes (`is_public = true`)
- Exception: `family_members` — users can access members in their family group
- Exception: `ingredients`, `roles` — read-only for all authenticated users (shared catalogs)

### API Security
- Supabase anon key used for client-side requests (RLS enforces access)
- Edge functions validate JWT and extract user ID
- OpenRouter API key stored as `VITE_OPENROUTER_API_KEY` (frontend) and `OPENROUTER_API_KEY` (edge functions)

---

## Environment Variables

### Required
| Variable | Context | Purpose |
|----------|---------|---------|
| `VITE_SUPABASE_URL` | Frontend | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Supabase anonymous key |
| `VITE_OPENROUTER_API_KEY` | Frontend | OpenRouter API key for client-side AI calls |
| `OPENROUTER_API_KEY` | Edge Functions | OpenRouter API key for server-side AI calls |

### Optional
| Variable | Context | Purpose |
|----------|---------|---------|
| `N8N_RAG_WEBHOOK_URL` | Backend | n8n webhook for RAG workflow integration |
| `VITE_FRONTEND_URL` | Frontend | Frontend URL for OAuth redirects |
| `LOCAL_API_URL` | Development | Local API server URL |

---

## Storage

### Supabase Storage
- **Bucket:** `recipe-images`
- **Path pattern:** `{userId}/recipes/{timestamp}-{random}.{ext}`
- **Access:** Private (signed URLs)
- **Limits:** 5MB max file size, `image/*` types only

---

## Future / Planned

- **n8n Integration**: Webhook URL configured but not fully active — intended for advanced RAG orchestration
- **Receipt OCR**: Tables exist (`receipts`) but processing pipeline not implemented
- **Real-time Chat**: Express server infrastructure exists for WebSocket support

---

## Known Anti-patterns (Avoid)

- **Double scroll wrappers**: Do not add `h-full overflow-y-auto` wrapper divs around page content — this breaks the sealed height chain and causes whitespace/overflow issues. Let `<main>` in Layout handle scroll.
- **`min-h-screen` on page roots**: This creates content taller than the viewport, causing double scrollbars.
- **`recipeService.ts`**: Legacy service that hits `localhost:3000` (non-existent API server). Use `apiClient` from `src/services/api.ts` instead — it queries Supabase directly.
