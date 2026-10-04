-- Migration 037: Household Write Atomicity RPCs
-- Wraps transferOwnership and respondToInvite in SECURITY DEFINER functions
-- so each is atomic (Postgres rolls back all writes on any unhandled exception).
--
-- Motivation: the prior sequential Supabase client writes could leave the DB in
-- an inconsistent state if the second write failed:
--   - transferOwnership: two owners simultaneously (privilege-escalation window)
--   - respondToInvite: invite marked accepted with no household_members row
--
-- Pattern precedent: MOP-0002 / migration 025 (five household RPCs).
-- HARD RULE: this file is authored locally only — user deploys via Supabase CLI.

-- ============================================================================
-- 1. transfer_household_ownership
-- ============================================================================

create or replace function public.transfer_household_ownership(
  p_member_id   uuid,
  p_household_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id   uuid := auth.uid();
  v_caller_role text;
begin
  if v_caller_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- Caller must currently be owner of this household
  select role into v_caller_role
  from household_members
  where household_id = p_household_id
    and user_id = v_caller_id;

  if v_caller_role is null or v_caller_role <> 'owner' then
    raise exception 'caller is not owner of household %', p_household_id
      using errcode = '42501';
  end if;

  -- Target must be an existing member of this household
  perform 1
  from household_members
  where id = p_member_id
    and household_id = p_household_id;

  if not found then
    raise exception 'member % is not in household %', p_member_id, p_household_id
      using errcode = '22023';
  end if;

  -- Atomic swap: promote target, demote caller
  update household_members set role = 'owner' where id = p_member_id;
  update household_members
    set role = 'admin'
    where household_id = p_household_id
      and user_id = v_caller_id;
end;
$$;

revoke all on function public.transfer_household_ownership(uuid, uuid) from public;
grant execute on function public.transfer_household_ownership(uuid, uuid) to authenticated;

-- ============================================================================
-- 2. respond_to_household_invite
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
    on conflict (household_id, user_id) do nothing;
  end if;

  return query
    select h.id, h.name, v_new_status
    from households h
    where h.id = v_invite.household_id;
end;
$$;

revoke all on function public.respond_to_household_invite(uuid, boolean) from public;
grant execute on function public.respond_to_household_invite(uuid, boolean) to authenticated;
