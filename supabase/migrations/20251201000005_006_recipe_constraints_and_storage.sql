-- ============================================================================
-- Migration 006: Recipe Constraints & Storage
-- Adds unique title constraint per user, creates recipe-images storage bucket.
-- ============================================================================

-- ============================================================================
-- Unique constraint: one recipe title per user (case-insensitive)
-- ============================================================================

-- Remove any existing duplicates (keep the most recent)
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_recipes_user_title_unique
    ON recipes(user_id, LOWER(TRIM(title)));

COMMENT ON INDEX idx_recipes_user_title_unique IS
    'Ensures each user can only have one recipe with a given title (case-insensitive)';

-- ============================================================================
-- Storage bucket: recipe-images
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'storage' AND table_name = 'buckets'
        AND EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'storage' AND table_name = 'buckets' AND column_name = 'public'
        )
    ) THEN
        INSERT INTO storage.buckets (id, name, public)
        VALUES ('recipe-images', 'recipe-images', true)
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- Storage RLS policies
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'storage' AND table_name = 'objects'
    ) THEN
        DROP POLICY IF EXISTS "Users can upload recipe images" ON storage.objects;
        CREATE POLICY "Users can upload recipe images"
        ON storage.objects FOR INSERT TO authenticated
        WITH CHECK (
            bucket_id = 'recipe-images' AND
            (string_to_array(name, '/'))[1] = auth.uid()::text
        );

        DROP POLICY IF EXISTS "Users can update their own recipe images" ON storage.objects;
        CREATE POLICY "Users can update their own recipe images"
        ON storage.objects FOR UPDATE TO authenticated
        USING (
            bucket_id = 'recipe-images' AND
            (string_to_array(name, '/'))[1] = auth.uid()::text
        )
        WITH CHECK (
            bucket_id = 'recipe-images' AND
            (string_to_array(name, '/'))[1] = auth.uid()::text
        );

        DROP POLICY IF EXISTS "Users can delete their own recipe images" ON storage.objects;
        CREATE POLICY "Users can delete their own recipe images"
        ON storage.objects FOR DELETE TO authenticated
        USING (
            bucket_id = 'recipe-images' AND
            (string_to_array(name, '/'))[1] = auth.uid()::text
        );

        DROP POLICY IF EXISTS "Public can view recipe images" ON storage.objects;
        CREATE POLICY "Public can view recipe images"
        ON storage.objects FOR SELECT TO public
        USING (bucket_id = 'recipe-images');
    END IF;
END $$;
