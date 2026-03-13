# Data Model

> Tables, columns, constraints, relationships, triggers, and RLS policies for MealPrep Agent.

**Last reviewed:** 2026-03-12
**Last updated:** 2026-03-12 (deprecation cleanup: dropped is_public, family_id columns; simplified family_members RLS)

---

## Overview

MealPrep Agent uses PostgreSQL via Supabase with the `pgvector` extension for vector similarity search. All tables have Row Level Security (RLS) enabled. The schema is managed through sequential migration files in `supabase/migrations/`.

### Extensions
- `pgvector` — vector similarity search (1536-dimensional embeddings)
- `pg_trgm` — trigram matching for fuzzy text search

---

## Core Tables

### profiles

User profiles, created automatically via trigger on `auth.users` INSERT.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK, FK → `auth.users(id)` ON DELETE CASCADE | |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | |
| `display_name` | VARCHAR(255) | NOT NULL | |
| `first_name` | VARCHAR(255) | | |
| `last_name` | VARCHAR(255) | | |
| `avatar_url` | TEXT | | Google OAuth avatar |
| `timezone` | VARCHAR(50) | DEFAULT 'UTC' | |
| `household_size` | INT | DEFAULT 1 | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

**Indexes:** email
**RLS:** Users can only view/update their own profile
**Triggers:** `update_profiles_updated_at` (auto-update `updated_at`)

---

### recipes

User recipe collection with vector embeddings for semantic search.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → `profiles(id)` | |
| `title` | VARCHAR(255) | NOT NULL, UNIQUE per user | Migration 014 |
| `description` | TEXT | | |
| `ingredients` | JSONB | | Array of `{name, amount, unit, category, notes}` |
| `instructions` | JSONB | | Array of instruction strings |
| `prep_time` | VARCHAR(50) / INT | | |
| `cook_time` | VARCHAR(50) / INT | | |
| `total_time` | INT | | Minutes |
| `servings` | INT | DEFAULT 4 | |
| `difficulty` | VARCHAR(20) | | `easy`, `medium`, `hard` |
| `cuisine` | VARCHAR(100) | | |
| `tags` | TEXT[] | | e.g., `["vegetarian", "quick"]` |
| `dietary_tags` | TEXT[] | | |
| `image_url` | TEXT | | Supabase Storage signed URL |
| `rating` | DECIMAL(3,2) | | 0.00–5.00 |
| `nutrition_info` | JSONB | | `{calories, protein, carbs, fat}` |
| `source_url` | TEXT | | |
| `source_name` | VARCHAR | | |
| `visibility` | TEXT | NOT NULL DEFAULT 'private', CHECK ('private','household','public') | Three-tier sharing (migration 009) |
| `is_favorite` | BOOLEAN | DEFAULT false | |
| `embedding_vector` | VECTOR(1536) | | OpenAI ada-002 embeddings |
| `searchable_text` | TEXT | | Auto-generated for full-text search |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

**Indexes:**
- `user_id`
- `created_at DESC`
- `tags` (GIN)
- `searchable_text` (GIN, tsvector)
- `embedding_vector` (IVFFlat, cosine, lists=100)
- `embedding_vector` (IVFFlat, L2, lists=100)

**RLS:** Unified SELECT policy: owner can view own recipes, household members can view `visibility = 'household'` recipes, all users can view `visibility = 'public'` recipes, plus recipes in shared/public collections are visible via collection-level sharing inheritance (migration 012). INSERT/UPDATE/DELETE: owner only.

**Triggers:**
- `update_recipes_updated_at` — auto-update `updated_at`
- `update_recipe_searchable_text_trigger` — concatenates title + description + difficulty + tags + ingredients + instructions into `searchable_text`
- `trigger_update_recipe_embedding` — clears `embedding_vector` when recipe content changes (must be regenerated separately)
**Migration history:** 007 (create), 008 (RLS), 009 (search functions + household visibility), 013 (dropped is_public), 014 (unique title per user)

---

### recipe_embeddings

Separate embedding storage (384-dim) for alternative embedding strategies.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `recipe_id` | UUID | FK → `recipes(id)` ON DELETE CASCADE | |
| `embedding` | VECTOR(384) | | |
| `text_content` | TEXT | | The text that was embedded |
| `embedding_type` | VARCHAR(50) | DEFAULT 'recipe_content' | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

