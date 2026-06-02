# MOP Registry

> **Method of Procedure** — Tracks planned, in-progress, and completed improvement initiatives for the MealPrep Agent project.

**Last reviewed:** 2026-06-01
**Last updated:** 2026-06-01 (MOP-0014 drafted by surface-reviewer from MOP-0005 Phase 1 round-1 findings; AI Integration Audit; MOP-0007/0008/0009/0010/0011/0012/0013 drafted; status vocabulary migrated to MOP_STATUS_LIFECYCLE; ADR-0001/0002/0003 created; MOP-0004/0005 promoted draft → in_progress; frontend OpenRouter client deleted)

---

## Statuses

> Source of truth: [docs/prompts/MOP_STATUS_LIFECYCLE.md](../prompts/MOP_STATUS_LIFECYCLE.md). The table below is a quick-reference summary.

| Status | Meaning |
|--------|---------|
| `draft` | MOP written, not yet reviewed for feasibility |
| `evaluation` | Actively investigating feasibility, cost, or approach |
| `approved` | Evaluation passed — feasible and green-lit, not yet scheduled |
| `planned` | Scheduled for upcoming work (sprint/milestone assignment) |
| `in_progress` | Actively being built |
| `verifying` | Implementation done; `/verify-mop` running the Verification block |
| `complete` | Code shipped, merged, and verified. Triggers `/update-docs` |
| `blocked` | Verification failed; back to `in_progress` after fix |
| `cancelled` | Will not be done (must include `> Reason:`) |
| `deferred` | Feasible but deprioritized (must include `> Reason:`; may include trigger conditions for revisit) |

> **Backwards compatibility:** Existing MOPs (MOP-0001 through MOP-0011 as of 2026-06-01) were authored under a simpler 4-status vocabulary (`draft` / `planned` / `completed` / `cancelled`). They keep their legacy strings until the next status change, at which point they migrate to the lifecycle vocabulary above. `/update-registry` reports drift but does not auto-migrate. The `completed` → `complete` mapping is the only string change.

---

## Registry

| MOP | Title | Status | Submitted | Updated | Completed | Submitted By |
|-----|-------|--------|-----------|---------|-----------|--------------|
| [MOP-0001](MOP-0001.md) | Recipe Pipeline Improvements (Images, Multi-Recipe, Quantities) | complete | 2026-03-11 | 2026-03-11 | 2026-03-11 | Nick Neal |
| [MOP-0002](MOP-0002.md) | Family Sharing, Recipe Permissions & Collections | complete | 2026-03-11 | 2026-03-14 | 2026-03-14 | Nick Neal |
| [MOP-0003](MOP-0003.md) | Dietary Profiles & Allergen Detection | draft | 2026-03-12 | 2026-03-12 | — | Nick Neal |
| [MOP-0004](MOP-0004.md) | Meal Planner & Grocery Cart | in_progress | 2026-03-12 | 2026-06-01 | — | Nick Neal |
| [MOP-0005](MOP-0005.md) | Test Coverage & Testing Infrastructure | in_progress | 2026-03-14 | 2026-06-01 | — | Nick Neal |
| [MOP-0006](MOP-0006.md) | Generated Supabase Types & API Typing | draft | 2026-05-08 | 2026-05-08 | — | Nick Neal |
| [MOP-0007](MOP-0007.md) | Wire RAG into Recipes Page, Meal Planner Suggestions, Reactions as Ranking Signal | draft | 2026-06-01 | 2026-06-01 | — | Nick Neal |
| [MOP-0008](MOP-0008.md) | Chat: Intent Router → Tool-Using Single Agent | draft | 2026-06-01 | 2026-06-01 (Addendum 1) | — | Nick Neal |
| [MOP-0009](MOP-0009.md) | Dev Automation Expansion (migration-rls-checker, scaffolders, runbook-recorder) | draft | 2026-06-01 | 2026-06-01 | — | Nick Neal |
| [MOP-0010](MOP-0010.md) | Lockticket MOP System (machine-verifiable acceptance criteria) | draft | 2026-06-01 | 2026-06-01 | — | Nick Neal |
| [MOP-0011](MOP-0011.md) | Normalize `meal_plans` JSONB → Child Tables | draft (deferred) | 2026-06-01 | 2026-06-01 | — | Nick Neal |
| [MOP-0012](MOP-0012.md) | Recipe-Pipeline Test Fixture Library | draft | 2026-06-01 | 2026-06-01 | — | Nick Neal |
| [MOP-0013](MOP-0013.md) | Playwright E2E Test Setup | draft | 2026-06-01 | 2026-06-01 | — | Nick Neal |
| [MOP-0014](MOP-0014-household-write-atomicity-rpcs.md) | Household Write Atomicity — `transferOwnership` & `respondToInvite` RPCs | draft | 2026-06-01 | 2026-06-01 | — | surface-reviewer |

> **Registry drift resolved (2026-06-01):** MOP-0004 and MOP-0005 promoted from legacy `draft` → `in_progress` after status audit. Each MOP now carries a "Shipped as of" callout with explicit outstanding items. Promotion to `verifying`/`complete` is gated by the lockticket Verification block (MOP-0010).

> **Deferred-with-trigger MOPs:** MOP-0011 is in `draft` but explicitly deferred — execute only when a documented trigger condition fires (see MOP-0011 §Trigger Conditions). This is a new MOP pattern; if more deferred MOPs accumulate, codify the pattern in MOP_TEMPLATE.md.

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
