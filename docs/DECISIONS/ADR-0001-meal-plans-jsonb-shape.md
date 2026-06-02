# ADR-0001: `meal_plans` Stores Meals + Grocery List as JSONB

**Status:** accepted
**Created:** 2026-06-01
**Author:** Nick Neal
**Last reviewed:** 2026-06-01
**Related MOP:** MOP-0011 (deferred — trigger-conditioned normalization)

## Context

The `meal_plans` table (introduced in migration `20251201000000_001_core_schema.sql:136`) stores one row per plan with two large JSONB columns:

- `meals` — keyed by date string with sub-keys per slot (`breakfast` / `lunch` / `dinner` / `snack`) pointing at `recipe_id`
- `grocery_list` — array of item objects with `{ item, amount, unit, category, source }` shape

The MOP-0008 (chat tool-use migration) design surfaced that this shape is materially different from the implicit assumption many tool catalogs and audit-style features make — that meal-plan entries are row-shaped with foreign keys to `recipes`. The cooking-bot-architect's first invocation caught this mismatch when drafting `assign_recipe_to_meal_plan_slot` and `add_to_grocery_list` tool handlers.

Today's shape:
- **Pro:** plan documents load whole in one query; UI shape matches storage shape; migration was simpler in 2025-12.
- **Con:** no FK from JSONB `recipe_id` to `recipes.id` (dangling references possible); concurrent edits are last-write-wins on the whole row; aggregate queries ("household chicken frequency this quarter", "% of slots filled") require expensive JSONB unnest; per-slot RLS is not expressible — only row-level.

## Decision

**Accept JSONB as the current shape.** Do not normalize pre-emptively.

Specifically:
1. New code (including MOP-0008's tool handlers) targets the JSONB shape with explicit read-modify-write patterns.
2. Designs that assume normalized child tables must be revised to JSONB shape before implementation. (Tool catalog validation is captured as an anti-pattern in `cooking-bot-knowledge/architecture-patterns.md`.)
3. Cross-cutting drift: the cooking-bot KB's `mealprep-context.md` documents the JSONB shape and links to this ADR + MOP-0011.

**The decision is conditional.** Trigger conditions for revisiting are defined in MOP-0011 (deferred). When any trigger fires, MOP-0011 promotes from `deferred` to `planned` and executes the migration to normalized child tables.

## Consequences

### Positive

- Zero migration cost today. Existing UI, `api.ts` methods (lines 379–526), and MOP-0008's tool handlers all target the same shape.
- Reads are single-row — no JOINs to assemble a week view.
- Document semantics ("save a plan") fit JSONB naturally.

### Negative

- Concurrent household edits silently lose data (last-write-wins on the row). Acceptable today because most plans are single-editor.
- No FK integrity from `recipe_id` references inside JSONB. A deleted recipe can leave dangling references; UI must handle this on read.
- Analytics features (recipe history scoring, household chicken-frequency queries, suggestion engines) require JSONB unnest gymnastics. Costs grow superlinearly with usage history.
- Per-slot RLS is not expressible. The unit of access control is the whole `meal_plans` row.
- Schema-mismatch surprise for designers of new features. Mitigated by KB note + this ADR; not eliminated.

## Alternatives considered

1. **Normalize now (proactive).** Create `meal_plan_entries` and `grocery_list_items` tables with FKs to `recipes` and per-row RLS. *Rejected:* the cost (migration + dual-write + UI rewrites + chat-api tool handler rewrites + retests) is paid today against benefits not yet measured. Premature normalization.
2. **Partial normalization** (e.g., normalize `grocery_list` but keep `meals` JSONB). *Rejected:* hybrid mental models for closely-related data — the worst of both worlds.
3. **Read-side view layer** (materialized view or function returning normalized shape from JSONB). *Rejected:* adds maintenance surface without solving the write-side problems (concurrent edits, FK integrity).

## Trigger for revisit

Defined in detail in MOP-0011 §Trigger Conditions. Summary:
- MOP-0007 query friction (semantic-search / recommendations against history want row-shape)
- Concurrent household editing reported as lost-write incidents
- Dangling `recipe_id` causing render errors or RAG misses
- Analytics requirement crossing JSONB query cost threshold
- MOP-0008 tool friction (race conditions on read-modify-write)

If 12 months pass with no trigger firing, MOP-0011 is `cancelled` and this ADR is reviewed for `accepted` → re-affirmed.

## Related

- **MOP:** [MOP-0011](../MOPs/MOP-0011.md) — deferred normalization plan
- **MOP:** [MOP-0008](../MOPs/MOP-0008.md) — chat tool-use migration, where the shape mismatch was caught
- **KB:** [`.claude/agents/cooking-bot-knowledge/mealprep-context.md`](../../.claude/agents/cooking-bot-knowledge/mealprep-context.md) — schema documentation
- **KB:** [`.claude/agents/cooking-bot-knowledge/architecture-patterns.md`](../../.claude/agents/cooking-bot-knowledge/architecture-patterns.md) — "tool catalogs based on assumed schema" anti-pattern
- **Files impacted:** `src/services/api.ts:379–526` (meal-plan methods), `src/pages/MealPlanner.tsx`, `src/utils/ingredientAggregator.ts`, `supabase/functions/chat-api/tools/handlers.ts` (planned)
- **Migration:** `supabase/migrations/20251201000000_001_core_schema.sql:136`
