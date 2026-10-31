# Data Model

> Tables, columns, constraints, relationships, triggers, and RLS policies for MealPrep Agent.

**Last reviewed:** 2026-10-30
**Last updated:** 2026-10-30 (MOP-0043 Phase 1+2: `meal_plan_entries.servings` null semantics fixed — no longer coerced to `1` on read/write; added `meal_plan_entries.base_servings` to snapshot the recipe's yield at entry-creation time so grocery-cart scaling doesn't drift when a recipe is edited later, per ADR-0009; migrations 058–059 added to the index). Previous: 2026-10-16 (MOP-0011: meal_plans JSONB → meal_plan_entries + grocery_list_items child tables, migrations 044–046; get_dashboard_stats rewritten to JOIN child tables, migration 045; migration index extended through 050 and corrected — the previous 001–020 range listed filenames that don't exist on disk). Previous: 2026-09-25 (MOP-0031: recipe_shares table + 5 sharing RPCs — migration 043)

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
| `username` | VARCHAR(30) | UNIQUE | Lowercase alphanumeric + underscores, 3-30 chars (migration 014) |
| `avatar_url` | TEXT | | Google OAuth avatar |
| `setup_completed` | BOOLEAN | DEFAULT false | Set true after completing initial profile setup (migration 020) |
| `timezone` | VARCHAR(50) | DEFAULT 'UTC' | |
| `household_size` | INT | DEFAULT 1 | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

**Indexes:** email, username (unique)
**RLS:** Users can view/update their own profile. Household members can view each other's profiles (migration 024).
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

Weekly/custom meal plans. **As of migration 046 (MOP-0011), this table holds plan-level metadata only** — meal assignments and grocery items live in the child tables `meal_plan_entries` and `grocery_list_items` below. The `meals` and `grocery_list` JSONB columns this table used to carry were dropped in migration 046 after a dual-write + backfill phase (migrations 044–045).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → `profiles(id)` | |
| `title` | VARCHAR(255) | | |
| `start_date` | DATE | | |
| `end_date` | DATE | | |
| `total_cost` | DECIMAL(10,2) | | |
| `status` | VARCHAR(20) | DEFAULT 'draft' | `draft` \| `active` \| `completed` \| `archived` |
| `copied_from` | UUID | FK → `meal_plans(id)` ON DELETE SET NULL | Source plan when copied (migration 036) |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

**Indexes:** user_id, (start_date + end_date)
**RLS:** Users can only access their own meal plans
**Triggers:** `update_meal_plans_updated_at`

**Status lifecycle:** `draft` → `active` → `completed` → `archived`. Plans with `end_date < today` and status `active`/`draft` are treated as stale by the UI and shown in History.

---

### meal_plan_entries (migration 044, MOP-0011)

One row per planned meal assignment. Replaces the old `meal_plans.meals` JSONB. Two row shapes share this table: calendar entries (`date` + `slot` set, `list_key` null) and plan-level list entries like a snacks list (`list_key` set, `date`/`slot` null) — enforced by the `mpe_date_or_list` check constraint.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `meal_plan_id` | UUID | FK → `meal_plans(id)` ON DELETE CASCADE | |
| `date` | DATE | | Null for plan-level list entries |
| `slot` | TEXT | CHECK IN (`breakfast`, `lunch`, `dinner`, `snacks`) | Null for plan-level list entries |
| `list_key` | TEXT | | Non-null for plan-level lists (e.g. `snacks`); underscore prefix from the old JSONB key is stripped on backfill |
| `recipe_id` | UUID | FK → `recipes(id)` ON DELETE SET NULL | |
| `recipe_name` | TEXT | | Denormalized snapshot — survives recipe deletion |
| `recipe_image` | TEXT | | Denormalized snapshot |
| `servings` | INT | Nullable | Absolute serving count the user chose for this entry. As of migration 059 (MOP-0043), null means "use the recipe's base yield" — it is never coerced to `1` on read or write. Pre-059 rows may already store a literal `1` from the old coercion and cannot be distinguished from an intentional choice |
| `base_servings` | INT | Nullable (migration 059, MOP-0043) | Snapshot of the recipe's `servings` at the moment this entry was created. The grocery cart scales ingredients by `servings / (base_servings ?? recipe.servings ?? 4)` so editing a recipe's yield later doesn't silently change the quantities on existing plans (ADR-0009). Null for entries created before migration 059 — those fall back to the recipe's live yield (prior behavior, unchanged) |
| `prep_time` | INT | | |
| `cook_time` | INT | | |
| `notes` | TEXT | | |
| `position` | INT | DEFAULT 0, NOT NULL | Ordering within a date+slot or list_key group |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

**Indexes:** meal_plan_id; (meal_plan_id, date); (meal_plan_id, date, slot); recipe_id
**RLS:** Uses the `is_meal_plan_owner(meal_plan_id)` `SECURITY DEFINER` helper (avoids an N+1 per-row subquery against `meal_plans`). Four policies (`mpe_select`/`mpe_insert`/`mpe_update`/`mpe_delete`), all gated on `is_meal_plan_owner()`. `base_servings` inherits these policies — no new column-specific RLS needed.
**Triggers:** `update_meal_plan_entries_updated_at`

---

### grocery_list_items (migration 044, MOP-0011)

One row per grocery item. Replaces the old `meal_plans.grocery_list` JSONB. Column shape matches the frontend `GroceryItem` type exactly.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `meal_plan_id` | UUID | FK → `meal_plans(id)` ON DELETE CASCADE | |
| `name` | TEXT | NOT NULL | |
| `amount` | NUMERIC | | |
| `unit` | TEXT | DEFAULT '', NOT NULL | |
| `category` | TEXT | DEFAULT 'other', NOT NULL | |
| `source_recipes` | TEXT[] | DEFAULT '{}', NOT NULL | Recipe ids as text, matching `GroceryItem.sourceRecipes` |
| `source_recipe_id` | UUID | FK → `recipes(id)` ON DELETE SET NULL | |
| `is_manual` | BOOLEAN | DEFAULT false, NOT NULL | |
| `is_checked` | BOOLEAN | DEFAULT false, NOT NULL | |
| `is_removed` | BOOLEAN | DEFAULT false, NOT NULL | Soft-delete so "un-remove" (e.g. "Already have it" undo) doesn't need a re-insert |
| `notes` | TEXT | | |
| `raw_amount` | NUMERIC | | Pre-aggregation amount, for display/audit |
| `position` | INT | DEFAULT 0, NOT NULL | |
| `last_generated` | TIMESTAMPTZ | | Carried per-row since there's no longer a plan-level column for it |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

**Indexes:** meal_plan_id; source_recipe_id
**RLS:** Same `is_meal_plan_owner(meal_plan_id)` helper as `meal_plan_entries`. Four policies (`gli_select`/`gli_insert`/`gli_update`/`gli_delete`).
**Triggers:** `update_grocery_list_items_updated_at`

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
| `inviter_name` | TEXT | | Display name of the person who sent the invite |
| `status` | TEXT | NOT NULL, DEFAULT 'pending', CHECK ('pending','accepted','declined','expired') | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `expires_at` | TIMESTAMPTZ | DEFAULT now() + 7 days | |

**Indexes:** household_id, invited_email
**RLS:** Household members + invitee can view; owners/admins can create; owners/admins + invitee can update
**Migration:** 009, 018 (invite tokens), 023 (trigger fix for email)

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

### recipe_reactions

Thumbs up/down reactions on recipes from authenticated users or dependents (family members).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `recipe_id` | UUID | NOT NULL, FK → `recipes(id)` ON DELETE CASCADE | |
| `user_id` | UUID | FK → `profiles(id)` ON DELETE CASCADE | NULL if reaction is from a dependent |
| `family_member_id` | UUID | FK → `family_members(id)` ON DELETE CASCADE | NULL if reaction is from an authenticated user |
| `reaction` | VARCHAR(20) | NOT NULL, CHECK ('thumbs_up','thumbs_down') | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

**Constraints:** CHECK (exactly one of user_id or family_member_id is NOT NULL); UNIQUE (recipe_id, user_id) WHERE user_id IS NOT NULL; UNIQUE (recipe_id, family_member_id) WHERE family_member_id IS NOT NULL
**Indexes:** recipe_id, user_id, family_member_id
**RLS:** Authenticated users can view reactions on recipes they can see; users can insert/update/delete their own reactions
**Triggers:** `update_recipe_reactions_updated_at`
**Migration:** 017

---

### recipe_shares

Direct user-to-user recipe sharing. Tracks which recipes have been shared with which users, when, and whether the recipient has seen the share. No social graph (follows/friends) is required — recipients are looked up by username or email at share time via a SECURITY DEFINER RPC.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `recipe_id` | UUID | NOT NULL, FK → `recipes(id)` ON DELETE CASCADE | |
| `shared_by_user_id` | UUID | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | The user who shared the recipe |
| `shared_with_user_id` | UUID | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | The recipient |
| `shared_at` | TIMESTAMPTZ | DEFAULT now() | Reset on re-share (upsert) |
| `seen_at` | TIMESTAMPTZ | | NULL = unseen; set by `mark_share_seen()` RPC |

**Constraints:** UNIQUE (recipe_id, shared_with_user_id) — re-sharing the same recipe resets `shared_at` and clears `seen_at`
**Indexes:** `idx_recipe_shares_shared_with(shared_with_user_id)`, `idx_recipe_shares_recipe(recipe_id)`
**RLS:**
- INSERT: sharer must own the recipe (`shared_by_user_id = auth.uid()` + ownership check)
- DELETE (sharer): `shared_by_user_id = auth.uid()`
- DELETE (recipient): `shared_with_user_id = auth.uid()`
- SELECT: `shared_by_user_id = auth.uid() OR shared_with_user_id = auth.uid()`
- UPDATE (`seen_at` only): `shared_with_user_id = auth.uid()`
**Migration:** 043 (MOP-0031)

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
| `get_recipe_recommendations` | `user_id` (vestigial), `preference_difficulty`, `preference_tags`, `max_prep_time_minutes`, `limit_count` | 5-term scored recommendations: difficulty + tags + rating + prep_time + reaction signal (migration 035) |

### Data Access Functions (Migration 025)

All use `SECURITY DEFINER` to bypass RLS for cross-user profile reads, validate `auth.uid()` internally, and `RETURNS JSON`. Called via `supabase.rpc()` from the frontend. Replaces multi-query API methods with single database round trips.

| Function | Parameters | Returns | Replaces |
|----------|-----------|---------|----------|
| `get_my_household()` | (none — uses `auth.uid()`) | `{ household, my_role, members, dependents, pending_invites }` | `getMyHousehold()` (4 queries → 1) |
| `toggle_recipe_reaction()` | `p_recipe_id UUID, p_reaction VARCHAR(20), p_family_member_id UUID DEFAULT NULL` | `{ action: 'added' \| 'removed' \| 'updated' }` | `toggleRecipeReaction()` (2-3 queries → 1) |
| `get_household_recipes()` | `p_limit INT DEFAULT 50, p_offset INT DEFAULT 0` | `{ recipes: [...with profiles], total }` | `getHouseholdRecipes()` (3 queries → 1) |
| `get_recipe_reactions()` | `p_recipe_ids UUID[]` | `[{ id, recipe_id, user_id, family_member_id, reaction, name }]` | `getRecipeReactions()` (2 queries → 1) |
| `get_my_pending_invites()` | (none — uses `auth.uid()`) | `[{ id, household_id, ..., households: { id, name } }]` | `getMyPendingInvites()` (2 queries → 1) |

### Dashboard Aggregation RPC (Migration 042 — MOP-0030)

`SECURITY DEFINER`, `RETURNS JSON`, validates `auth.uid()` internally. Aggregates all dashboard-widget data in one round trip, replacing the old pattern of fetching capped/paginated lists client-side just to read `.length`.

| Function | Parameters | Returns | Replaces |
|----------|-----------|---------|----------|
| `get_dashboard_stats()` | (none — uses `auth.uid()`) | `{ recipe_counts: { own_count, household_count, public_visible_count, collection_shared_count }, this_week: { plan_id, today_meals }, active_plan_count, grocery_progress: { plan_id, checked, total, categories: [{ category, checked, total }] }, reactions_given, most_cooked_this_month: [{ recipe_id, title, count }], top_cuisines: [{ cuisine, count }] }` | `useRecipes({ limit: 10 })` + `useMealPlans({ limit: 7 })` fetches previously used just to derive counts on `Dashboard.tsx` |

Notes:
- Recipe counts mirror the "Users can view accessible recipes" RLS OR-filter (own / household-shared / public) as true `COUNT(*)` totals, not page-limited fetches.
- `this_week.today_meals` is the overlapping plan's `meals->>CURRENT_DATE` slots (falls back to the most-recently-created plan if none overlaps today).
- As of migration 045 (MOP-0011), `grocery_progress` and `most_cooked_this_month` are computed via direct JOINs on `grocery_list_items` / `meal_plan_entries` instead of `jsonb_array_elements`/`jsonb_each` gymnastics over the (now-dropped) `meal_plans.meals`/`grocery_list` JSONB columns.
- `grocery_progress` JOINs the active (or most-recent) plan's `grocery_list_items`, excluding `is_removed` rows — checked/total plus a per-category breakdown.
- `most_cooked_this_month` JOINs `meal_plan_entries` → `meal_plans`, grouping by `recipe_id`, **bounded to plans with `start_date >= date_trunc('month', CURRENT_DATE)`** to keep the scan bounded rather than scanning all-time history. Plan-level list entries (`list_key` set) are excluded via `mpe.date IS NOT NULL` — only calendar entries count toward "cooked."
- `top_cuisines` groups by `lower(trim(cuisine))` over the caller's visible recipes (same OR-filter as the recipe counts), excluding `NULL`/empty cuisine. **Known data-quality caveat:** `cuisine` is free-text (`VARCHAR(100)`, no enum), so casing/spelling variants can still bucket separately after normalization — not a bug this RPC fixes.

### Write-Atomicity RPCs (Migration 037 — MOP-0014)

Two `SECURITY DEFINER` RPCs that replace non-atomic sequential client writes with single Postgres transactions. Both verify `auth.uid()` and raise `errcode 42501` for unauthorized callers.

| Function | Parameters | Returns | Replaces |
|----------|-----------|---------|----------|
| `transfer_household_ownership(p_member_id UUID, p_household_id UUID)` | Caller must be household owner | `void` | Two sequential PATCHes to `household_members` (promote target → demote self). Prior dual-owner window eliminated. |
| `respond_to_household_invite(p_invite_id UUID, p_accept BOOLEAN)` | Caller email must match `invited_email`; invite must be `pending` | `TABLE(household_id UUID, household_name TEXT, status TEXT)` | PATCH to `household_invites` + conditional INSERT into `household_members`. Prior orphaned-member-row window eliminated. |

**Authorization pattern:** Each RPC checks the caller's role/identity via `auth.uid()` before mutating. Non-owner callers on `transfer_household_ownership` and non-invitee callers on `respond_to_household_invite` receive `errcode = '42501'` (permission denied). `SECURITY DEFINER` is required because RLS cannot enforce cross-row role checks atomically.

### Bulk Recipe Action RPCs (Migration 038 — MOP-0028)

Three `SECURITY DEFINER` RPCs for bulk operations on the caller's own recipes. All validate `auth.uid()`, silently skip rows the caller doesn't own, and return the count of affected rows.

| Function | Parameters | Returns | Notes |
|----------|-----------|---------|-------|
| `bulk_update_recipe_visibility(p_recipe_ids UUID[], p_visibility TEXT)` | `p_visibility` must be `'private'`, `'household'`, or `'public'`; caller must own the recipes | `INT` (rows updated) | Silently skips IDs not owned by caller. Raises `22023` for invalid visibility value. |
| `bulk_delete_recipes(p_recipe_ids UUID[])` | Caller must own the recipes | `INT` (rows deleted) | Silently skips IDs not owned by caller. |
| `bulk_add_to_collection(p_collection_id UUID, p_recipe_ids UUID[])` | Caller must own the collection | `INT` (rows inserted) | Uses `ON CONFLICT DO NOTHING` — re-adding existing recipes is a no-op. Raises `42501` if caller does not own the collection. |

**Authorization pattern:** Each RPC checks `user_id = auth.uid()` at the row level. Unauthenticated callers receive `errcode = '42501'`. `SECURITY DEFINER` is required to perform the delete/update in a single statement bypassing per-row RLS overhead.

### Direct Recipe Sharing RPCs (Migration 043 — MOP-0031)

Five `SECURITY DEFINER set search_path = public` RPCs for user-to-user recipe sharing. All validate `auth.uid()` internally and raise `42501` for unauthorized callers. Recipient lookup accepts either a `username` or `email` (case-insensitive) via the `share_recipe` RPC.

| Function | Parameters | Returns | Notes |
|----------|-----------|---------|-------|
| `share_recipe(p_recipe_id UUID, p_target_identifier TEXT)` | Caller must own the recipe | `UUID` (share id) | Looks up recipient by `username` or `email`. Upserts on re-share (resets `shared_at`, clears `seen_at`). Raises `P0001` with "user not found" if identifier resolves to no profile. |
| `unshare_recipe(p_recipe_id UUID, p_shared_with_user_id UUID)` | Caller must be the sharer | `void` | |
| `get_shared_with_me()` | (none — uses `auth.uid()`) | TABLE row per share | Columns: `share_id`, `recipe_id`, `shared_at`, `seen_at`, `sharer_user_id`, `sharer_display_name`, `sharer_username`, plus recipe columns (`title`, `description`, `image_url`, `tags`, `visibility`). Ordered by `shared_at DESC`. |
| `mark_share_seen(p_share_id UUID)` | Caller must be the recipient | `void` | Sets `seen_at = now()` where `id = p_share_id AND shared_with_user_id = auth.uid()`. No-op if already seen. |
| `get_unseen_share_count()` | (none — uses `auth.uid()`) | `INT` | Count of `recipe_shares` rows where `shared_with_user_id = auth.uid() AND seen_at IS NULL`. |

### Helper Functions

| Function | Type | Description |
|----------|------|-------------|
| `handle_new_user()` | Trigger on `auth.users` INSERT | Creates profile + assigns default role + creates household + membership + default collections (Favorites, My Recipes) |
| `is_household_member()` | SECURITY DEFINER helper | Checks household membership without RLS recursion |
| `get_household_role()` | SECURITY DEFINER helper | Returns user's role in a household without RLS recursion |
| `update_recipe_searchable_text()` | Trigger on recipes INSERT/UPDATE | Builds `searchable_text` from recipe fields |
| `update_recipe_embedding()` | Trigger on recipes UPDATE | Clears `embedding_vector` when content changes |

---

## Migration Index

> **Note (corrected 2026-10-16):** this table previously listed a `20251101*`/`20251122*`/`20251123*`-timestamp sequence (numbers 001–020) that does not correspond to any file in `supabase/migrations/` — likely drafted before the actual migration files were written and never reconciled. Replaced below with the real file list. The unprefixed legacy files (`009`–`019`, plus a stray `20251110000000_remove_stack_auth_columns.sql`) predate the `YYYYMMDDHHMMSS_NNN_description.sql` naming convention adopted at `001`; they ran once, in filename-sort order, and are kept for historical reference only.

| Migration | Number | Description |
|-----------|--------|-------------|
| `009_fix_rls_for_stack_auth.sql` | — | Pre-convention. Fix RLS for Stack Auth (legacy auth provider, since replaced by Supabase Auth) |
| `010_add_is_public_to_recipes.sql` | — | Pre-convention. Added `is_public` to recipes (later dropped, migration 013) |
| `011_update_rls_for_public_recipes.sql` | — | Pre-convention. RLS for public recipes |
| `012_add_slug_to_recipes.sql` | — | Pre-convention. Added `slug` to recipes |
| `013_rename_users_to_profiles_add_first_last_name.sql` | — | Pre-convention. Renamed `users` → `profiles`, added name fields |
| `014_fix_profiles_table_schema.sql` | — | Pre-convention. Fixed `profiles` schema |
| `015_add_uuid_support_to_profiles.sql` | — | Pre-convention. UUID support on `profiles` |
| `016_update_rls_for_supabase_auth.sql` | — | Pre-convention. Migrated RLS from Stack Auth to Supabase Auth |
| `017_create_supabase_rpc_functions.sql` | — | Pre-convention. Early RPC functions |
| `018_auto_create_profile_trigger.sql` | — | Pre-convention. Auto-create profile on signup trigger |
| `019_remove_stack_auth_columns.sql` | — | Pre-convention. Dropped remaining Stack Auth columns |
| `20251110000000_remove_stack_auth_columns.sql` | — | Stray duplicate of 019 under the new timestamp convention; both ran, idempotent |
| `20251201000000_001_core_schema.sql` | 001 | Initial tables (profiles, ingredients, user_ingredients, meal_plans, shopping_lists, receipts, roles, user_roles, family_members) |
| `20251201000001_002_auth_and_roles.sql` | 002 | Auth and role tables |
| `20251201000002_003_rls_policies.sql` | 003 | RLS policies |
| `20251201000003_004_search_and_embeddings.sql` | 004 | pgvector, recipe_embeddings, embedding columns, search functions |
| `20251201000004_005_chat.sql` | 005 | chat_conversations + chat_messages |
| `20251201000005_006_recipe_constraints_and_storage.sql` | 006 | Recipe constraints + Supabase Storage bucket for recipe images |
| `20251201000006_007_fix_handle_new_user_trigger.sql` | 007 | Fixed `handle_new_user()` trigger |
| `20251201000007_008_chat_images_storage.sql` | 008 | Chat image storage |
| `20260312000000_009_household_and_visibility.sql` | 009b | Households, household_members, household_invites, recipe visibility, updated handle_new_user() trigger |
| `20260312000001_010_fix_household_rls_recursion.sql` | 010 | Fix RLS infinite recursion: SECURITY DEFINER helpers (`is_household_member`, `get_household_role`), updated all household-related policies |
| `20260312000002_011_recipe_collections.sql` | 011 | recipe_collections + collection_recipes tables, RLS, indexes, updated handle_new_user() with default collections |
| `20260312000003_012_collection_sharing_inheritance.sql` | 012 | Updated recipes SELECT policy with collection-level sharing inheritance |
| `20260313000000_013_deprecation_cleanup.sql` | 013 | Dropped `is_public`, `family_id` columns; simplified `family_members` RLS; fixed `handle_new_user()` trigger |
| `20260313000000_014_add_username_to_profiles.sql` | 014 | Added `username` column (unique, 3-30 chars) to profiles; unique recipe title per user |
| `20260313000001_015_fix_recipe_rls_auth.sql` | 015 | Fixed recipe RLS auth policies |
| `20260313000002_016_remove_my_recipes_collection.sql` | 016 | Removed default "My Recipes" collection auto-creation |
| `20260313000003_017_recipe_reactions.sql` | 017 | `recipe_reactions` table with RLS, indexes, constraints |
| `20260314000000_018_invite_tokens_and_auto_join.sql` | 018 | Invite token handling and auto-join on signup |
| `20260314100000_019_drop_token_hash.sql` | 019 | Drop token_hash from household_invites |
| `20260314200000_020_setup_completed_flag.sql` | 020 | Added `setup_completed` flag to profiles |
| `20260314300000_021_admin_access_policies.sql` | 021 | RLS policies for admin role access |
| `20260314400000_022_admin_delete_households.sql` | 022 | Admin household delete policy |
| `20260314500000_023_fix_trigger_missing_email.sql` | 023 | Fixed `handle_new_user()` trigger missing email field |
| `20260314600000_024_household_member_profile_visibility.sql` | 024 | RLS policy: household members can view each other's profiles |
| `20260314700000_025_rpc_functions.sql` | 025 | 5 SECURITY DEFINER RPC functions for data-access optimization |
| `20260314800000_026_fix_function_search_paths.sql` | 026 | Fix `search_path` on RPC functions (security hardening) |
| `20260314900000_027_meal_plan_enhancements.sql` | 027 | `meal_plans` status column, multi-week plan support |
| `20260604000000_028_search_rpcs_auth_uid.sql` | 028 | Replace `user_id` param with `auth.uid()` in all 5 search/recommendation RPCs (security gate — MOP-0007) |
| `20260604000001_029_embedding_refresh_lifecycle.sql` | 029 | `needs_reembed` flag + `embedding-refresh` scheduled function (MOP-0015) |
| `20260906000000_030_dietary_flags_and_allergy_tagging.sql` | 030 | Dietary flags + automatic allergy tagging on recipe import (MOP-0024/0025) |
| `20260906000001_031_plan_period_config.sql` | 031 | `plan_period_config` table for configurable default plan duration (MOP-0022) |
| `20260906000002_032_household_rbac_flags.sql` | 032 | Household RBAC role flags |
| `20260906000003_033_get_my_household_rbac_fields.sql` | 033 | Extend `get_my_household` RPC with RBAC fields |
| `20260907000000_034_chat_retention_cleanup.sql` | 034 | Chat message retention cleanup |
| `20260907000001_035_recommendations_with_reactions.sql` | 035 | Add reaction signal (5th term) to `get_recipe_recommendations` scoring formula (MOP-0007 Phase 3) |
| `20260907000002_036_meal_plans_copied_from_cascade.sql` | 036 | `meal_plans.copied_from` self-referential FK with ON DELETE SET NULL |
| `20260916000000_037_household_write_atomicity_rpcs.sql` | 037 | Two write-atomicity SECURITY DEFINER RPCs: `transfer_household_ownership` + `respond_to_household_invite` (MOP-0014) |
| `20260921000000_038_bulk_recipe_actions.sql` | 038 | Three bulk recipe action RPCs: `bulk_update_recipe_visibility`, `bulk_delete_recipes`, `bulk_add_to_collection` (MOP-0028) |
| `20260922000000_039_drop_search_similar_recipes.sql` | 039 | Dropped orphan `search_similar_recipes()` — a 384-dim RPC against `recipe_embeddings`, which has no active write path (all current embeddings are 1536-dim on `recipes.embedding_vector`) |
| `20260922000003_040_embedding_refresh_cron.sql` | 040 | Scheduled `embedding-refresh` edge function via `pg_cron` + `pg_net`; service-role JWT auth |
| `20260922000004_041_drop_btree_embedding_index.sql` | 041 | Dropped `idx_recipes_with_embeddings` — a leftover 384-dim-era btree index that was never usable with 1536-dim vectors (exceeds btree's row-size limit, every embedding write silently failed to index) |
| `20260922000005_042_get_dashboard_stats.sql` | 042 | `get_dashboard_stats()` SECURITY DEFINER RPC: recipe counts, this week's meals, active plan count, grocery progress, reactions given, most-cooked this month, top cuisines (MOP-0030) |
| `20260922000006_043_recipe_shares.sql` | 043 | `recipe_shares` table + 5 RLS policies + 5 SECURITY DEFINER RPCs for direct user-to-user recipe sharing (MOP-0031) |
| `20261001000000_044_meal_plan_child_tables.sql` | 044 | `meal_plan_entries` + `grocery_list_items` tables, RLS via `is_meal_plan_owner()` helper, backfill from `meal_plans.meals`/`grocery_list` JSONB. Dual-write phase — JSONB columns not yet dropped (MOP-0011) |
| `20261002000000_045_get_dashboard_stats_child_tables.sql` | 045 | Rewrote `get_dashboard_stats()`'s `this_week`/`grocery_progress`/`most_cooked_this_month` sections to JOIN the new child tables instead of `jsonb_each`/`jsonb_array_elements` over `meal_plans` JSONB (MOP-0011) |
| `20261003000000_046_drop_meal_plan_jsonb_columns.sql` | 046 | Dropped `meal_plans.meals` and `meal_plans.grocery_list` JSONB columns now that all reads/writes use the child tables (MOP-0011 Phase 5, dual-write cleanup) |
| `20261003000001_047_backfill_searchable_text.sql` | 047 | Backfilled `recipes.searchable_text` for rows saved before migration 004, where the trigger hadn't fired retroactively — those recipes were silently invisible to `search_recipes_text` |
| `20261003000002_048_profiles_default_visibility.sql` | 048 | Added `default_recipe_visibility` preference to `profiles` — edge functions read this instead of hardcoding `'private'` |
| `20261003000003_049_search_recipes_text_full_row.sql` | 049 | `search_recipes_text` now returns the full recipe row instead of 6 columns — the migration 028 version was missing `id`, `image_url`, `tags`, `prep_time`, `slug`, `created_at`, etc. that `RecipeList` needs to render server search results as `RecipeCard` objects |
| `20261004000000_050_fix_respond_to_household_invite_ambiguity.sql` | 050a | Fixed a "household_id is ambiguous" error in `respond_to_household_invite()` (migration 037) caused by `household_id` being both a `RETURNS TABLE` column and a local variable name |
| `20261011000000_050_fix_dropped_is_public_column.sql` | 050b | **Duplicate migration number** — see note below. Fixed 5 RPCs still referencing `recipes.is_public`, dropped by migration 013 and superseded by the `visibility` text column (migration 009) |

> **Duplicate number 050 (unresolved as of 2026-10-16):** two files share migration number 050 — `20261004000000_050_fix_respond_to_household_invite_ambiguity.sql` and `20261011000000_050_fix_dropped_is_public_column.sql`. Both ran (filename-timestamp order makes this safe; Supabase's migration runner orders by filename, not by the embedded number), and the table above labels them 050a/050b to disambiguate in prose, but the files on disk are not renamed. Future migrations should use `051` next, not continue the collision.

| `20261030120000_058_servings_modal_preference.sql` | 058 | Added `profiles.skip_servings_modal BOOLEAN DEFAULT false` — lets a user opt out of the servings-adjustment prompt when adding recipes to a meal plan |
| `20261030130000_059_meal_plan_entries_base_servings.sql` | 059 | Added `meal_plan_entries.base_servings INTEGER` — snapshots the recipe's yield at entry-creation time so the grocery cart's scale factor doesn't drift if the recipe's yield is edited later (MOP-0043 Phase 2, ADR-0009). No backfill; existing rows get null, preserving prior live-divisor behavior |
