-- ============================================================================
-- Migration 010: Fix Household RLS Infinite Recursion
--
-- Problem: household_members RLS policies reference household_members in
-- subqueries, causing PostgreSQL error 42P17 "infinite recursion detected
-- in policy for relation household_members". Any table policy that subqueries
-- household_members (recipes, family_members, households, invites) also fails.
--
-- Fix: SECURITY DEFINER helper functions that bypass RLS for membership checks.
-- All policies updated to use these helpers instead of direct subqueries.
-- ============================================================================

-- ============================================================================
-- 1. HELPER FUNCTIONS (SECURITY DEFINER bypasses RLS)
-- ============================================================================

CREATE OR REPLACE FUNCTION is_household_member(p_household_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM household_members
        WHERE household_id = p_household_id
        AND user_id = p_user_id
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_household_role(p_household_id UUID, p_user_id UUID)
RETURNS TEXT AS $$
    SELECT role FROM household_members
    WHERE household_id = p_household_id
    AND user_id = p_user_id
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================================
-- 2. HOUSEHOLD_MEMBERS POLICIES (the root cause of recursion)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view members of their households" ON household_members;
CREATE POLICY "Users can view members of their households" ON household_members
    FOR SELECT USING (
        is_household_member(household_id, auth.uid())
    );

DROP POLICY IF EXISTS "Owners and admins can insert members" ON household_members;
CREATE POLICY "Owners and admins can insert members" ON household_members
    FOR INSERT WITH CHECK (
        get_household_role(household_id, auth.uid()) IN ('owner', 'admin')
    );

DROP POLICY IF EXISTS "Owners can update members" ON household_members;
CREATE POLICY "Owners can update members" ON household_members
    FOR UPDATE USING (
        get_household_role(household_id, auth.uid()) = 'owner'
    );

DROP POLICY IF EXISTS "Owners can remove members or members can leave" ON household_members;
CREATE POLICY "Owners can remove members or members can leave" ON household_members
    FOR DELETE USING (
        get_household_role(household_id, auth.uid()) = 'owner'
        OR user_id = auth.uid()
    );

-- ============================================================================
-- 3. HOUSEHOLDS POLICIES (referenced household_members in subqueries)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their households" ON households;
CREATE POLICY "Users can view their households" ON households
    FOR SELECT USING (
        is_household_member(id, auth.uid())
    );

DROP POLICY IF EXISTS "Household owners can update" ON households;
CREATE POLICY "Household owners can update" ON households
    FOR UPDATE USING (
        get_household_role(id, auth.uid()) = 'owner'
    );

DROP POLICY IF EXISTS "Household owners can delete" ON households;
CREATE POLICY "Household owners can delete" ON households
    FOR DELETE USING (
        get_household_role(id, auth.uid()) = 'owner'
    );

-- ============================================================================
-- 4. HOUSEHOLD_INVITES POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view invites for their households" ON household_invites;
CREATE POLICY "Users can view invites for their households" ON household_invites
    FOR SELECT USING (
        is_household_member(household_id, auth.uid())
        OR invited_email = (SELECT email FROM profiles WHERE id = auth.uid())
    );

DROP POLICY IF EXISTS "Owners and admins can create invites" ON household_invites;
CREATE POLICY "Owners and admins can create invites" ON household_invites
    FOR INSERT WITH CHECK (
        get_household_role(household_id, auth.uid()) IN ('owner', 'admin')
    );

DROP POLICY IF EXISTS "Owners and admins can update invites" ON household_invites;
CREATE POLICY "Owners and admins can update invites" ON household_invites
    FOR UPDATE USING (
        get_household_role(household_id, auth.uid()) IN ('owner', 'admin')
        OR invited_email = (SELECT email FROM profiles WHERE id = auth.uid())
    );

-- ============================================================================
-- 5. RECIPES SELECT POLICY (referenced household_members in subquery)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view accessible recipes" ON recipes;
CREATE POLICY "Users can view accessible recipes" ON recipes
    FOR SELECT USING (
        auth.uid() = user_id
        OR (visibility = 'household' AND EXISTS (
            SELECT 1 FROM household_members hm
            WHERE hm.user_id = recipes.user_id
            AND is_household_member(hm.household_id, auth.uid())
        ))
        OR visibility = 'public'
    );

-- ============================================================================
-- 6. FAMILY_MEMBERS POLICIES (referenced household_members in subqueries)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their family members" ON family_members;
CREATE POLICY "Users can view their family members" ON family_members
    FOR SELECT USING (
        is_household_member(household_id, auth.uid())
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.family_id = family_members.family_id
        )
    );

DROP POLICY IF EXISTS "Users can insert family members in their household" ON family_members;
CREATE POLICY "Users can insert family members in their household" ON family_members
    FOR INSERT WITH CHECK (
        is_household_member(household_id, auth.uid())
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.family_id = family_members.family_id
        )
    );

DROP POLICY IF EXISTS "Users can update their family members" ON family_members;
CREATE POLICY "Users can update their family members" ON family_members
    FOR UPDATE USING (
        is_household_member(household_id, auth.uid())
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.family_id = family_members.family_id
        )
    );

DROP POLICY IF EXISTS "Users can delete their family members" ON family_members;
CREATE POLICY "Users can delete their family members" ON family_members
    FOR DELETE USING (
        is_household_member(household_id, auth.uid())
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.family_id = family_members.family_id
        )
    );
