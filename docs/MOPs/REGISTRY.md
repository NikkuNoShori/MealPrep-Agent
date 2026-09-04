# MOP Registry

> **Method of Procedure** — Tracks planned, in-progress, and completed improvement initiatives for the MealPrep Agent project.

**Last reviewed:** 2026-06-16
**Last updated:** 2026-06-16 (MOP-0016 Phase 3b shipped; operator smoke pending `recipe-pipeline` deploy)

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
| [MOP-0004](MOP-0004.md) | Meal Planner & Grocery Cart | complete | 2026-03-12 | 2026-06-14 | 2026-06-14 | Nick Neal |
| [MOP-0005](MOP-0005.md) | Test Coverage & Testing Infrastructure | complete | 2026-03-14 | 2026-06-14 | 2026-06-14 | Nick Neal |
| [MOP-0006](MOP-0006.md) | Generated Supabase Types & API Typing | complete | 2026-05-08 | 2026-06-03 | 2026-06-03 | Nick Neal |
| [MOP-0007](MOP-0007.md) | Wire RAG into Recipes Page, Meal Planner Suggestions, Reactions as Ranking Signal | draft | 2026-06-01 | 2026-06-01 | — | Nick Neal |
| [MOP-0008](MOP-0008.md) | Chat: Intent Router → Tool-Using Single Agent | complete | 2026-06-01 | 2026-06-15 | 2026-06-15 | Nick Neal |
| [MOP-0009](MOP-0009.md) | Dev Automation Expansion (migration-rls-checker, scaffolders, runbook-recorder) | draft | 2026-06-01 | 2026-06-01 | — | Nick Neal |
| [MOP-0010](MOP-0010.md) | Lockticket MOP System (machine-verifiable acceptance criteria) | draft | 2026-06-01 | 2026-06-01 | — | Nick Neal |
| [MOP-0011](MOP-0011.md) | Normalize `meal_plans` JSONB → Child Tables | draft (deferred) | 2026-06-01 | 2026-06-01 | — | Nick Neal |
| [MOP-0012](MOP-0012.md) | Recipe-Pipeline Test Fixture Library | draft | 2026-06-01 | 2026-06-01 | — | Nick Neal |
| [MOP-0013](MOP-0013.md) | Playwright E2E Test Setup | draft | 2026-06-01 | 2026-06-01 | — | Nick Neal |
| [MOP-0014](MOP-0014-household-write-atomicity-rpcs.md) | Household Write Atomicity — `transferOwnership` & `respondToInvite` RPCs | draft | 2026-06-01 | 2026-06-01 | — | surface-reviewer |
| [MOP-0015](MOP-0015-embedding-refresh-lifecycle.md) | Embedding Refresh Lifecycle — fix stale embeddings from edited recipes | draft | 2026-06-04 | 2026-06-04 | — | chat-rag-sme audit |
| [MOP-0016](MOP-0016-short-form-video-intake.md) | Short-Form Video Recipe Intake (ToS-Compliant) | in_progress | 2026-06-15 | 2026-06-16 | — | Nick Neal |
| [MOP-0017](MOP-0017-streaming-chat-responses.md) | Streaming Chat Responses | approved | 2026-09-03 | 2026-09-03 | — | Nick Neal |

> **MOP-0016:** Phases 1–3b shipped 2026-06-16 (`chat-api` deployed). **Outstanding:** deploy `recipe-pipeline`, run §Operator smoke tests, then promote to `verifying`. MOP-0004 and MOP-0005 promoted from legacy `draft` → `in_progress` after status audit. Each MOP now carries a "Shipped as of" callout with explicit outstanding items. Promotion to `verifying`/`complete` is gated by the lockticket Verification block (MOP-0010).

> **MOP-0017:** Phase 1 (optimistic placeholder bubble) shipped 2026-09-03 in commit `dc8bf5d`. Phases 2–4 (true SSE streaming) approved and queued — implement when chat UX is next prioritized.

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