**Indexes:** vector (IVFFlat cosine), recipe_id, embedding_type
**RLS:** Users can only access embeddings for their own recipes

---

### chat_conversations

Chat sessions between users and the AI assistant.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → `profiles(id)` | |
| `title` | VARCHAR(255) | DEFAULT 'New Chat' | |
| `session_id` | VARCHAR(255) | | n8n session identifier |
| `selected_intent` | VARCHAR(50) | | `recipe_extraction` or NULL |
| `metadata` | JSONB | | RAG results, extracted recipes, context |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |
| `last_message_at` | TIMESTAMPTZ | | |

**Indexes:** user_id, session_id, (user_id + updated_at DESC), (user_id + last_message_at DESC)
**RLS:** Users can only access their own conversations
**Triggers:** `update_chat_conversations_updated_at`

---

### chat_messages

Individual messages within chat conversations.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `conversation_id` | UUID | FK → `chat_conversations(id)` | |
| `content` | TEXT | NOT NULL | |
| `sender` | VARCHAR(10) | | `user` or `ai` |
| `message_type` | VARCHAR(20) | | `text`, `recipe`, `image`, `system` |
| `metadata` | JSONB | | Recipe extraction results, RAG context, images |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

**Indexes:** conversation_id, created_at, sender, (conversation_id + created_at ASC)
**RLS:** Users can only access messages in their own conversations

**Triggers:**
- `update_chat_messages_updated_at`
- `update_conversation_last_message_trigger` — updates parent conversation's `last_message_at` on INSERT

**Migration:** 018

---

### user_preferences

Per-user cooking and display preferences.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → `profiles(id)` | |
| `global_restrictions` | TEXT[] | | e.g., `["gluten-free", "nut-free"]` |
| `cuisine_preferences` | TEXT[] | | |
| `cooking_skill_level` | VARCHAR(20) | DEFAULT 'intermediate' | |
| `dietary_goals` | TEXT[] | | |
| `spice_tolerance` | VARCHAR(20) | DEFAULT 'medium' | |
| `meal_prep_preference` | VARCHAR(20) | DEFAULT 'moderate' | |
| `budget_range` | VARCHAR(20) | DEFAULT 'medium' | |
| `time_constraints` | JSONB | | |
| `measurement_system` | VARCHAR(20) | DEFAULT 'metric' | `metric` or `imperial` |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

**RLS:** Users can only access their own preferences
**Triggers:** `update_user_preferences_updated_at`
**Migration history:** 016 (add measurement_system), 017 (fix column), 020 (cleanup)

---

### meal_plans

Weekly/custom meal plans with grocery lists.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → `profiles(id)` | |
| `title` | VARCHAR(255) | | |
| `start_date` | DATE | | |
| `end_date` | DATE | | |
| `meals` | JSONB | | Structured meal assignments by day/slot |
| `grocery_list` | JSONB | | Generated shopping list |
| `total_cost` | DECIMAL(10,2) | | |
| `status` | VARCHAR(20) | | `draft`, etc. |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

**Indexes:** user_id, (start_date + end_date)
**RLS:** Users can only access their own meal plans
**Triggers:** `update_meal_plans_updated_at`

---

### family_members

Family member profiles with dietary information.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `household_id` | UUID | NOT NULL, FK → `households(id)` ON DELETE CASCADE | Links dependent to household |
| `managed_by` | UUID | FK → `profiles(id)` | Authenticated user who manages this dependent |
| `name` | VARCHAR(255) | NOT NULL | |
| `relationship` | VARCHAR(100) | | |
| `age` | INT | | |
| `dietary_restrictions` | TEXT[] | | |
| `allergies` | TEXT[] | | |
| `preferences` | JSONB | | |
| `is_active` | BOOLEAN | DEFAULT true | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

**Indexes:** household_id
**RLS:** Users can access family members in their household via `is_household_member()` helper
**Triggers:** `update_family_members_updated_at`
**Migration:** 001 (create), 009 (add household_id, managed_by), 013 (drop family_id, make household_id NOT NULL)

---

### households

Core sharing unit. Each user belongs to at least one household. Created automatically on signup via `handle_new_user()` trigger.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `name` | TEXT | NOT NULL, DEFAULT 'My Household' | |
| `created_by` | UUID | NOT NULL, FK → `profiles(id)` | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

