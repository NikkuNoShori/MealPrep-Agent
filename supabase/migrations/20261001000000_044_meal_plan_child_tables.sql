-- Migration 044: Normalize meal_plans JSONB → Child Tables (MOP-0011)
-- Creates meal_plan_entries and grocery_list_items, backfills from existing
-- meal_plans.meals / meal_plans.grocery_list JSONB, and adds a SECURITY DEFINER
-- helper to make child-table RLS efficient.
-- Deploy: user handles (HARD RULE — never pushed by Claude).
-- NOTE: JSONB columns (meals, grocery_list) are NOT dropped here — dual-write
-- phase. Migration 046 drops them after reads switch to child tables.

-- ── meal_plan_entries ──────────────────────────────────────────────────────
-- One row per planned meal assignment.
-- date + slot rows are calendar entries (date-keyed in old JSONB).
-- list_key rows are plan-level list entries (underscore-keyed in old JSONB,
-- e.g. "snacks").

create table if not exists public.meal_plan_entries (
  id           uuid        primary key default gen_random_uuid(),
  meal_plan_id uuid        not null references public.meal_plans(id) on delete cascade,
  date         date,                           -- null for plan-level list entries
  slot         text        check (slot in ('breakfast', 'lunch', 'dinner', 'snacks')),
  list_key     text,                           -- non-null for plan-level lists (e.g. 'snacks')
  recipe_id    uuid        references public.recipes(id) on delete set null,
  recipe_name  text,
  recipe_image text,
  servings     int,
  prep_time    int,
  cook_time    int,
  notes        text,
  position     int         not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint mpe_date_or_list check (
    (date is not null and slot is not null and list_key is null)
    or (date is null and slot is null and list_key is not null)
  )
);

alter table public.meal_plan_entries enable row level security;

create index if not exists idx_mpe_meal_plan_id      on public.meal_plan_entries(meal_plan_id);
create index if not exists idx_mpe_meal_plan_date    on public.meal_plan_entries(meal_plan_id, date);
create index if not exists idx_mpe_meal_plan_slot    on public.meal_plan_entries(meal_plan_id, date, slot);
create index if not exists idx_mpe_recipe_id         on public.meal_plan_entries(recipe_id);

-- ── grocery_list_items ──────────────────────────────────────────────────────
-- One row per grocery item. Matches the GroceryItem TypeScript type exactly.
-- last_generated is a plan-level timestamp carried on every row so it survives
-- without a separate column on meal_plans.

