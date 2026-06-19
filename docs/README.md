# MealPrep Agent Documentation

> Navigation index for all project documentation. Start here to find what you need.

**Last reviewed:** 2026-06-16
**Last updated:** 2026-06-16 (added `draftRecipeStore`, `queryCache.ts` references; video intake docs in ARCHITECTURE/API/RUNBOOK)

---

## Canonical Documents

These are the authoritative references for the project. Keep them up to date using the [Documentation Update Procedure](prompts/DOCUMENTATION_UPDATE_PROCEDURE.md).

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System boundaries, data flow, auth, AI pipeline, patterns |
| [DATA_MODEL.md](DATA_MODEL.md) | Tables, columns, constraints, relationships, triggers, RLS policies |
| [API.md](API.md) | Edge functions, RPC contracts, OpenRouter endpoints, request/response shapes |
| [RUNBOOK.md](RUNBOOK.md) | Operational debugging checklists for known failure modes |
| [CHANGELOG.md](CHANGELOG.md) | User-visible changes by date (newest first) |

---

## Architecture

Detailed design documents for major subsystems.

| Document | Description |
|----------|-------------|
| [PRD.md](Architecture/PRD.md) | Product Requirements Document |
| [SDD.md](Architecture/SDD.md) | System Design Document |
| [RAG_ARCHITECTURE_DESIGN.md](Architecture/RAG_ARCHITECTURE_DESIGN.md) | RAG system architecture and design decisions |
| [RAG_IMPLEMENTATION_GUIDE.md](Architecture/RAG_IMPLEMENTATION_GUIDE.md) | Step-by-step RAG implementation guide |
| [RAG_SYSTEM_SUMMARY.md](Architecture/RAG_SYSTEM_SUMMARY.md) | RAG system summary and benefits |
| [CHAT_WORKFLOW_ANALYSIS.md](Architecture/CHAT_WORKFLOW_ANALYSIS.md) | Chat flow analysis and intent routing |
| [CHAT_DATABASE_SCHEMA.md](Architecture/CHAT_DATABASE_SCHEMA.md) | Chat tables schema documentation |

---

## Development

Setup guides, tooling, and operational procedures.

| Document | Description |
|----------|-------------|
| [LOCAL_DEVELOPMENT.md](Development/LOCAL_DEVELOPMENT.md) | Local development setup guide |
| [EDGE_FUNCTION_README.md](Development/EDGE_FUNCTION_README.md) | Edge function documentation |
| [VECTOR_VS_TEXT_SEARCH.md](Development/VECTOR_VS_TEXT_SEARCH.md) | Vector vs text search comparison |
| [GOOGLE_OAUTH_SETUP.md](GOOGLE_OAUTH_SETUP.md) | Google OAuth configuration |
| [SESSION_HANDOFF.md](SESSION_HANDOFF.md) | Latest session status and merge checklist (ephemeral — refresh each session) |

**Client config (code):** `src/config/queryCache.ts` (React Query stale times), `src/stores/draftRecipeStore.ts` (unsaved recipe preview cache).

---

## Features

Feature-specific implementation documentation.

| Document | Description |
|----------|-------------|
| [CHAT_SESSION_MANAGEMENT.md](Features/CHAT_SESSION_MANAGEMENT.md) | Chat session management implementation |
| [TEMPORARY_SESSION_SYSTEM.md](Features/TEMPORARY_SESSION_SYSTEM.md) | Temporary session system |
| [ENHANCED_SYSTEM_PROMPT.md](Features/ENHANCED_SYSTEM_PROMPT.md) | AI system prompt for Chef Marcus |
| [THEME.md](Features/THEME.md) | Theme system and dark mode |

---

## MOPs (Methods of Procedure)

Tracked improvement initiatives with `MOP-XXXX` numbering. See [MOPs/REGISTRY.md](MOPs/REGISTRY.md) for the full index.

| MOP | Title | Status |
|-----|-------|--------|
| [MOP-0001](MOPs/MOP-0001.md) | Recipe Pipeline Improvements (Images, Multi-Recipe, Quantities) | complete |
| [MOP-0002](MOPs/MOP-0002.md) | Family Sharing, Recipe Permissions & Collections | complete |
| [MOP-0003](MOPs/MOP-0003.md) | Dietary Profiles & Allergen Detection | draft |
| [MOP-0004](MOPs/MOP-0004.md) | Meal Planner & Grocery Cart | in_progress |
| [MOP-0005](MOPs/MOP-0005.md) | Test Coverage & Testing Infrastructure | in_progress |
| [MOP-0006](MOPs/MOP-0006.md) | Generated Supabase Types & API Typing | draft |
| [MOP-0007](MOPs/MOP-0007.md) | Wire RAG into Recipes Page, Meal Planner Suggestions, Reactions as Ranking Signal | draft |
| [MOP-0008](MOPs/MOP-0008.md) | Chat: Intent Router → Tool-Using Single Agent | draft |
| [MOP-0009](MOPs/MOP-0009.md) | Dev Automation Expansion (migration-rls-checker, scaffolders, runbook-recorder) | draft |
| [MOP-0010](MOPs/MOP-0010.md) | Lockticket MOP System (machine-verifiable acceptance criteria) | draft |
| [MOP-0011](MOPs/MOP-0011.md) | Normalize `meal_plans` JSONB → Child Tables | draft (deferred) |

> Status vocabulary is defined in [prompts/MOP_STATUS_LIFECYCLE.md](prompts/MOP_STATUS_LIFECYCLE.md).

