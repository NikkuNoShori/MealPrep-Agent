-- Migration 050: Fix "household_id is ambiguous" in respond_to_household_invite
-- ============================================================================
-- respond_to_household_invite() (migration 037) declares
--   RETURNS TABLE(household_id uuid, ...)
-- which implicitly makes `household_id` an OUT variable for the whole
-- function body. The accept path's
--   INSERT ... ON CONFLICT (household_id, user_id) DO NOTHING
-- column list collides with that OUT variable, so Postgres raises 42702
-- "column reference household_id is ambiguous" whenever p_accept = true —
-- this is what blocked a real user's household invite acceptance.
--
-- Confirmed against the live deployed function via pg_get_functiondef();
-- this migration is otherwise byte-for-byte identical to 037's version.
--
-- Fix: target the conflict by the underlying unique constraint name instead
-- of a bare column list, so there's nothing left for plpgsql to confuse with
-- the OUT variable. No other behavior changes.
-- ============================================================================

create or replace function public.respond_to_household_invite(
  p_invite_id uuid,
  p_accept    boolean
)
returns table (
  household_id   uuid,
  household_name text,
  status         text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id  uuid := auth.uid();
  v_invite     household_invites%rowtype;
  v_new_status text;
begin
  if v_caller_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_invite from household_invites where id = p_invite_id;
  if not found then
    raise exception 'invite % not found', p_invite_id using errcode = '22023';
  end if;

  -- Caller must be the invite addressee (matched by lowercased email).
  -- Invites are scoped by email because they are sent before the recipient
  -- has an account; the match is done at accept-time against auth.users.
  if lower(coalesce(v_invite.invited_email, '')) <> lower(coalesce((
    select email from auth.users where id = v_caller_id
  ), '')) then
    raise exception 'caller is not the invitee for invite %', p_invite_id
      using errcode = '42501';
  end if;

  if v_invite.status <> 'pending' then
    raise exception 'invite % is not pending (current: %)', p_invite_id, v_invite.status
      using errcode = '22023';
  end if;

  v_new_status := case when p_accept then 'accepted' else 'declined' end;

  -- Atomic: update invite status + insert member row together
  update household_invites
    set status = v_new_status
    where id = p_invite_id;

  if p_accept then
    insert into household_members (household_id, user_id, role)
    values (v_invite.household_id, v_caller_id, 'member')
    on conflict on constraint household_members_household_id_user_id_key do nothing;
  end if;

  return query
    select h.id, h.name, v_new_status
    from households h
    where h.id = v_invite.household_id;
end;
$$;

revoke all on function public.respond_to_household_invite(uuid, boolean) from public;
grant execute on function public.respond_to_household_invite(uuid, boolean) to authenticated;