**Indexes:** created_by
**RLS:** Members can view (via `is_household_member()`), owners can update/delete
**Triggers:** `update_households_updated_at`
**Migration:** 009

---

### household_members

Links authenticated users to households with roles (owner/admin/member).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `household_id` | UUID | NOT NULL, FK → `households(id)` ON DELETE CASCADE | |
| `user_id` | UUID | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | |
| `role` | TEXT | NOT NULL, DEFAULT 'member', CHECK ('owner','admin','member') | |
| `joined_at` | TIMESTAMPTZ | DEFAULT now() | |

**Constraints:** UNIQUE (household_id, user_id)
**Indexes:** user_id, household_id
**RLS:** Uses `SECURITY DEFINER` helper functions (`is_household_member()`, `get_household_role()`) to avoid infinite recursion. Members can view same-household rows; owners/admins can insert; owners can update/delete.
**Migration:** 009

**Note:** Two role systems exist independently: `user_roles` (app-level RBAC: admin/user/family_member) and `household_members.role` (household-level: owner/admin/member). App roles control feature access; household roles control sharing permissions.

---

### household_invites

Pending invitations for authenticated users to join households.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `household_id` | UUID | NOT NULL, FK → `households(id)` ON DELETE CASCADE | |
| `invited_by` | UUID | NOT NULL, FK → `profiles(id)` | |
| `invited_email` | TEXT | NOT NULL | |
| `status` | TEXT | NOT NULL, DEFAULT 'pending', CHECK ('pending','accepted','declined','expired') | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `expires_at` | TIMESTAMPTZ | DEFAULT now() + 7 days | |

**Indexes:** household_id, invited_email
**RLS:** Household members + invitee can view; owners/admins can create; owners/admins + invitee can update
**Migration:** 009

---

### recipe_collections

Folders for organizing recipes. Collections carry their own visibility independent of individual recipe visibility.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `user_id` | UUID | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | |
| `name` | TEXT | NOT NULL, UNIQUE per user | |
| `description` | TEXT | | |
| `visibility` | TEXT | NOT NULL, DEFAULT 'private', CHECK ('private','household','public') | |
| `icon` | TEXT | | Emoji or icon name for UI |
| `sort_order` | INT | DEFAULT 0 | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | Auto-updated via trigger |

**Indexes:** user_id
**RLS:** Owner + household members (if household visibility) + everyone (if public) can view; owner-only INSERT/UPDATE/DELETE
**Triggers:** `update_recipe_collections_updated_at`
**Migration:** 011

### collection_recipes

Many-to-many join between collections and recipes.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `collection_id` | UUID | NOT NULL, FK → `recipe_collections(id)` ON DELETE CASCADE | |
| `recipe_id` | UUID | NOT NULL, FK → `recipes(id)` ON DELETE CASCADE | |
| `added_at` | TIMESTAMPTZ | DEFAULT now() | |
| `sort_order` | INT | DEFAULT 0 | |

**PK:** (collection_id, recipe_id)
**Indexes:** recipe_id
**RLS:** Viewable if parent collection passes SELECT policy; collection owner can INSERT/DELETE
**Migration:** 011

---

## Supporting Tables

### ingredients
Master ingredient catalog. All authenticated users can read.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `name` | VARCHAR | UNIQUE |
| `category` | VARCHAR | |
| `nutrition_info` | JSONB | |

### user_ingredients
User's pantry/inventory.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `user_id` | UUID | FK → profiles |
| `item_name` | VARCHAR | |
| `quantity` | DECIMAL | |
| `unit` | VARCHAR | |
| `expiration_date` | DATE | |
| `location` | VARCHAR | |

### shopping_lists
Shopping lists linked to meal plans.

### receipts
OCR-processed grocery receipts (table exists, pipeline not implemented).

### roles / user_roles
System roles (`admin`, `user`, `family_member`) with JSONB permissions. Default role assigned on signup.

---

## Database Functions (RPCs)

### Search Functions

