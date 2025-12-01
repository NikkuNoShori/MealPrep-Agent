-- Migration: Auto-create profile trigger
-- Date: 2025-01-27
-- Description: 
--   Automatically create a profile in the profiles table when a user is created in auth.users
--   This trigger fires when Supabase Auth creates a new user (signup, OAuth, magic link, etc.)

BEGIN;

-- Function: Auto-create profile when user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first_name TEXT;
  v_last_name TEXT;
  v_email TEXT;
BEGIN
  -- Extract first and last name from user metadata
  -- Supabase Auth stores OAuth user data in user_metadata
  v_first_name := COALESCE(
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'full_name',
    SPLIT_PART(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''), ' ', 1),
    'User'
  );
  
  v_last_name := COALESCE(
    NEW.raw_user_meta_data->>'last_name',
    SPLIT_PART(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''), ' ', 2),
    ''
  );
  
  -- If full_name exists but no separate first/last, split it
  IF v_last_name = '' AND NEW.raw_user_meta_data->>'full_name' IS NOT NULL THEN
    v_last_name := SPLIT_PART(NEW.raw_user_meta_data->>'full_name', ' ', 2);
    IF v_last_name = '' THEN
      v_last_name := SPLIT_PART(NEW.raw_user_meta_data->>'full_name', ' ', 2);
    END IF;
  END IF;
  
  -- Get email from user record
  v_email := COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', '');
  
  -- Insert profile into profiles table
  INSERT INTO public.profiles (id, email, first_name, last_name, created_at, updated_at)
  VALUES (
    NEW.id,
    v_email,
    v_first_name,
    v_last_name,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, profiles.last_name),
    updated_at = NOW();
  
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users table
-- This trigger fires AFTER a new user is inserted into auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT INSERT, UPDATE ON public.profiles TO authenticated;

COMMIT;

-- Note: This trigger will automatically create a profile when:
-- 1. User signs up with email/password
-- 2. User signs in with OAuth (Google, etc.)
-- 3. User is invited via Supabase dashboard
-- 4. User is created via magic link
--
-- The profile will be created with:
-- - id: Same as auth.users.id (UUID)
-- - email: From auth.users.email or user_metadata
-- - first_name: From user_metadata or extracted from full_name
-- - last_name: From user_metadata or extracted from full_name
-- - Default values: 'User' for first_name, '' for last_name if not available

