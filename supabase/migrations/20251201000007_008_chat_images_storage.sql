-- ============================================================================
-- Migration 008: Chat Images Storage Bucket
-- Creates a public bucket for storing images sent in chat conversations.
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'storage' AND table_name = 'buckets'
    ) THEN
        INSERT INTO storage.buckets (id, name, public)
        VALUES ('chat-images', 'chat-images', true)
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- Storage RLS policies for chat-images
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'storage' AND table_name = 'objects'
    ) THEN
        -- Upload: path must start with chat/{user_id}/
        DROP POLICY IF EXISTS "Users can upload chat images" ON storage.objects;
        CREATE POLICY "Users can upload chat images"
        ON storage.objects FOR INSERT TO authenticated
        WITH CHECK (
            bucket_id = 'chat-images' AND
            (string_to_array(name, '/'))[1] = 'chat' AND
            (string_to_array(name, '/'))[2] = auth.uid()::text
        );

        -- Delete: own images only
        DROP POLICY IF EXISTS "Users can delete their own chat images" ON storage.objects;
        CREATE POLICY "Users can delete their own chat images"
        ON storage.objects FOR DELETE TO authenticated
        USING (
            bucket_id = 'chat-images' AND
            (string_to_array(name, '/'))[1] = 'chat' AND
            (string_to_array(name, '/'))[2] = auth.uid()::text
        );

        -- Public read access (bucket is public)
        DROP POLICY IF EXISTS "Public can view chat images" ON storage.objects;
        CREATE POLICY "Public can view chat images"
        ON storage.objects FOR SELECT TO public
        USING (bucket_id = 'chat-images');

        -- Service role can insert (edge functions use service role)
        DROP POLICY IF EXISTS "Service role can upload chat images" ON storage.objects;
        CREATE POLICY "Service role can upload chat images"
        ON storage.objects FOR INSERT TO service_role
        WITH CHECK (bucket_id = 'chat-images');
    END IF;
END $$;
