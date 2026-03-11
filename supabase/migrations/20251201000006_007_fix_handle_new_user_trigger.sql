-- ============================================================================
-- Migration 007: Fix handle_new_user trigger for Google OAuth
-- Google OAuth sends 'full_name' and 'name', not 'display_name'/'first_name'/'last_name'.
-- The previous trigger COALESCE chain could produce empty strings for display_name.
-- This version handles all known OAuth provider metadata formats.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_display_name TEXT;
    v_first_name TEXT;
    v_last_name TEXT;
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

    -- Extract first/last name (Google uses given_name/family_name or full_name)
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

    INSERT INTO public.profiles (id, email, display_name, first_name, last_name, avatar_url, created_at, updated_at)
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

    -- Assign default 'user' role (no-op if already assigned or role doesn't exist)
    INSERT INTO public.user_roles (user_id, role_id)
    SELECT NEW.id, id FROM roles WHERE name = 'user'
    ON CONFLICT (user_id, role_id) DO NOTHING;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't prevent user creation
        RAISE WARNING 'handle_new_user failed for %: % %', NEW.id, SQLERRM, SQLSTATE;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
