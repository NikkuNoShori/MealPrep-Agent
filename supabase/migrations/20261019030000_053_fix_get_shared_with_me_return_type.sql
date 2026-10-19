-- Migration 053: Fix get_shared_with_me() return-type mismatch
--
-- Same bug class as search_recipes_text (fixed separately, applied directly
-- 2026-10-19 — recorded in the remote migration ledger as
-- 20261019021346_052c_reapply_search_recipes_text_cast, which has no local
-- file counterpart by design; that fix needed no schema file since it was a
-- one-statement CREATE OR REPLACE re-application after a failed `supabase
-- db push` rolled back an earlier manual fix within the same transaction).
--
-- get_shared_with_me() declares its `title` column as TEXT, but
-- recipes.title is actually VARCHAR — plpgsql enforces an exact type match
-- between RETURNS TABLE and the function body's actual output, so every
-- call failed with 42804 ("structure of query does not match function
-- result type"). This is why "Shared with me" showed a 400 error.
--
-- CREATE OR REPLACE cannot change a function's OUT-parameter types (fails
-- with 42P13) — confirmed live 2026-10-19 — so DROP FUNCTION is required
-- first, same pattern migration 050b used for search_recipes_text.

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
  sharer_display_name TEXT,
  sharer_username TEXT,
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
