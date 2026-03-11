# Data Model

> Tables, columns, constraints, relationships, triggers, and RLS policies for MealPrep Agent.

**Last reviewed:** 2026-03-11
**Last updated:** 2026-03-10 (initial canonical doc creation)

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
| `family_id` | UUID | DEFAULT gen_random_uuid() | Groups family members |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

**Indexes:** email, family_id
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
| `is_public` | BOOLEAN | DEFAULT false | |
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

**RLS:** Users can view/edit/delete own recipes + read public recipes (`is_public = true`)

**Triggers:**
- `update_recipes_updated_at` — auto-update `updated_at`
- `update_recipe_searchable_text_trigger` — concatenates title + description + difficulty + tags + ingredients + instructions into `searchable_text`
- `trigger_update_recipe_embedding` — clears `embedding_vector` when recipe content changes (must be regenerated separately)

**Migration history:** 007 (create), 008 (RLS), 009 (search functions), 014 (unique title per user)

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
| `family_id` | UUID | | References `profiles.family_id` (validated via trigger) |
| `name` | VARCHAR(255) | NOT NULL | |
| `relationship` | VARCHAR(100) | | |
| `age` | INT | | |
| `dietary_restrictions` | TEXT[] | | |
| `allergies` | TEXT[] | | |
| `preferences` | JSONB | | |
| `is_active` | BOOLEAN | DEFAULT true | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

**Indexes:** family_id
**RLS:** Users can access family members in their family group
**Triggers:**
- `update_family_members_updated_at`
- `validate_family_member_family_id` — ensures `family_id` exists in `profiles`

**Note:** `family_id` is not a true FK constraint. Validation is enforced via trigger because `family_id` is not unique in `profiles` (multiple users can share a family).

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
| `handle_new_user()` | Trigger on `auth.users` INSERT | Creates profile + assigns default role |
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
