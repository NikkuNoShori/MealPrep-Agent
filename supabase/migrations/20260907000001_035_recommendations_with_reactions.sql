-- ============================================================================
-- Migration 035: get_recipe_recommendations — add reaction signal to scoring
-- ============================================================================
-- MOP-0007 Phase 3
--
-- Updates the recommendation scoring formula to include a 5th term derived
-- from recipe_reactions. Previously: 4-term score / 4.0. Now: 5-term / 5.0.
--
-- Reaction scoring per recipe:
--   thumbs_up   = +1.0  (positive signal)
--   thumbs_down = -0.7  (asymmetric: one dislike doesn't bury the recipe)
--   no reaction =  0.0
--   Net signal is averaged across all reactions, then scaled to [0, 1]
--   via: LEAST(GREATEST((net + 1.0) / 2.0, 0.0), 1.0)
--
-- HARD RULE: authored locally — Nick deploys.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_recipe_recommendations(
    user_id UUID,               -- VESTIGIAL: ignored; auth.uid() is the source of truth
    preference_difficulty VARCHAR(20) DEFAULT NULL,
    preference_tags TEXT[] DEFAULT NULL,
    max_prep_time_minutes INT DEFAULT NULL,
    limit_count INT DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    title VARCHAR(255),
    description TEXT,
    ingredients JSONB,
    instructions JSONB,
    prep_time INTEGER,
    cook_time INTEGER,
    servings INTEGER,
    difficulty VARCHAR(20),
    tags TEXT[],
    image_url TEXT,
    source_url TEXT,
    rating DECIMAL(3,2),
    is_public BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    searchable_text TEXT,
    recommendation_score FLOAT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
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
        r.is_public,
        r.created_at,
        r.updated_at,
        r.searchable_text,
        -- 5-term score, each term ∈ [0, 1], averaged to keep total ∈ [0, 1]
        (
            -- Term 1: difficulty match
            CASE WHEN preference_difficulty IS NULL OR r.difficulty = preference_difficulty
                 THEN 1.0 ELSE 0.5 END

            -- Term 2: tag overlap
            + CASE WHEN preference_tags IS NULL OR r.tags && preference_tags
                   THEN 1.0 ELSE 0.5 END

            -- Term 3: rating (0–5 scaled to 0–1; no rating = neutral 0.5)
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
            -- No reactions → 0.5 (neutral).
            + COALESCE((
                SELECT LEAST(GREATEST(
                    (AVG(
                        CASE rr.reaction_type
                            WHEN 'thumbs_up'   THEN  1.0
                            WHEN 'thumbs_down' THEN -0.7
                            ELSE 0.0
                        END
                    ) + 1.0) / 2.0,
                0.0), 1.0)
                FROM recipe_reactions rr
                WHERE rr.recipe_id = r.id
            ), 0.5)
        ) / 5.0 AS recommendation_score
    FROM recipes r
    WHERE r.user_id = v_caller
        AND (preference_difficulty IS NULL OR r.difficulty = preference_difficulty)
        AND (preference_tags IS NULL OR r.tags && preference_tags)
        AND (max_prep_time_minutes IS NULL OR r.prep_time IS NULL OR r.prep_time <= max_prep_time_minutes)
    ORDER BY recommendation_score DESC, r.created_at DESC
    LIMIT limit_count;
END;
$$;

-- Privileges unchanged from migration 028
REVOKE ALL ON FUNCTION get_recipe_recommendations(UUID, VARCHAR(20), TEXT[], INT, INT) FROM public;
GRANT EXECUTE ON FUNCTION get_recipe_recommendations(UUID, VARCHAR(20), TEXT[], INT, INT) TO authenticated;
