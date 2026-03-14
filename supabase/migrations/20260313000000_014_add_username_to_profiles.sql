-- Migration 014: Add username column to profiles
-- Enables public identity for recipe attribution and user search (invites by username)

-- Add username column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- Backfill existing users with a default username derived from email prefix
-- Append random suffix to avoid collisions
UPDATE profiles
SET username = LOWER(
  REGEXP_REPLACE(split_part(email, '@', 1), '[^a-z0-9_]', '', 'g')
) || '_' || SUBSTR(gen_random_uuid()::text, 1, 4)
WHERE username IS NULL;

-- Now make it NOT NULL after backfill
ALTER TABLE profiles ALTER COLUMN username SET NOT NULL;

-- Update handle_new_user() to generate username on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_display_name TEXT;
    v_first_name TEXT;
    v_last_name TEXT;
    v_household_id UUID;
    v_username TEXT;
BEGIN
    -- Extract display name from various OAuth provider formats
    v_display_name := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''),
        NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
        NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
        NULLIF(TRIM(CONCAT(
            COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
            ' ',
            COALESCE(NEW.raw_user_meta_data->>'last_name', '')
        )), ''),
        split_part(COALESCE(NEW.email, 'user'), '@', 1)
    );

    -- Extract first/last name (Google uses given_name/family_name)
    v_first_name := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'first_name'), ''),
        NULLIF(TRIM(NEW.raw_user_meta_data->>'given_name'), ''),
        split_part(COALESCE(v_display_name, ''), ' ', 1)
    );

    v_last_name := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'last_name'), ''),
        NULLIF(TRIM(NEW.raw_user_meta_data->>'family_name'), ''),
        ''
    );

    -- Generate username from email prefix + random suffix
    v_username := LOWER(
        REGEXP_REPLACE(split_part(COALESCE(NEW.email, 'user'), '@', 1), '[^a-z0-9_]', '', 'g')
    ) || '_' || SUBSTR(gen_random_uuid()::text, 1, 4);

    -- Create profile
    INSERT INTO public.profiles (id, email, display_name, first_name, last_name, avatar_url, username, created_at, updated_at)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, ''),
        v_display_name,
        v_first_name,
        v_last_name,
        COALESCE(
            NEW.raw_user_meta_data->>'avatar_url',
            NEW.raw_user_meta_data->>'picture'
        ),
        v_username,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = COALESCE(NEW.email, profiles.email),
        display_name = COALESCE(NULLIF(v_display_name, ''), profiles.display_name),
        first_name = COALESCE(NULLIF(v_first_name, ''), profiles.first_name),
        last_name = COALESCE(NULLIF(v_last_name, ''), profiles.last_name),
        avatar_url = COALESCE(
            NEW.raw_user_meta_data->>'avatar_url',
            NEW.raw_user_meta_data->>'picture',
            profiles.avatar_url
        ),
        updated_at = NOW();

    -- Assign default 'user' role
    INSERT INTO public.user_roles (user_id, role_id)
    SELECT NEW.id, id FROM roles WHERE name = 'user'
    ON CONFLICT (user_id, role_id) DO NOTHING;

    -- Create household for new user (only if they don't already have one)
    IF NOT EXISTS (SELECT 1 FROM household_members WHERE user_id = NEW.id) THEN
        INSERT INTO households (name, created_by)
        VALUES (COALESCE(v_display_name, 'My') || '''s Household', NEW.id)
        RETURNING id INTO v_household_id;

        INSERT INTO household_members (household_id, user_id, role)
        VALUES (v_household_id, NEW.id, 'owner');
    END IF;

    -- Create default collections (only if they don't already have any)
    IF NOT EXISTS (SELECT 1 FROM recipe_collections WHERE user_id = NEW.id) THEN
        INSERT INTO recipe_collections (user_id, name, icon, sort_order)
        VALUES
            (NEW.id, 'Favorites', 'heart', 0),
            (NEW.id, 'My Recipes', 'book', 1);
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'handle_new_user failed for %: % %', NEW.id, SQLERRM, SQLSTATE;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill default collections for existing users who don't have any
INSERT INTO recipe_collections (user_id, name, icon, sort_order)
SELECT p.id, 'Favorites', 'heart', 0
FROM profiles p
WHERE NOT EXISTS (SELECT 1 FROM recipe_collections WHERE user_id = p.id AND name = 'Favorites');

INSERT INTO recipe_collections (user_id, name, icon, sort_order)
SELECT p.id, 'My Recipes', 'book', 1
FROM profiles p
WHERE NOT EXISTS (SELECT 1 FROM recipe_collections WHERE user_id = p.id AND name = 'My Recipes');