| Function | Parameters | Description |
|----------|-----------|-------------|
| `search_recipes_semantic` | `query_embedding`, `user_id`, `match_threshold`, `match_count` | Cosine similarity search against `embedding_vector` |
| `search_recipes_text` | `search_query`, `user_uuid`, `max_results` | Full-text search using tsvector ranking |
| `search_recipes_by_ingredients` | `ingredient_list`, `user_id`, `match_threshold`, `match_count` | Text search on ingredient names |
| `find_similar_recipes` | `recipe_id`, `user_id`, `similarity_threshold`, `max_results` | Finds recipes similar to a given recipe |
| `get_recipe_recommendations` | `user_id`, `preference_difficulty`, `preference_tags`, `max_prep_time_minutes`, `limit_count` | Scored recommendations based on preferences |

### Helper Functions

| Function | Type | Description |
|----------|------|-------------|
| `handle_new_user()` | Trigger on `auth.users` INSERT | Creates profile + assigns default role + creates household + membership + default collections (Favorites, My Recipes) |
| `sync_recipe_visibility()` | Trigger on recipes INSERT/UPDATE | Syncs `is_public` from `visibility` column |
| `is_household_member()` | SECURITY DEFINER helper | Checks household membership without RLS recursion |
| `get_household_role()` | SECURITY DEFINER helper | Returns user's role in a household without RLS recursion |
| `update_recipe_searchable_text()` | Trigger on recipes INSERT/UPDATE | Builds `searchable_text` from recipe fields |
| `update_recipe_embedding()` | Trigger on recipes UPDATE | Clears `embedding_vector` when content changes |
| `validate_family_id()` | Trigger on family_members INSERT/UPDATE | Validates `family_id` exists in profiles |

---

## Migration Index

| Migration | Number | Description |
|-----------|--------|-------------|
| `20251101000000_001_initial_schema.sql` | 001 | Initial tables (profiles, ingredients, user_ingredients, meal_plans, shopping_lists, receipts, roles, user_roles, family_members) |
| `20251101000001_002_chat_messages.sql` | 002 | Original chat_messages (later dropped) |
| `20251101000002_003_create_missing_tables.sql` | 003 | Fill gaps in schema |
| `20251101000003_004_add_test_user.sql` | 004 | Test user data |
| `20251101000004_005_drop_chat_messages.sql` | 005 | Drop original chat_messages |
| `20251101000005_006_drop_unused_tables.sql` | 006 | Cleanup |
| `20251101000006_007_create_recipes_table.sql` | 007 | Recipes table with full schema |
| `20251101000007_008_add_rag_support.sql` | 008 | pgvector, recipe_embeddings, embedding columns, search functions |
| `20251101000008_008_enable_rls_recipes.sql` | 008b | RLS policies for recipes |
| `20251101000009_009_add_semantic_search_functions.sql` | 009 | Semantic search RPCs |
| `20251122000000_010_sync_auth_users.sql` | 010 | Sync auth.users trigger |
| `20251122000001_011_restructure_auth_and_profiles.sql` | 011 | Auth restructure |
| `20251122000002_012_create_missing_tables.sql` | 012 | Additional missing tables |
| `20251123000000_013_comprehensive_rls_policies.sql` | 013 | Comprehensive RLS policies for all tables |
| `20251124000000_014_add_unique_recipe_title.sql` | 014 | UNIQUE constraint on recipe title per user |
| `20251124000001_015_create_recipe_images_bucket.sql` | 015 | Supabase Storage bucket for recipe images |
| `20251125000000_016_add_measurement_system_preference.sql` | 016 | measurement_system column on user_preferences |
| `20251125000001_017_fix_measurement_system_column.sql` | 017 | Fix measurement_system column |
| `20251126000000_018_create_chat_messages_table.sql` | 018 | chat_conversations + chat_messages (current schema) |
| `20251127000000_019_drop_unused_tables.sql` | 019 | Drop deprecated tables |
| `20251128000000_020_cleanup_user_preferences.sql` | 020 | Cleanup user_preferences |
| `20260312000000_009_household_and_visibility.sql` | 009b | Households, household_members, household_invites, recipe visibility, updated handle_new_user() trigger |
| `20260312000001_010_fix_household_rls_recursion.sql` | 010 | Fix RLS infinite recursion: SECURITY DEFINER helpers (`is_household_member`, `get_household_role`), updated all household-related policies |
| `20260312000002_011_recipe_collections.sql` | 011 | recipe_collections + collection_recipes tables, RLS, indexes, updated handle_new_user() with default collections |
| `20260312000003_012_collection_sharing_inheritance.sql` | 012 | Updated recipes SELECT policy with collection-level sharing inheritance |
