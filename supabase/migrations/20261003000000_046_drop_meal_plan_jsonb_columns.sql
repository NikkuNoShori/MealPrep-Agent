-- Migration 046: Drop JSONB columns from meal_plans (MOP-0011 Phase 5)
-- Removes meals and grocery_list JSONB columns now that all reads/writes
-- use meal_plan_entries and grocery_list_items (migrations 044–045).
-- Dual-write code removed from api.ts and chat-api handlers.ts in the
-- same commit that deploys this migration.
--
-- SAFETY: child tables must already be populated via the backfill in
-- migration 044 and the dual-write phase. Confirm before deploying:
--   SELECT COUNT(*) FROM meal_plan_entries;
--   SELECT COUNT(*) FROM grocery_list_items;

ALTER TABLE public.meal_plans DROP COLUMN IF EXISTS meals;
ALTER TABLE public.meal_plans DROP COLUMN IF EXISTS grocery_list;
