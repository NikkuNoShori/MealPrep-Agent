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

DROP POLICY IF EXISTS "Household members can manage family members" ON family_members;
DROP POLICY IF EXISTS "family_members_update" ON family_members;

-- SELECT: any household member can read dependents (unchanged)
-- UPDATE/DELETE: owner or admin always; member only if flag allows
CREATE POLICY "family_members_select" ON family_members
  FOR SELECT USING (is_household_member(household_id));

CREATE POLICY "family_members_insert" ON family_members
  FOR INSERT WITH CHECK (
    get_household_role(household_id) IN ('owner', 'admin')
    OR (
      is_household_member(household_id)
      AND (SELECT allow_member_child_edits FROM households WHERE id = household_id)
    )
  );

CREATE POLICY "family_members_update" ON family_members
  FOR UPDATE USING (
    get_household_role(household_id) IN ('owner', 'admin')
    OR (
      is_household_member(household_id)
      AND (SELECT allow_member_child_edits FROM households WHERE id = household_id)
    )
  );

CREATE POLICY "family_members_delete" ON family_members
  FOR DELETE USING (
    get_household_role(household_id) IN ('owner', 'admin')
    OR (
      is_household_member(household_id)
      AND (SELECT allow_member_child_edits FROM households WHERE id = household_id)
    )
  );
