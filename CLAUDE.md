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
- `docs/DECISIONS/` — Architecture Decision Records (ADRs)
- `docs/prompts/` — Authoritative procedure docs (`DOCUMENTATION_UPDATE_PROCEDURE.md`, `MOP_STATUS_LIFECYCLE.md`, `ADR_AUTHORING_GUIDE.md`)

## Surface-review reflex

When you (the assistant) use phrases like **"worth surfacing"**, "worth recording", "worth noting", "should flag", "deserves attention", "latent bug", "architectural concern", or otherwise indicate a non-trivial finding that warrants capture, **invoke the `surface-reviewer` subagent** with the finding(s) as context. Do not let findings die in chat history.

The `surface-reviewer` agent will:
1. Classify each finding (trivial-fix / ADR / MOP / MOP+ADR / already-covered / defer-with-trigger)
2. Assign priority (P0–P3 or defer) with specific rationale
3. Draft any warranted MOP/ADR files
4. Present a priority-ranked recommendation

Tone: document, respond, react. Measured, not reactive. Security/safety findings default to P0/P1 with specific risk language.

Equivalent user-invoked path: `/surface` slash command.

## Agent + skill inventory

| Agent | Purpose |
|---|---|
| `doc-adherence` | Documentation compliance audit; supersedes `doc-keeper` |
| `qa-auditor` | Architectural rule audit |
| `integrity-orchestrator` | Domain-routed test execution (DOMAIN_TEST_MATRIX) |
| `data-integrity` | Deep numeric + RLS verification (after orchestrator) |
| `meal-planning-sme` | Meal planner + grocery cart expert |
| `household-sme` | Household sharing + invites + visibility expert |
| `platform-auth-sme` | Auth, session, OAuth, profiles, username expert |
| `recipe-pipeline-sme` | Recipe pipeline + library expert |
| `chat-rag-sme` | Chat + RAG + search expert |
| `ui-designer` | Premium UI restyling |
| `cooking-bot-architect` | In-product AI agent design + implementation |
| `surface-reviewer` | Mid-session finding triage → MOP/ADR/inline disposition |

| Skill | Purpose |
|---|---|
| `/update-docs` | Run the doc update procedure after a MOP completes |
| `/new-mop` | Scaffold next sequential MOP from template |
| `/new-adr` | Scaffold next sequential ADR from authoring guide |
| `/update-registry` | Reconcile `REGISTRY.md` against on-disk MOP headers |
| `/integrity-check` | Run domain-routed integrity tests |
| `/verify-mop` | Verify MOP acceptance block (no human gates) |
| `/surface` | User-invoked surface review |
