# MOP Status Lifecycle

**Purpose:** Defines the standard statuses for Method of Procedure (MOP) documents and the transitions between them. This is the single source of truth for MOP status values.

**Publisher:** Nick Neal
**Created:** 2026-06-01

---

## Status Definitions

| Status | Meaning | Who sets it | Next transition |
|--------|---------|-------------|-----------------|
| **draft** | MOP written, not yet reviewed for feasibility | Author | → evaluation, planned, or cancelled |
| **evaluation** | Actively investigating feasibility, cost, or approach | Author / reviewer | → approved, deferred, or cancelled |
| **approved** | Evaluation passed. Feasible and green-lit, but not yet scheduled for a sprint | Reviewer / owner | → planned or deferred |
| **planned** | Scheduled for upcoming work (assigned to a sprint or milestone) | Project lead | → in_progress |
| **in_progress** | Actively being built | Developer | → verifying or complete |
| **verifying** | All implementation done; running the `## Verification` block (lockticket MOP-0010) | Developer | → complete or blocked |
| **complete** | Code shipped and merged. Triggers `/update-docs` procedure | Developer | (terminal) |
| **blocked** | Verification failed; needs work to pass | Developer | → in_progress (after fix) |
| **cancelled** | Will not be done. Must include a reason | Project lead | (terminal) |
| **deferred** | Feasible but deprioritized indefinitely. Not cancelled — may revisit | Project lead | → planned (when reprioritized) |

---

## Lifecycle Diagram

```
draft → evaluation → approved → planned → in_progress → verifying → complete
  │         │            │         │                       │
  │         ├→ cancelled  ├→ deferred                     ├→ blocked → in_progress
  │         └→ deferred   └→ cancelled
  ├→ planned (skip eval for obvious work)
  └→ cancelled
```

---

## Rules

1. **Every MOP must have exactly one status** from the table above. No other status values are valid.
2. **evaluation → approved** means "the evaluation concluded that this is feasible and worth doing." It does NOT mean the work is scheduled.
3. **approved → planned** means "this is assigned to a specific sprint, milestone, or time window."
4. **verifying** is the lockticket gate. A MOP cannot transition `verifying → complete` until every assertion in its `## Verification` block passes. The `/verify-mop` skill (MOP-0010) enforces this.
5. **complete triggers documentation**: When a MOP status changes to complete, the `/update-docs` skill MUST be invoked before the session ends.
6. **cancelled and deferred require a reason**: Add a `> **Reason:**` blockquote below the status line explaining why.
7. **deferred is not cancelled**: Deferred MOPs are expected to be revisited. Cancelled MOPs are permanently closed.
8. **Deferred-with-trigger MOPs** (e.g., MOP-0011) must include trigger conditions in their body. Status stays `deferred` until a trigger fires; then promotes to `planned`.

---

## Status in MOP Header

```markdown
**Status:** approved
```

For cancelled or deferred, add a reason:

```markdown
**Status:** deferred

> **Reason:** Low priority relative to Q3 2026 roadmap. Revisit when MOP-0007 implementation hits JSONB query friction.
```

---

## Backwards compatibility (existing MealPrep MOPs)

Existing MOPs (MOP-0001 through MOP-0011 as of 2026-06-01) were authored under a simpler 4-status vocabulary: `draft`, `planned`, `completed`, `cancelled`. They map to the new vocabulary as follows:

| Legacy status | New status |
|---|---|
| `draft` | `draft` |
| `planned` | `planned` |
| `completed` | `complete` |
| `cancelled` | `cancelled` |

**Migration policy:** existing MOPs are not bulk-migrated. They keep their current status string until the next time the MOP is touched, at which point the status string is updated to the new vocabulary. `/update-registry` reports drift but does not auto-migrate.

New MOPs (created via `/new-mop` after 2026-06-01) must use the lifecycle vocabulary defined here.

---

## Applying to Evaluation MOPs

Evaluation MOPs follow this pattern:

1. **evaluation** — actively investigating (reading code, testing feasibility)
2. **approved** — evaluation concluded positively, work is green-lit but not scheduled
3. **planned** — work is assigned to a sprint

An evaluation that concludes negatively should be **cancelled** (not feasible) or **deferred** (feasible but not worth doing now).

---

## Relationship to ADRs

If an evaluation MOP results in a non-trivial decision, write an ADR alongside (or before) flipping the MOP to `approved`. The MOP captures the *plan*; the ADR captures the *reasoning*. See `ADR_AUTHORING_GUIDE.md` for ADR format.