create table if not exists public.grocery_list_items (
  id               uuid        primary key default gen_random_uuid(),
  meal_plan_id     uuid        not null references public.meal_plans(id) on delete cascade,
  name             text        not null,
  amount           numeric,
  unit             text        not null default '',
  category         text        not null default 'other',
  source_recipes   text[]      not null default '{}',  -- array of recipe ids (text to match GroceryItem.sourceRecipes)
  source_recipe_id uuid        references public.recipes(id) on delete set null,
  is_manual        boolean     not null default false,
  is_checked       boolean     not null default false,
  is_removed       boolean     not null default false,
  notes            text,
  raw_amount       numeric,
  position         int         not null default 0,
  last_generated   timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.grocery_list_items enable row level security;

create index if not exists idx_gli_meal_plan_id      on public.grocery_list_items(meal_plan_id);
create index if not exists idx_gli_source_recipe_id  on public.grocery_list_items(source_recipe_id);

-- ── SECURITY DEFINER helper: is_meal_plan_owner ────────────────────────────
-- Used by child-table RLS policies to avoid an N+1 per-row subquery.

create or replace function public.is_meal_plan_owner(p_meal_plan_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.meal_plans
    where id = p_meal_plan_id
      and user_id = auth.uid()
  );
$$;

revoke all on function public.is_meal_plan_owner(uuid) from public;
grant execute on function public.is_meal_plan_owner(uuid) to authenticated;

-- ── RLS Policies: meal_plan_entries ────────────────────────────────────────

create policy "mpe_select" on public.meal_plan_entries
  for select using (public.is_meal_plan_owner(meal_plan_id));

create policy "mpe_insert" on public.meal_plan_entries
  for insert with check (public.is_meal_plan_owner(meal_plan_id));

create policy "mpe_update" on public.meal_plan_entries
  for update using (public.is_meal_plan_owner(meal_plan_id));

create policy "mpe_delete" on public.meal_plan_entries
  for delete using (public.is_meal_plan_owner(meal_plan_id));

-- ── RLS Policies: grocery_list_items ───────────────────────────────────────

create policy "gli_select" on public.grocery_list_items
  for select using (public.is_meal_plan_owner(meal_plan_id));

create policy "gli_insert" on public.grocery_list_items
  for insert with check (public.is_meal_plan_owner(meal_plan_id));

create policy "gli_update" on public.grocery_list_items
  for update using (public.is_meal_plan_owner(meal_plan_id));

create policy "gli_delete" on public.grocery_list_items
  for delete using (public.is_meal_plan_owner(meal_plan_id));

-- ── Updated_at triggers ─────────────────────────────────────────────────────

create trigger update_meal_plan_entries_updated_at
  before update on public.meal_plan_entries
  for each row execute function public.update_updated_at_column();

create trigger update_grocery_list_items_updated_at
  before update on public.grocery_list_items
  for each row execute function public.update_updated_at_column();

-- ── Backfill: meals JSONB → meal_plan_entries ──────────────────────────────
-- Handles two shapes:
--   1. Date-keyed: meals->'2026-09-01'->>'breakfast' = PlannedMealEntry[]
--   2. Underscore-keyed: meals->'_snacks' = PlannedMealEntry[]
-- Skips entries where recipeId is missing or not a valid UUID.
-- Skips plans where meals is NULL or not an object.

do $$
declare
  v_position int;
begin

  -- Date-keyed entries (date + slot)
  insert into public.meal_plan_entries (
    meal_plan_id, date, slot, recipe_id, recipe_name, recipe_image,
    servings, prep_time, cook_time, notes, position
  )
  select
    mp.id                              as meal_plan_id,
    day.date_key::date                 as date,
    slot.slot_name                     as slot,
    (entry->>'recipeId')::uuid         as recipe_id,
    entry->>'recipeName'               as recipe_name,
    entry->>'recipeImage'              as recipe_image,
    (entry->>'servings')::int          as servings,
    (entry->>'prepTime')::int          as prep_time,
    (entry->>'cookTime')::int          as cook_time,
    entry->>'notes'                    as notes,
    (row_number() over (
      partition by mp.id, day.date_key, slot.slot_name
      order by (entry->>'id')
    ) - 1)::int                        as position
  from public.meal_plans mp
  cross join lateral jsonb_each(mp.meals)         as day(date_key, day_value)
  cross join lateral jsonb_each(day.day_value)    as slot(slot_name, slot_entries)
  cross join lateral jsonb_array_elements(slot.slot_entries) as entry
  where mp.meals is not null
    and jsonb_typeof(mp.meals) = 'object'
    and day.date_key not like '\_%%'              -- skip underscore-keyed plan-level lists
    and day.date_key ~ '^\d{4}-\d{2}-\d{2}$'     -- must look like a date
    and jsonb_typeof(day.day_value) = 'object'
    and jsonb_typeof(slot.slot_entries) = 'array'
    and slot.slot_name in ('breakfast', 'lunch', 'dinner', 'snacks')
    and entry ? 'recipeId'
    and entry->>'recipeId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  on conflict do nothing;

  -- Underscore-keyed plan-level list entries (list_key, no date/slot)
  insert into public.meal_plan_entries (
    meal_plan_id, list_key, recipe_id, recipe_name, recipe_image,
    servings, prep_time, cook_time, notes, position
  )
  select
    mp.id                              as meal_plan_id,
    ltrim(list.list_key, '_')          as list_key,   -- strip leading _ for storage
    (entry->>'recipeId')::uuid         as recipe_id,
    entry->>'recipeName'               as recipe_name,
    entry->>'recipeImage'              as recipe_image,
    (entry->>'servings')::int          as servings,
    (entry->>'prepTime')::int          as prep_time,
    (entry->>'cookTime')::int          as cook_time,
    entry->>'notes'                    as notes,
    (row_number() over (
      partition by mp.id, list.list_key
      order by (entry->>'id')
    ) - 1)::int                        as position
  from public.meal_plans mp
  cross join lateral jsonb_each(mp.meals)             as list(list_key, list_entries)
  cross join lateral jsonb_array_elements(list.list_entries) as entry
  where mp.meals is not null
    and jsonb_typeof(mp.meals) = 'object'
    and list.list_key like '\_%%'                     -- only underscore-keyed entries
    and jsonb_typeof(list.list_entries) = 'array'
    and entry ? 'recipeId'
    and entry->>'recipeId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  on conflict do nothing;

end; $$;

-- ── Backfill: grocery_list JSONB → grocery_list_items ──────────────────────
-- Expects grocery_list shape: { items: GroceryItem[], lastGenerated: string }
-- GroceryItem fields: id, name, amount, unit, category, sourceRecipes,
--   isManual, isChecked, isRemoved, notes, rawAmount
-- Skips plans where grocery_list is NULL or has no items array.

do $$
declare
  v_last_generated timestamptz;
begin

  insert into public.grocery_list_items (
    meal_plan_id, name, amount, unit, category, source_recipes,
    is_manual, is_checked, is_removed, notes, raw_amount,
    position, last_generated
  )
  select
    mp.id                                            as meal_plan_id,
    item->>'name'                                    as name,
    case when item->>'amount' is null or item->>'amount' = 'null'
         then null
         else (item->>'amount')::numeric end          as amount,
    coalesce(item->>'unit', '')                      as unit,
    coalesce(item->>'category', 'other')             as category,
    -- sourceRecipes is a JSON string array; cast each element
    coalesce(
      array(select jsonb_array_elements_text(item->'sourceRecipes')),
      '{}'::text[]
    )                                                as source_recipes,
    coalesce((item->>'isManual')::boolean, false)    as is_manual,
    coalesce((item->>'isChecked')::boolean, false)   as is_checked,
    coalesce((item->>'isRemoved')::boolean, false)   as is_removed,
    item->>'notes'                                   as notes,
    case when item->>'rawAmount' is null or item->>'rawAmount' = 'null'
         then null
         else (item->>'rawAmount')::numeric end       as raw_amount,
    (row_number() over (partition by mp.id order by (item->>'id')))::int - 1 as position,
    case when mp.grocery_list->>'lastGenerated' is null then null
         else (mp.grocery_list->>'lastGenerated')::timestamptz end as last_generated
  from public.meal_plans mp
  cross join lateral jsonb_array_elements(mp.grocery_list->'items') as item
  where mp.grocery_list is not null
    and jsonb_typeof(mp.grocery_list) = 'object'
    and mp.grocery_list ? 'items'
    and jsonb_typeof(mp.grocery_list->'items') = 'array'
    and item->>'name' is not null
    and item->>'name' != ''
  on conflict do nothing;

end; $$;
