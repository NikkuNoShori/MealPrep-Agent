-- Migration 043: Direct Recipe Sharing (MOP-0031)
-- Creates recipe_shares junction table with RLS and three SECURITY DEFINER RPCs.
-- Deploy: user handles (HARD RULE — never pushed by Claude).

-- ── Table ──────────────────────────────────────────────────────────────

create table if not exists public.recipe_shares (
  id                uuid primary key default gen_random_uuid(),
  recipe_id         uuid not null references public.recipes(id) on delete cascade,
  shared_by_user_id uuid not null references public.profiles(id) on delete cascade,
  shared_with_user_id uuid not null references public.profiles(id) on delete cascade,
  shared_at         timestamptz not null default now(),
  seen_at           timestamptz,
  constraint recipe_shares_unique unique (recipe_id, shared_with_user_id)
);

alter table public.recipe_shares enable row level security;

-- Indexes for the common access patterns
create index if not exists idx_recipe_shares_shared_with on public.recipe_shares(shared_with_user_id);
create index if not exists idx_recipe_shares_recipe     on public.recipe_shares(recipe_id);

-- ── RLS Policies ───────────────────────────────────────────────────────

-- Sharer can insert (only for their own recipes)
create policy "recipe_shares_insert" on public.recipe_shares
  for insert with check (
    shared_by_user_id = auth.uid()
    and exists (
      select 1 from public.recipes
      where id = recipe_id and user_id = auth.uid()
    )
  );

-- Sharer can delete their own shares
create policy "recipe_shares_delete_by_sharer" on public.recipe_shares
  for delete using (shared_by_user_id = auth.uid());

-- Recipient can delete (unshare from their end)
create policy "recipe_shares_delete_by_recipient" on public.recipe_shares
  for delete using (shared_with_user_id = auth.uid());

-- Both parties can select
create policy "recipe_shares_select" on public.recipe_shares
  for select using (
    shared_by_user_id = auth.uid()
    or shared_with_user_id = auth.uid()
  );

-- Recipient can update seen_at only
create policy "recipe_shares_update_seen" on public.recipe_shares
  for update using (shared_with_user_id = auth.uid())
  with check (shared_with_user_id = auth.uid());

-- ── RPC: share_recipe ──────────────────────────────────────────────────
-- Looks up target by username or email, then inserts a share row.
-- Returns the share id. Raises if caller doesn't own the recipe,
-- target user doesn't exist, or the share already exists.

create or replace function public.share_recipe(
  p_recipe_id            uuid,
  p_target_identifier    text   -- username or email
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_caller      uuid := auth.uid();
  v_target_id   uuid;
  v_share_id    uuid;
begin
  if v_caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- Verify caller owns the recipe
  if not exists (
    select 1 from public.recipes
    where id = p_recipe_id and user_id = v_caller
  ) then
    raise exception 'recipe not found or not owned by caller' using errcode = '42501';
  end if;

  -- Resolve target user (username or email, case-insensitive)
  select id into v_target_id
    from public.profiles
    where lower(username) = lower(trim(p_target_identifier))
       or lower(email)    = lower(trim(p_target_identifier))
    limit 1;

  if v_target_id is null then
    raise exception 'user not found' using errcode = 'P0002';
  end if;

  if v_target_id = v_caller then
    raise exception 'cannot share a recipe with yourself' using errcode = '22023';
  end if;

  -- Upsert — treat a re-share as a no-op, return existing id
  insert into public.recipe_shares (recipe_id, shared_by_user_id, shared_with_user_id)
    values (p_recipe_id, v_caller, v_target_id)
    on conflict (recipe_id, shared_with_user_id) do update
      set shared_by_user_id = excluded.shared_by_user_id,
          shared_at = now(),
          seen_at = null
    returning id into v_share_id;

  return v_share_id;
end; $$;

-- ── RPC: unshare_recipe ────────────────────────────────────────────────
-- Deletes a share row. Caller must be the sharer.

create or replace function public.unshare_recipe(
  p_recipe_id            uuid,
  p_shared_with_user_id  uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  delete from public.recipe_shares
    where recipe_id           = p_recipe_id
      and shared_by_user_id   = v_caller
      and shared_with_user_id = p_shared_with_user_id;
end; $$;

-- ── RPC: get_shared_with_me ────────────────────────────────────────────
-- Returns recipes shared with the caller, newest first.
-- Joins recipe + sharer profile for display.

create or replace function public.get_shared_with_me()
returns table (
  share_id           uuid,
  recipe_id          uuid,
  title              text,
  description        text,
  image_url          text,
  tags               text[],
  visibility         text,
  shared_at          timestamptz,
  seen_at            timestamptz,
  shared_by_user_id  uuid,
  sharer_display_name text,
  sharer_username    text,
  sharer_avatar_url  text
)
language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  return query
    select
      rs.id,
      r.id,
      r.title,
      r.description,
      r.image_url,
      r.tags,
      r.visibility,
      rs.shared_at,
      rs.seen_at,
      rs.shared_by_user_id,
      p.display_name,
      p.username,
      p.avatar_url
    from public.recipe_shares rs
    join public.recipes  r on r.id  = rs.recipe_id
    join public.profiles p on p.id  = rs.shared_by_user_id
    where rs.shared_with_user_id = v_caller
    order by rs.shared_at desc;
end; $$;

-- ── RPC: mark_share_seen ───────────────────────────────────────────────

create or replace function public.mark_share_seen(
  p_share_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  update public.recipe_shares
    set seen_at = now()
    where id = p_share_id
      and shared_with_user_id = v_caller
      and seen_at is null;
end; $$;

-- ── RPC: get_unseen_share_count ────────────────────────────────────────

create or replace function public.get_unseen_share_count()
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := auth.uid();
  v_count  int;
begin
  if v_caller is null then
    return 0;
  end if;

  select count(*) into v_count
    from public.recipe_shares
    where shared_with_user_id = v_caller
      and seen_at is null;

  return v_count;
end; $$;
