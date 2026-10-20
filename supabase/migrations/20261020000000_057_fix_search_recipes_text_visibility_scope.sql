-- Migration 057: Widen search_recipes_text() to match RLS's SELECT visibility
--
-- search_recipes_text was hardcoded to WHERE r.user_id = v_caller, ignoring
-- recipe visibility entirely. The recipes table's own RLS SELECT policy
-- ("Users can view accessible recipes") already allows a caller to read:
--   - their own recipes,
--   - recipes with visibility = 'household' from any household they share
--     with the recipe's owner,
--   - recipes with visibility = 'public'.
-- Search was strictly narrower than what a user can otherwise already see
-- and open via direct link/browse, so two users in the same household (or
-- a user searching for a public recipe they don't own) got silently
-- different/empty results with no error -- confirmed live 2026-10-19:
-- a public recipe owned by one account was invisible to "breakfast" search
-- from a second account for exactly this reason.
--
-- NOT mirrored here: the RLS policy's fourth clause, which also grants
-- visibility through collection membership (a recipe is visible if it's in
-- any collection, public or household-visible, regardless of who owns that
-- collection). That clause has a known, separate, not-yet-fixed privacy
-- gap (tracked in the enhancement backlog, 2026-10-19 household-sme
-- finding: a recipe added to someone else's collection can stay exposed
-- even after the owner sets it back to private). Mirroring that clause
-- into search would only widen the surface of that bug, not fix it, so
-- search intentionally stays scoped to own/household/public only until
-- the collection-inheritance gap itself is fixed.
--
-- CREATE OR REPLACE is sufficient -- no RETURNS TABLE shape change, only
-- the WHERE clause changes.

CREATE OR REPLACE FUNCTION public.search_recipes_text(
  search_query text,
  user_uuid uuid,
  max_results integer DEFAULT 20
)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  title character varying,
  description text,
  ingredients jsonb,
  instructions jsonb,
  prep_time integer,
  cook_time integer,
  total_time integer,
  servings integer,
  difficulty character varying,
  cuisine character varying,
  tags text[],
  dietary_tags text[],
  image_url text,
  nutrition_info jsonb,
  source_url text,
  source_name character varying,
  is_favorite boolean,
  slug character varying,
  visibility text,
  searchable_text text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  rank_score double precision
)
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
    v_caller UUID := auth.uid();
BEGIN
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        r.id,
        r.user_id,
        r.title,
        r.description,
        r.ingredients,
        r.instructions,
        r.prep_time,
        r.cook_time,
        r.total_time,
        r.servings,
        r.difficulty,
        r.cuisine,
        r.tags,
        r.dietary_tags,
        r.image_url,
        r.nutrition_info,
        r.source_url,
        r.source_name,
        r.is_favorite,
        r.slug,
        r.visibility,
        r.searchable_text,
        r.created_at,
        r.updated_at,
        ts_rank(
            to_tsvector('english', COALESCE(r.searchable_text, '')),
            plainto_tsquery('english', search_query)
        )::DOUBLE PRECISION AS rank_score
    FROM recipes r
    WHERE (
            r.user_id = v_caller
            OR (
                r.visibility = 'household'
                AND EXISTS (
                    SELECT 1 FROM household_members hm
                    WHERE hm.user_id = r.user_id
                    AND is_household_member(hm.household_id, v_caller)
                )
            )
            OR r.visibility = 'public'
        )
        AND to_tsvector('english', COALESCE(r.searchable_text, ''))
            @@ plainto_tsquery('english', search_query)
    ORDER BY rank_score DESC
    LIMIT max_results;
END;
$function$;
