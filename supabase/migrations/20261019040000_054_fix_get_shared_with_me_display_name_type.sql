-- Migration 054: Fix get_shared_with_me() -- sharer_display_name/username type
--
-- Migration 053 fixed `title` (recipes.title is VARCHAR, was declared TEXT)
-- but missed two more columns with the same bug: sharer_display_name and
-- sharer_username are declared TEXT, but profiles.display_name is
-- VARCHAR(255) and profiles.username is VARCHAR(50). Confirmed live
-- 2026-10-19 via the exact error after 053 was deployed: "Returned type
-- character varying(255) does not match expected type text in column 11"
-- (column 11 = sharer_display_name).
--
-- Checked every remaining column against its source table this time
-- (profiles.avatar_url and recipes.description/image_url/visibility/tags
-- are genuinely TEXT/ARRAY, confirmed via information_schema.columns) to
-- avoid a third round of this same mistake.
--
-- CREATE OR REPLACE cannot change OUT-parameter types (42P13) -- DROP
-- FUNCTION required first, same pattern as migrations 050b and 053.

DROP FUNCTION IF EXISTS get_shared_with_me();

CREATE FUNCTION get_shared_with_me()
RETURNS TABLE(
  share_id UUID,
  recipe_id UUID,
  title VARCHAR,
  description TEXT,
  image_url TEXT,
  tags TEXT[],
  visibility TEXT,
  shared_at TIMESTAMPTZ,
  seen_at TIMESTAMPTZ,
  shared_by_user_id UUID,
  sharer_display_name VARCHAR,
  sharer_username VARCHAR,
  sharer_avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT
      rs.id,
      r.id,
      r.title,
      r.description,
      r.image_url,
      r.tags,
      r.visibility,
      rs.shared_at,
      rs.seen_at,
      rs.shared_by_user_id,
      p.display_name,
      p.username,
      p.avatar_url
    FROM public.recipe_shares rs
    JOIN public.recipes  r ON r.id  = rs.recipe_id
    JOIN public.profiles p ON p.id  = rs.shared_by_user_id
    WHERE rs.shared_with_user_id = v_caller
    ORDER BY rs.shared_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION get_shared_with_me() FROM public;
GRANT EXECUTE ON FUNCTION get_shared_with_me() TO authenticated;
