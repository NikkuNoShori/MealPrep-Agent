# Changelog

> User-visible changes by date for MealPrep Agent. Newest entries first.

**Last reviewed:** 2026-03-12
**Last updated:** 2026-03-12 (MOP-0002 P1/P2 collections, invite UI, recipe page redesign)

---

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
