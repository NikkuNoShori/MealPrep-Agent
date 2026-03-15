-- Migration 024: Allow household members to view each other's profiles
-- Without this, the profiles join in getMyHousehold() returns null for
-- other members due to the "Users can view their own profile" RLS policy,
-- causing them to display as "Unknown".

-- Allow SELECT on profiles for users who share a household
CREATE POLICY "Household members can view each other's profiles" ON profiles
  FOR SELECT USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM household_members AS my
      JOIN household_members AS theirs
        ON my.household_id = theirs.household_id
      WHERE my.user_id = auth.uid()
        AND theirs.user_id = profiles.id
    )
  );
