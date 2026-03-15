-- Migration 016: Remove "My Recipes" default collection
-- ============================================================================
-- The sidebar already has a "My Recipes" feed view that shows all recipes
-- owned by the user. The "My Recipes" collection is redundant and confusing.
-- Only "Favorites" remains as a default collection.
-- ============================================================================

-- 1. Move any recipes from "My Recipes" collections to "Favorites" (preserve user data)
INSERT INTO collection_recipes (collection_id, recipe_id, added_at)
SELECT fav.id, cr.recipe_id, cr.added_at
FROM collection_recipes cr
JOIN recipe_collections myrc ON cr.collection_id = myrc.id AND myrc.name = 'My Recipes'
JOIN recipe_collections fav ON fav.user_id = myrc.user_id AND fav.name = 'Favorites'
ON CONFLICT DO NOTHING;

-- 2. Delete collection_recipes entries for "My Recipes" collections
DELETE FROM collection_recipes
WHERE collection_id IN (SELECT id FROM recipe_collections WHERE name = 'My Recipes');

-- 3. Delete the "My Recipes" collections themselves
DELETE FROM recipe_collections WHERE name = 'My Recipes';

-- 4. Update handle_new_user() to stop creating "My Recipes" collection
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_display_name TEXT;
    v_household_id UUID;
    v_username TEXT;
    v_base TEXT;
    v_suffix TEXT;
BEGIN
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

    -- Upsert profile
    INSERT INTO public.profiles (id, display_name, avatar_url, username, updated_at)
    VALUES (
        NEW.id,
        v_display_name,
        COALESCE(
            NEW.raw_user_meta_data->>'avatar_url',
            NEW.raw_user_meta_data->>'picture'
        ),
        v_username,
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

    -- Create household for new user (only if they don't already have one)
    IF NOT EXISTS (SELECT 1 FROM household_members WHERE user_id = NEW.id) THEN
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
