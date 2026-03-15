-- Migration 022: Admin can delete households
-- ============================================================================

CREATE POLICY "admin_delete_all_households" ON households
  FOR DELETE USING (is_admin());
