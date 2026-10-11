# MOP-0032 QoL Batch 1 — 2026-10-11

## Summary
Two sessions (late Sep / early Oct 2026) implemented all 9 phases of MOP-0032
(QoL Backlog Batch 1): extraction normalization, chat save fixes, recipe search
fix, recipes page UX, meal planner improvements, and grocery list additions.
The MOP is fully implemented but not yet formally closed — status is still
`draft` in the registry.

## What changed (committed)

- `fc61c7f` — `feat(MOP-0032)`: All 9 phases in one commit — extraction
  normalization, post-save recipe link, XML re-render fix, search backfill
  migration, recipe card/filter UX, slot lock, titles view, grocery toggle +
  "Already have it", default visibility setting. 26 files, +709/-73.
- `15def89` — `fix`: Migration 049 — `search_recipes_text` RPC rewritten to
  return full recipe row (prior migration 028 returned only 6 columns, causing
  blank cards in My Recipes search).
- `95c992a` — `fix`: Migration 049 amended — added `DROP FUNCTION IF EXISTS`
  before `CREATE FUNCTION` because PostgreSQL rejects `CREATE OR REPLACE` when
  `RETURNS TABLE` shape changes (SQLSTATE 42P13).
- `87d7bec` — `fix(chat-api)`: Removed `created_by: ctx.user.id` from
  `save_recipe` insert payload — the `recipes` table has no `created_by`
  column (only `user_id`). This was the root cause of the P0 save error
  "unable to associate with your account."

## Uncommitted / in-flight

As of 2026-10-11, `git status` shows a large set of modified files that are
**not** from MOP-0032 — they appear to be from prior or concurrent work (MOP-0029
color token refactor, MOP-0034/0035 extraction accuracy). None of these are the
current session's changes. The current session only touched
`supabase/functions/chat-api/tools/handlers.ts` (committed as `87d7bec`).

Untracked files that may need attention:
- `docs/DECISIONS/ADR-0007-extraction-absence-and-provenance-semantics.md` — new ADR, unregistered
- `docs/MOPs/MOP-0034-screenshot-extraction-accuracy.md` — new MOP, needs registry entry
- `docs/MOPs/MOP-0035-extraction-requirements-spec.md` — new MOP, needs registry entry
- `scripts/check-color-governance.js` — likely MOP-0029 artifact
- `.color-baseline.json` — likely MOP-0029 artifact

Modified but uncommitted (pre-existing, not from this session):
- `docs/MOPs/MOP-0032-qol-backlog-batch-1.md` — status field still `draft`;
  needs update to `complete` as part of MOP closure
- `docs/MOPs/MOP-0012.md` — modified, unknown what changed
- `docs/prompts/DOCUMENTATION_UPDATE_PROCEDURE.md` — modified
- Various source files (`ChatInterface.tsx`, `GroceryCart.tsx`, `RecipeList.tsx`,
  `themeStore.ts`, `Admin.tsx`, `InviteAccept.tsx`, `index.css`,
  `openrouter-client.ts`, `dispatch.ts`, `text-adapter.ts`, `extract.ts`,
  `extract_test.ts`, `index.ts` in chat-api) — likely MOP-0029 or MOP-0034
  work in progress. **Do not commit these without understanding what they are.**

## Decisions and reasoning

**`amount` type change (string|number|null)**: The `Ingredient.amount` field
lives in `recipes.ingredients JSONB`, not a dedicated DB column, so the type
change required no migration — only TypeScript interface updates and consumer
call sites. All numeric comparisons were updated to use `Number(amount)` or
`parseFloat(String(amount ?? 0))`.

**`COUNTABLE_UNITS` set (piece/pieces only)**: Initial implementation included
`stalk` and `stalks` in the set, which would have stripped the unit from
"1 stalk celery." User corrected: stalk/head/ear/clove/sprig are valid culinary
units. The set was narrowed to only `piece`/`pieces`. Prompt rule updated
accordingly.

**Save error root cause (Phase 3 P0)**: The error string "unable to associate
with your account" doesn't exist anywhere in the codebase — it was the LLM
paraphrasing a Postgres INSERT error. The cause was `created_by: ctx.user.id`
in the `save_recipe` `insertRow` object in `handlers.ts`. The `recipes` table
only has `user_id`; Supabase rejected the unknown column.

**Migration 049 `DROP` before `CREATE`**: PostgreSQL SQLSTATE 42P13 — `CREATE
OR REPLACE FUNCTION` cannot change a function's `RETURNS TABLE` shape. Fixed
by prepending `DROP FUNCTION IF EXISTS search_recipes_text(TEXT, UUID, INTEGER)`
to the migration.

**`INGREDIENT_NAME_MAP` acknowledged as fragile**: User raised this directly.
The map is a "seed" of common abbreviations (feta, evoo, parm). The better
long-term solution is prompt-first normalization (the model is already
instructed to use full names via `RECIPE_FIELD_RULES`). The map exists as a
post-parse safety net only.

## Known issues / things that look wrong but aren't (or are)

**Branch is 36 commits ahead of origin/main.** The local `main` has diverged
significantly. User has not pushed. This is expected — user manages their own
deployments and pushes.

**MOP-0032 status is `draft`.** The MOP was fully implemented and committed but
the status field in `docs/MOPs/MOP-0032-qol-backlog-batch-1.md` was never
updated to `complete`. The registry also still shows `draft`. This is not a
code problem but it means `/verify-mop` and `/update-docs` still need to run.

**MOP-0029 work appears partially uncommitted.** Multiple source files show as
modified in `git status` from what appears to be the color token refactor
(MOP-0029). The commit history shows MOP-0029 batches ending at Phase 7 batch 4
(`83c8b40`). The uncommitted files may be Phase 8/9 in-progress work.

**`extract_test.ts` is modified.** The extraction test file has uncommitted
changes. Unknown whether these are passing or failing.

## Open questions for the user

1. **Migrations 047 and 048 deployed?** Migration 049 was confirmed deployed
   last session. Migrations 047 (backfill `searchable_text`) and 048
   (`default_recipe_visibility` column on `profiles`) — have these been run?
   The Settings UI "Recipe Defaults" section and the default visibility logic
   in the edge functions both depend on 048 being deployed.

2. **MOP-0029 uncommitted work** — The modified files (`themeStore.ts`,
   `Admin.tsx`, `InviteAccept.tsx`, `index.css`, `openrouter-client.ts`,
   `dispatch.ts`, `text-adapter.ts`, `extract.ts`, `extract_test.ts`) appear
   to be MOP-0029 Phase 8/9 work. Are these intentionally in-progress, or
   should they be committed/discarded?

3. **ADR-0007, MOP-0034, MOP-0035** are untracked. Do you want these committed
   and registered, or are they drafts you're still working on?

## Suggested next steps

1. Answer the open questions above (migrations deployed? MOP-0029 status?).
2. Run `/verify-mop MOP-0032` to mechanically check the verification block.
3. Run `/update-docs` to flip MOP-0032 to `complete`, write CHANGELOG entry,
   update registry.
4. Investigate the uncommitted MOP-0029 files — understand what phase they
   represent and either commit or discard.
5. Register ADR-0007, MOP-0034, MOP-0035 in the registry if they're ready.
