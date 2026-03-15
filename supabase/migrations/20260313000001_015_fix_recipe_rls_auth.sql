-- Migration 015: Fix recipes INSERT/UPDATE/DELETE RLS policies
-- ============================================================================
-- Problem: These three policies still use the old Stack Auth method
--   current_setting('app.current_user_id') which Supabase Auth never sets.
-- The SELECT policy was fixed in migration 009 to use auth.uid(), but
-- INSERT/UPDATE/DELETE were left on the old system, silently blocking writes.
-- ============================================================================

-- Fix UPDATE policy
DROP POLICY IF EXISTS "Users can update own recipes" ON recipes;
CREATE POLICY "Users can update own recipes" ON recipes
    FOR UPDATE USING (auth.uid() = user_id);

-- Fix INSERT policy
DROP POLICY IF EXISTS "Users can insert own recipes" ON recipes;
CREATE POLICY "Users can insert own recipes" ON recipes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Fix DELETE policy
DROP POLICY IF EXISTS "Users can delete own recipes" ON recipes;
CREATE POLICY "Users can delete own recipes" ON recipes
    FOR DELETE USING (auth.uid() = user_id);
