-- Run this in Supabase SQL Editor after creating the recipe-images bucket manually
-- This sets up the Row Level Security policies for the storage bucket

-- Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can upload recipe images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own recipe images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own recipe images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view recipe images" ON storage.objects;

-- Policy: Allow authenticated users to upload images to their own folder
CREATE POLICY "Users can upload recipe images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'recipe-images' AND
  (string_to_array(name, '/'))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to update their own images
CREATE POLICY "Users can update their own recipe images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'recipe-images' AND
  (string_to_array(name, '/'))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'recipe-images' AND
  (string_to_array(name, '/'))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to delete their own images
CREATE POLICY "Users can delete their own recipe images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'recipe-images' AND
  (string_to_array(name, '/'))[1] = auth.uid()::text
);

-- Policy: Allow public read access to recipe images
CREATE POLICY "Public can view recipe images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'recipe-images');

