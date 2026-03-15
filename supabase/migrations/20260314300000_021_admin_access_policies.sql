-- Migration 021: Admin access — helper function + RLS policies
-- ============================================================================
-- Enables admin users to read/manage all profiles, invites, and households.
-- ============================================================================

-- Helper: check if current auth user has the 'admin' role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.name = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Admin can read all profiles
CREATE POLICY "admin_read_all_profiles" ON profiles
  FOR SELECT USING (is_admin());

-- Admin can update any profile
CREATE POLICY "admin_update_all_profiles" ON profiles
  FOR UPDATE USING (is_admin());

-- Admin can delete any profile
CREATE POLICY "admin_delete_all_profiles" ON profiles
  FOR DELETE USING (is_admin());

-- Admin can read all household invites
CREATE POLICY "admin_read_all_invites" ON household_invites
  FOR SELECT USING (is_admin());

-- Admin can delete any invite
CREATE POLICY "admin_delete_all_invites" ON household_invites
  FOR DELETE USING (is_admin());

-- Admin can update any invite (e.g. cancel)
CREATE POLICY "admin_update_all_invites" ON household_invites
  FOR UPDATE USING (is_admin());

-- Admin can read all households
CREATE POLICY "admin_read_all_households" ON households
  FOR SELECT USING (is_admin());

-- Admin can read all household members
CREATE POLICY "admin_read_all_household_members" ON household_members
  FOR SELECT USING (is_admin());

-- Admin can delete household members
CREATE POLICY "admin_delete_all_household_members" ON household_members
  FOR DELETE USING (is_admin());

-- Admin can read all user_roles
CREATE POLICY "admin_read_all_user_roles" ON user_roles
  FOR SELECT USING (is_admin());

-- Admin can read all roles
CREATE POLICY "admin_read_all_roles" ON roles
  FOR SELECT USING (is_admin());
