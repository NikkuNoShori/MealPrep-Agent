-- Migration 017: Recipe Reactions (family thumbs up/down per recipe)
-- ============================================================================
-- Allows household members and dependents to react to recipes with
-- thumbs_up or thumbs_down. Reactions are displayed on recipe cards
-- so the household can see who likes/dislikes each recipe at a glance.
-- ============================================================================

-- 1. Create the recipe_reactions table
CREATE TABLE IF NOT EXISTS recipe_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    -- Exactly one of user_id or family_member_id must be set
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    family_member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
    reaction VARCHAR(20) NOT NULL CHECK (reaction IN ('thumbs_up', 'thumbs_down')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Each person can have only one reaction per recipe
    CONSTRAINT uq_reaction_user UNIQUE (recipe_id, user_id),
    CONSTRAINT uq_reaction_family_member UNIQUE (recipe_id, family_member_id),
    -- At least one identifier must be present
    CONSTRAINT chk_has_reactor CHECK (user_id IS NOT NULL OR family_member_id IS NOT NULL)
);

-- 2. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_recipe_reactions_recipe ON recipe_reactions(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_reactions_user ON recipe_reactions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recipe_reactions_family ON recipe_reactions(family_member_id) WHERE family_member_id IS NOT NULL;

-- 3. Enable RLS
ALTER TABLE recipe_reactions ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies — household members can manage reactions for their household
CREATE POLICY "Users can view reactions for accessible recipes" ON recipe_reactions
    FOR SELECT USING (
        -- Can see reactions on own recipes
        EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid())
        OR
        -- Can see reactions by household members in same household
        EXISTS (
            SELECT 1 FROM household_members hm1
            JOIN household_members hm2 ON hm1.household_id = hm2.household_id
            WHERE hm1.user_id = auth.uid()
            AND (
                hm2.user_id = recipe_reactions.user_id
                OR EXISTS (
                    SELECT 1 FROM family_members fm
                    WHERE fm.id = recipe_reactions.family_member_id
                    AND fm.household_id = hm1.household_id
                )
            )
        )
        OR
        -- Can see reactions on public recipes
        EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND r.visibility = 'public')
    );

CREATE POLICY "Users can insert own reactions" ON recipe_reactions
    FOR INSERT WITH CHECK (
        -- User reacting for themselves
        (user_id = auth.uid() AND family_member_id IS NULL)
        OR
        -- User reacting on behalf of a dependent they manage
        (family_member_id IS NOT NULL AND user_id IS NULL AND EXISTS (
            SELECT 1 FROM family_members fm
            WHERE fm.id = family_member_id
            AND fm.managed_by = auth.uid()
            AND fm.is_active = true
        ))
    );

CREATE POLICY "Users can update own reactions" ON recipe_reactions
    FOR UPDATE USING (
        (user_id = auth.uid())
        OR
        (family_member_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM family_members fm
            WHERE fm.id = family_member_id
            AND fm.managed_by = auth.uid()
        ))
    );

CREATE POLICY "Users can delete own reactions" ON recipe_reactions
    FOR DELETE USING (
        (user_id = auth.uid())
        OR
        (family_member_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM family_members fm
            WHERE fm.id = family_member_id
            AND fm.managed_by = auth.uid()
        ))
    );
