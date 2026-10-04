-- ============================================================================
-- Migration 032: Household RBAC flags for dietary profile edit permissions
-- ADR-0005: Household Dietary Profile RBAC and Unified Profile UX
-- ============================================================================

-- Add permission flags to households
ALTER TABLE households
  ADD COLUMN IF NOT EXISTS allow_member_edits        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_member_child_edits  BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN households.allow_member_edits IS
  'ADR-0005: When true, non-owner/admin members may edit other members'' dietary profiles.';

COMMENT ON COLUMN households.allow_member_child_edits IS
  'ADR-0005: When true, non-owner/admin members may create and edit dependent (child) dietary profiles.';

-- ── family_members RLS update ─────────────────────────────────────────────────
-- Drop the existing permissive UPDATE policy and replace with role-aware one.
-- The old policy allowed any household member to update any dependent.
-- NOTE: is_household_member and get_household_role take two arguments:
--   (p_household_id UUID, p_user_id UUID) — pass auth.uid() as the second arg.

DROP POLICY IF EXISTS "Household members can manage family members" ON family_members;
DROP POLICY IF EXISTS "family_members_select" ON family_members;
DROP POLICY IF EXISTS "family_members_insert" ON family_members;
DROP POLICY IF EXISTS "family_members_update" ON family_members;
DROP POLICY IF EXISTS "family_members_delete" ON family_members;

-- SELECT: any household member can read dependents (unchanged)
CREATE POLICY "family_members_select" ON family_members
  FOR SELECT USING (is_household_member(household_id, auth.uid()));

-- INSERT: owner/admin always; member only if allow_member_child_edits = true
CREATE POLICY "family_members_insert" ON family_members
  FOR INSERT WITH CHECK (
    get_household_role(household_id, auth.uid()) IN ('owner', 'admin')
    OR (
      is_household_member(household_id, auth.uid())
      AND (SELECT allow_member_child_edits FROM households WHERE id = household_id)
    )
  );

-- UPDATE: owner/admin always; member only if allow_member_child_edits = true
CREATE POLICY "family_members_update" ON family_members
  FOR UPDATE USING (
    get_household_role(household_id, auth.uid()) IN ('owner', 'admin')
    OR (
      is_household_member(household_id, auth.uid())
      AND (SELECT allow_member_child_edits FROM households WHERE id = household_id)
    )
  );

-- DELETE: owner/admin always; member only if allow_member_child_edits = true
CREATE POLICY "family_members_delete" ON family_members
  FOR DELETE USING (
    get_household_role(household_id, auth.uid()) IN ('owner', 'admin')
    OR (
      is_household_member(household_id, auth.uid())
      AND (SELECT allow_member_child_edits FROM households WHERE id = household_id)
    )
  );
