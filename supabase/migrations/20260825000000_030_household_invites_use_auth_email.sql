-- Migration 030: household_invites RLS — stop trusting client-writable profiles.email
-- ============================================================================
-- profiles.email is UPDATE-able by the profile owner via a normal client
-- .update() call ("Users can update their own profile" in migration 003 has
-- no column restriction and no WITH CHECK), with no re-verification against
-- the user's actual Supabase Auth identity.
--
-- household_invites' SELECT/UPDATE policies matched invited_email against
-- profiles.email. profiles.email is UNIQUE NOT NULL, so an attacker can't
-- impersonate someone who already has an account (that email is already
-- claimed by the real owner's own profiles row) -- but they CAN hijack an
-- invite sent to an address that hasn't signed up yet: set their own
-- profiles.email to the not-yet-claimed invited address (nothing blocks
-- that), then view/accept-adjacent-manipulate the invite via direct
-- PostgREST access, bypassing the edge function's own accept flow (which
-- idempotently no-ops on an already-accepted invite, silently denying the
-- real invitee).
--
-- Fix: match against auth.email() instead of profiles.email -- the email
-- claim from the caller's verified JWT, sourced from auth.users, which is
-- not client-writable via PostgREST at all. This is exactly how the edge
-- function's own accept handler already derives identity correctly
-- (household-invite/index.ts's handleAccept uses auth.user.email from the
-- verified JWT, never profiles.email); this migration brings the RLS
-- policies in line with that already-correct pattern instead of leaving a
-- second, weaker identity check standing next to it.
--
-- Also lowercases both sides of the comparison, matching the case-
-- insensitive matching handle_new_user() already uses for its own
-- invited_email lookup (lower(invited_email) = lower(NEW.email)) -- the
-- previous RLS policies did not lowercase, so e.g. "User@Example.com" vs
-- "user@example.com" could mismatch.
-- ============================================================================

DROP POLICY IF EXISTS "Users can view invites for their households" ON household_invites;
CREATE POLICY "Users can view invites for their households" ON household_invites
    FOR SELECT USING (
        is_household_member(household_id, auth.uid())
        OR lower(invited_email) = lower(auth.email())
    );

DROP POLICY IF EXISTS "Owners and admins can update invites" ON household_invites;
CREATE POLICY "Owners and admins can update invites" ON household_invites
    FOR UPDATE USING (
        get_household_role(household_id, auth.uid()) IN ('owner', 'admin')
        OR lower(invited_email) = lower(auth.email())
    );
