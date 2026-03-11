# MealPrep Agent Documentation

> Navigation index for all project documentation. Start here to find what you need.

**Last reviewed:** 2026-03-11
**Last updated:** 2026-03-10 (documentation system overhaul)

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
| [n8n-config.md](Architecture/n8n-config.md) | n8n workflow configuration |

---

## Development

Setup guides, tooling, and operational procedures.

| Document | Description |
|----------|-------------|
| [LOCAL_DEVELOPMENT.md](Development/LOCAL_DEVELOPMENT.md) | Local development setup guide |
| [EDGE_FUNCTION_README.md](Development/EDGE_FUNCTION_README.md) | Edge function documentation |
| [VECTOR_VS_TEXT_SEARCH.md](Development/VECTOR_VS_TEXT_SEARCH.md) | Vector vs text search comparison |
| [DEPLOY_TO_N8N_SERVER.md](Development/DEPLOY_TO_N8N_SERVER.md) | n8n server deployment guide |
| [N8N_URL_OPTIONS.md](Development/N8N_URL_OPTIONS.md) | n8n URL configuration options |
| [N8N_SUPABASE_INTEGRATION.md](Development/N8N_SUPABASE_INTEGRATION.md) | n8n + Supabase integration guide |
| [GOOGLE_OAUTH_SETUP.md](GOOGLE_OAUTH_SETUP.md) | Google OAuth configuration |

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

## Procedures

| Document | Description |
|----------|-------------|
| [DOCUMENTATION_UPDATE_PROCEDURE.md](prompts/DOCUMENTATION_UPDATE_PROCEDURE.md) | Instructions for performing a canonical documentation update after code changes |

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
