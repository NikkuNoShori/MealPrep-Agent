# MOP Registry

> **Method of Procedure** — Tracks planned, in-progress, and completed improvement initiatives for the MealPrep Agent project.

**Last reviewed:** 2026-03-12
**Last updated:** 2026-03-12 (MOP-0002 status update to in-progress)

---

## Statuses

| Status | Meaning |
|--------|---------|
| `draft` | Idea captured, not yet scoped or approved |
| `planned` | Scoped and approved, ready for implementation |
| `completed` | All phases implemented and verified |
| `cancelled` | Abandoned — reason noted in the MOP |

---

## Registry

| MOP | Title | Status | Submitted | Updated | Completed | Submitted By |
|-----|-------|--------|-----------|---------|-----------|--------------|
| [MOP-0001](MOP-0001.md) | Recipe Pipeline Improvements (Images, Multi-Recipe, Quantities) | complete | 2026-03-11 | 2026-03-11 | 2026-03-11 | Nick Neal |
| [MOP-0002](MOP-0002.md) | Family Sharing, Recipe Permissions & Collections | in-progress | 2026-03-11 | 2026-03-12 | — | Nick Neal |
| [MOP-0003](MOP-0003.md) | Dietary Profiles & Allergen Detection | draft | 2026-03-12 | 2026-03-12 | — | Nick Neal |
| [MOP-0004](MOP-0004.md) | Meal Planner & Grocery Cart | draft | 2026-03-12 | 2026-03-12 | — | Nick Neal |

---

## How to Create a New MOP

1. Copy [MOP_TEMPLATE.md](MOP_TEMPLATE.md) to `MOP-XXXX.md` (next sequential number)
2. Fill in all header fields and scope of work
3. Add an entry to the registry table above
4. Set status to `draft` or `planned`

## How MOPs Get Updated

- MOPs are reviewed during every [Documentation Update Procedure](../prompts/DOCUMENTATION_UPDATE_PROCEDURE.md) execution
- When work is completed on a MOP phase, update the MOP and bump the registry `Updated` date
- When all phases are done, set status to `completed` and fill in the `Completed` date
