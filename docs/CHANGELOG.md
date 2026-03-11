# Changelog

> User-visible changes by date for MealPrep Agent. Newest entries first.

**Last reviewed:** 2026-03-10
**Last updated:** 2026-03-10 (initial canonical doc creation)

---

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
