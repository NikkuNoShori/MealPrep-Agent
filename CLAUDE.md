# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev          # Start Vite dev server (port 5173)
npm run build        # TypeScript check + Vite build (tsc && vite build)
npm run lint         # ESLint with zero-warning policy
npm run preview      # Preview production build
npm run dev:all      # Run Express server + Vite concurrently
```

Supabase Edge Functions are deployed separately and run on Deno (not Node).

## Naming Conventions

- **camelCase** — variables, functions, class methods
- **PascalCase** — classes, types, interfaces, React components
- **snake_case** — database schemas and column names
- **UPPER_CASE** — configuration constants

## Architecture

**Stack:** React 18 + TypeScript + Vite frontend, Supabase (PostgreSQL + Edge Functions) backend, OpenRouter API for LLM (Qwen 2.5 models), pgvector for semantic search.

**Frontend state:** Zustand stores for client state (auth, theme), React Query for server state and caching. All HTTP calls go through `src/services/api.ts` which handles camelCase ↔ snake_case mapping automatically.

**Auth:** Supabase Auth with Google OAuth + email/password. Auth state in `src/stores/authStore.ts`, client in `src/services/supabase.ts`. Routes protected via `ProtectedRoute` component.

**Edge Functions (Deno, `supabase/functions/`):**
- `chat-api/` — Intent detection routes messages to recipe_extraction, rag_search, or general_chat
- `recipe-pipeline/` — Adapters (url, text, video) → stages (extract, transform, load) with embeddings
- `_shared/` — OpenRouter client, prompts, schemas, CORS, Supabase client

**RAG search:** User query → ada-002 embedding → hybrid semantic (cosine similarity) + full-text PostgreSQL search → deduplicated results as LLM context.

**Layout pattern (sealed height chain):** `html/body/#root` all `height:100%; overflow:hidden`. Layout component fills viewport with `h-screen flex flex-col`. The `<main>` element is the single scroll container (`flex-1 min-h-0 overflow-y-auto`). Pages render content directly — never add wrapper scroll divs. Chat page is an exception: uses `absolute inset-0 overflow-hidden` for its own scroll management.

## Key Rules

- Do not add `min-h-screen` to page roots (breaks sealed height chain, causes double scrollbars)
- Use `src/services/api.ts` for all HTTP calls — never call APIs directly from components
- Edge functions handle all LLM/AI work — no AI calls from the frontend except through edge functions
- All database tables use RLS (Row Level Security)
- Path aliases configured: `@/` maps to `src/` (also `@/components`, `@/stores`, etc.)
- When chaining shell commands, use `;` instead of `&&`

## Documentation

- `docs/ARCHITECTURE.md` — System design and data flow
- `docs/DATA_MODEL.md` — Database schema and RLS policies
- `docs/API.md` — REST API endpoints
- `docs/RUNBOOK.md` — Operational debugging checklists
- `docs/MOPs/` — Method of Procedures for planned features (see `REGISTRY.md`)