---

## Architecture Decisions

Durable rationale for non-trivial architectural choices. ADRs are enumerated by directory glob (no registry file).

| Document | Description |
|----------|-------------|
| [DECISIONS/](DECISIONS/) | ADR directory (`ADR-XXXX-*.md`) — see [DECISIONS/README.md](DECISIONS/README.md) for the index protocol |
| [ADR-0001](DECISIONS/ADR-0001-meal-plans-jsonb-shape.md) | `meal_plans.meals` + `grocery_list` as JSONB columns (not normalized child tables) |
| [ADR-0002](DECISIONS/ADR-0002-legacy-express-dev-server.md) | Keep the legacy Express dev server alongside Supabase Edge Functions |
| [ADR-0003](DECISIONS/ADR-0003-documentation-and-agent-pattern-adoption.md) | Documentation and agent pattern adoption |

---

## Strategic Audits

| Document | Description |
|----------|-------------|
| [AI_INTEGRATION_AUDIT.md](AI_INTEGRATION_AUDIT.md) | Strategic review of MealPrep's AI surface (chat-api, recipe-pipeline, RAG, embeddings). Source for MOP-0007 through MOP-0011. |

---

## Procedures

| Document | Description |
|----------|-------------|
| [DOCUMENTATION_UPDATE_PROCEDURE.md](prompts/DOCUMENTATION_UPDATE_PROCEDURE.md) | Canonical documentation update procedure (invoked by `/update-docs`) |
| [MOP_STATUS_LIFECYCLE.md](prompts/MOP_STATUS_LIFECYCLE.md) | MOP status vocabulary and allowed transitions |
| [MOP_VERIFICATION_POLICY.md](prompts/MOP_VERIFICATION_POLICY.md) | Hard gate for MOP `complete` — no manual verification steps |
| [DOMAIN_TEST_MATRIX.md](prompts/DOMAIN_TEST_MATRIX.md) | Domain → test suite routing for integrity-orchestrator |
| [MOP_COMPLIANCE_AUDIT.md](prompts/MOP_COMPLIANCE_AUDIT.md) | Audit of which MOPs have verification blocks / human gates |
| [ADR_AUTHORING_GUIDE.md](prompts/ADR_AUTHORING_GUIDE.md) | ADR format, numbering, lifecycle, and authoring criteria |

### Slash commands

| Command | Purpose |
|---------|---------|
| `/new-mop` | Scaffold a new MOP from `MOPs/MOP_TEMPLATE.md` and register it |
| `/new-adr` | Scaffold a new ADR in `DECISIONS/` |
| `/update-registry` | Recompute `MOPs/REGISTRY.md` from the filesystem to catch manual drift |
| `/update-docs` | Run the documentation update procedure after a MOP is marked complete |
| `/integrity-check` | Run domain-routed integrity tests (`integrity-orchestrator`) |
| `/verify-mop` | Verify a MOP's automated acceptance block (rejects human gates) |

### Secret scanning (gitleaks)

- Config lives at `.gitleaks.toml`.
- Pre-commit hook lives at `.githooks/pre-commit` and scans staged changes.
- One-time setup:
  - PowerShell: `./scripts/install-git-hooks.ps1`
  - Bash: `./scripts/install-git-hooks.sh`
- Install gitleaks (no Docker):
  - Windows: `winget install Gitleaks.Gitleaks` or `scoop install gitleaks`
  - macOS: `brew install gitleaks`
  - Linux: see [gitleaks releases](https://github.com/gitleaks/gitleaks/releases)

### Development without Docker

Normal dev uses your **hosted** Supabase project via `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Local Supabase (`supabase start`) is optional and not required.

---

## Archived

Outdated documentation from earlier phases. Kept for historical reference.

| Document | Description |
|----------|-------------|
| [ARCHITECTURE_DECISIONS.md](Archived/ARCHITECTURE_DECISIONS.md) | Pre-RAG architecture decisions |
| [IMPLEMENTATION_STATUS.md](Archived/IMPLEMENTATION_STATUS.md) | Outdated implementation status |
| [CHECKLIST.md](Archived/CHECKLIST.md) | Outdated implementation checklist |
| [FRONTEND_CHECKLIST.md](Archived/FRONTEND_CHECKLIST.md) | Outdated frontend checklist |
| [PRIORITY_ASSESSMENT.md](Archived/PRIORITY_ASSESSMENT.md) | Outdated priority assessment |
| [DEPLOYMENT_GUIDE.md](Archived/DEPLOYMENT_GUIDE.md) | Outdated deployment guide |
| [n8n-config.md](Architecture/n8n-config.md) | n8n workflow configuration (removed) |
| [DEPLOY_TO_N8N_SERVER.md](Development/DEPLOY_TO_N8N_SERVER.md) | n8n server deployment (removed) |
| [N8N_URL_OPTIONS.md](Development/N8N_URL_OPTIONS.md) | n8n URL options (removed) |
| [N8N_SUPABASE_INTEGRATION.md](Development/N8N_SUPABASE_INTEGRATION.md) | n8n + Supabase integration (removed) |

---

## Tech Stack Quick Reference

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| State | Zustand + React Query |
| Database | PostgreSQL via Supabase + pgvector |
| Auth | Supabase Auth (Google OAuth + email/password) |
| AI/LLM | OpenRouter (Qwen 2.5 models) |
| Embeddings | text-embedding-ada-002 (1536-dim) |
| Edge Functions | Supabase Edge Functions (Deno) |
| Storage | Supabase Storage |
