-- Migration to sync existing users from custom users table to Supabase Auth
-- This migration helps link existing users with Supabase Auth

-- Update the users table to use auth.users.id as primary key
-- Note: This assumes you'll migrate existing users to Supabase Auth first

-- Add a function to automatically create user profile when auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, neon_user_id, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.id,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = NEW.email,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create user profile when auth user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Note: For existing users in the custom users table, you'll need to:
-- 1. Create corresponding auth.users entries (via Supabase Dashboard or Admin API)
-- 2. Update the custom users.id to match auth.users.id
-- 3. Or use a migration script to create auth users from custom users table

