-- Add unique constraint on (user_id, title) to prevent duplicate recipe names per user
-- This allows different users to have recipes with the same name, but prevents duplicates for the same user

-- First, remove any existing duplicates (keep the most recent one)
DO $$
DECLARE
    dup_record RECORD;
BEGIN
    FOR dup_record IN 
        SELECT user_id, title, COUNT(*) as count
        FROM recipes
        GROUP BY user_id, title
        HAVING COUNT(*) > 1
    LOOP
        -- Delete all but the most recent recipe with this user_id and title
        DELETE FROM recipes
        WHERE id IN (
            SELECT id
            FROM recipes
            WHERE user_id = dup_record.user_id
              AND title = dup_record.title
            ORDER BY created_at DESC
            OFFSET 1
        );
    END LOOP;
END $$;

-- Create unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_recipes_user_title_unique 
ON recipes(user_id, LOWER(TRIM(title)));

-- Add a comment explaining the constraint
COMMENT ON INDEX idx_recipes_user_title_unique IS 
'Ensures each user can only have one recipe with a given title (case-insensitive)';

