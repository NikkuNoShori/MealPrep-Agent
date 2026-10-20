-- Migration 056: Fix get_recipe_recommendations() -- recommendation_score type mismatch
--
-- Migration 055 fixed the rr.reaction_type -> rr.reaction column bug, but
-- `supabase db push` already recorded 055 as applied by the time a second
-- bug was found in the SAME function, so editing 055's file after the fact
-- had no effect (the CLI ledger tracks by version, not content hash). This
-- migration carries the follow-up fix as its own file.
--
-- recommendation_score is declared DOUBLE PRECISION, but the 5-term sum
-- divides by 5.0 using r.rating (NUMERIC), so the whole expression
-- resolves to NUMERIC -- plpgsql's RETURNS TABLE enforces an exact type
-- match, so every call failed with 42804 ("Returned type numeric does not
-- match expected type double precision in column 18"), confirmed live
-- 2026-10-19. Fix: cast the full averaged expression to DOUBLE PRECISION.
--
-- CREATE OR REPLACE is sufficient -- no RETURNS TABLE shape change.

CREATE OR REPLACE FUNCTION public.get_recipe_recommendations(
  user_id UUID,
  preference_difficulty VARCHAR DEFAULT NULL,
  preference_tags TEXT[] DEFAULT NULL,
  max_prep_time_minutes INTEGER DEFAULT NULL,
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE(
  id UUID,
  title VARCHAR,
  description TEXT,
  ingredients JSONB,
  instructions JSONB,
  prep_time INTEGER,
  cook_time INTEGER,
  servings INTEGER,
  difficulty VARCHAR,
  tags TEXT[],
  image_url TEXT,
  source_url TEXT,
  rating NUMERIC,
  visibility TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  searchable_text TEXT,
  recommendation_score DOUBLE PRECISION
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
        r.title,
        r.description,
        r.ingredients,
        r.instructions,
        r.prep_time,
        r.cook_time,
        r.servings,
        r.difficulty,
        r.tags,
        r.image_url,
        r.source_url,
        r.rating,
        r.visibility,
        r.created_at,
        r.updated_at,
        r.searchable_text,
        -- 5-term score, each term ∈ [0, 1], averaged to keep total ∈ [0, 1]
        -- Cast to DOUBLE PRECISION: r.rating is NUMERIC, so the raw sum/5.0
        -- expression resolves to NUMERIC, which fails RETURNS TABLE's
        -- strict type check against recommendation_score DOUBLE PRECISION.
        ((
            -- Term 1: difficulty match
            CASE WHEN preference_difficulty IS NULL OR r.difficulty = preference_difficulty
                 THEN 1.0 ELSE 0.5 END

            -- Term 2: tag overlap
            + CASE WHEN preference_tags IS NULL OR r.tags && preference_tags
                   THEN 1.0 ELSE 0.5 END

            -- Term 3: rating (0-5 scaled to 0-1; no rating = neutral 0.5)
            + CASE WHEN r.rating IS NOT NULL THEN r.rating / 5.0 ELSE 0.5 END

            -- Term 4: prep time fit
            + CASE WHEN (max_prep_time_minutes IS NULL
                         OR r.prep_time IS NULL
                         OR r.prep_time <= max_prep_time_minutes)
                   THEN 1.0 ELSE 0.3 END

            -- Term 5: reaction signal
            -- thumbs_up = +1.0, thumbs_down = -0.7, none = 0
            -- Net signal averaged across all reactions on this recipe,
            -- then mapped from [-1, 1] to [0, 1] with a clamp.
            -- No reactions -> 0.5 (neutral).
            + COALESCE((
                SELECT LEAST(GREATEST(
                    (AVG(
                        CASE rr.reaction
                            WHEN 'thumbs_up'   THEN  1.0
                            WHEN 'thumbs_down' THEN -0.7
                            ELSE 0.0
                        END
                    ) + 1.0) / 2.0,
                0.0), 1.0)
                FROM recipe_reactions rr
                WHERE rr.recipe_id = r.id
            ), 0.5)
        ) / 5.0)::DOUBLE PRECISION AS recommendation_score
    FROM recipes r
    WHERE r.user_id = v_caller
        AND (preference_difficulty IS NULL OR r.difficulty = preference_difficulty)
        AND (preference_tags IS NULL OR r.tags && preference_tags)
        AND (max_prep_time_minutes IS NULL OR r.prep_time IS NULL OR r.prep_time <= max_prep_time_minutes)
    ORDER BY recommendation_score DESC, r.created_at DESC
    LIMIT limit_count;
END;
$function$;
