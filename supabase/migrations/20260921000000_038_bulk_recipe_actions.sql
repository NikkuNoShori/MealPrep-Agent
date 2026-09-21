-- Migration 038: Bulk Recipe Actions (MOP-0028)
-- Three SECURITY DEFINER RPCs for bulk operations.
-- All validate auth.uid() and operate on arrays.
-- Deploy: user handles (HARD RULE — never pushed by Claude).

-- 1. bulk_update_recipe_visibility
--    Updates visibility for all recipes in the array owned by the caller.
--    Silently skips any IDs the caller does not own. Returns row count.
create or replace function public.bulk_update_recipe_visibility(
  p_recipe_ids uuid[],
  p_visibility text   -- 'private' | 'household' | 'public'
) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_visibility not in ('private', 'household', 'public') then
    raise exception 'invalid visibility value' using errcode = '22023';
  end if;
  update recipes
    set visibility = p_visibility
    where id = any(p_recipe_ids)
      and user_id = auth.uid();
  get diagnostics v_count = row_count;
  return v_count;
end; $$;

-- 2. bulk_delete_recipes
--    Deletes all recipes in the array owned by the caller.
--    Silently skips IDs the caller does not own. Returns rows deleted.
create or replace function public.bulk_delete_recipes(
  p_recipe_ids uuid[]
) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  delete from recipes
    where id = any(p_recipe_ids)
      and user_id = auth.uid();
  get diagnostics v_count = row_count;
  return v_count;
end; $$;

-- 3. bulk_add_to_collection
--    Adds all recipe IDs to the target collection.
--    Caller must own the collection. Silently ignores duplicates via ON CONFLICT.
create or replace function public.bulk_add_to_collection(
  p_collection_id uuid,
  p_recipe_ids    uuid[]
) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  -- Verify caller owns the collection
  perform 1 from recipe_collections
    where id = p_collection_id and user_id = auth.uid();
  if not found then
    raise exception 'collection % not found or not owned by caller', p_collection_id
      using errcode = '42501';
  end if;
  insert into collection_recipes (collection_id, recipe_id)
    select p_collection_id, unnest(p_recipe_ids)
    on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end; $$;
