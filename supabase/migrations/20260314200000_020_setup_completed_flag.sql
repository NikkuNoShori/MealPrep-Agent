-- Migration 020: Add setup_completed flag to profiles
-- ============================================================================
-- Users created via inviteUserByEmail() are auto-authenticated but haven't
-- set a password, linked OAuth, or chosen a display name. This flag lets
-- ProtectedRoute redirect them to a setup completion page.
-- ============================================================================

-- Default TRUE so existing users are unaffected
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS setup_completed BOOLEAN NOT NULL DEFAULT TRUE;

-- Update handle_new_user() to set setup_completed = false for invited users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_display_name TEXT;
    v_household_id UUID;
    v_username TEXT;
    v_base TEXT;
    v_suffix TEXT;
    v_invite RECORD;
    v_has_accepted_invite BOOLEAN := FALSE;
    v_is_invited BOOLEAN := FALSE;
BEGIN
    -- Detect if this user was created via inviteUserByEmail()
    v_is_invited := (NEW.invited_at IS NOT NULL);

    -- Build display name
    v_display_name := COALESCE(
        NEW.raw_user_meta_data->>'display_name',
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1)
    );

    -- Generate a unique username from email prefix + random suffix
    v_base := lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-z0-9_]', '', 'g'));
    IF length(v_base) < 3 THEN
        v_base := v_base || 'user';
    END IF;
    v_suffix := substr(replace(gen_random_uuid()::text, '-', ''), 1, 4);
    v_username := substr(v_base, 1, 25) || '_' || v_suffix;

    -- Upsert profile (setup_completed = false for invited users)
    INSERT INTO public.profiles (id, display_name, avatar_url, username, setup_completed, updated_at)
    VALUES (
        NEW.id,
        v_display_name,
        COALESCE(
            NEW.raw_user_meta_data->>'avatar_url',
            NEW.raw_user_meta_data->>'picture'
        ),
        v_username,
        NOT v_is_invited,
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        display_name = COALESCE(NULLIF(profiles.display_name, ''), EXCLUDED.display_name),
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

    -- Auto-accept pending household invites for this email
    FOR v_invite IN
        SELECT id, household_id FROM household_invites
        WHERE lower(invited_email) = lower(NEW.email)
          AND status = 'pending'
          AND expires_at > NOW()
    LOOP
        -- Mark invite as accepted
        UPDATE household_invites SET status = 'accepted' WHERE id = v_invite.id;

        -- Add user to household
        INSERT INTO household_members (household_id, user_id, role)
        VALUES (v_invite.household_id, NEW.id, 'member')
        ON CONFLICT (household_id, user_id) DO NOTHING;

        v_has_accepted_invite := TRUE;
    END LOOP;

    -- Create household for new user only if they didn't join one via invite
    IF NOT v_has_accepted_invite AND NOT EXISTS (SELECT 1 FROM household_members WHERE user_id = NEW.id) THEN
        INSERT INTO households (name, created_by)
        VALUES (COALESCE(v_display_name, 'My') || '''s Household', NEW.id)
        RETURNING id INTO v_household_id;

        INSERT INTO household_members (household_id, user_id, role)
        VALUES (v_household_id, NEW.id, 'owner');
    END IF;

    -- Create default collections (only Favorites — "My Recipes" is a feed view, not a collection)
    IF NOT EXISTS (SELECT 1 FROM recipe_collections WHERE user_id = NEW.id) THEN
        INSERT INTO recipe_collections (user_id, name, icon, sort_order)
        VALUES (NEW.id, 'Favorites', 'heart', 0);
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'handle_new_user failed for %: % %', NEW.id, SQLERRM, SQLSTATE;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
