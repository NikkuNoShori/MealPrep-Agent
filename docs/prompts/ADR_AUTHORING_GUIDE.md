# ADR Authoring Guide

**Purpose:** Instructions for creating Architecture Decision Records (ADRs) in this repository. ADRs capture the reasoning behind significant architectural or design decisions so future contributors understand *why* something was built a certain way.

**Publisher:** Nick Neal
**Last updated:** 2026-06-01

---

## When to write an ADR

Write an ADR when a decision:

- Introduces a **new architectural pattern** or departs from an existing one
- Affects **multiple components or subsystems** (not a single-file tweak)
- Involves a **trade-off** that future developers might question or revisit
- Standardizes a **convention** across the codebase (styling rules, naming, API patterns)
- Is **hard to reverse** once implemented

You do **not** need an ADR for:
- Bug fixes or routine refactors that don't change architecture
- Dependency version bumps (unless they force an architectural change)
- Changes already fully described in a MOP (though an ADR may *reference* a MOP)

---

## File naming

Place ADRs in `docs/DECISIONS/`.

Format: `ADR-NNNN-short-kebab-description.md`

- **NNNN** — zero-padded sequential number. Check the highest existing number and increment by 1.
- **short-kebab-description** — 3-6 words summarizing the decision (not the problem).

Examples:
- `ADR-0001-meal-plans-jsonb-shape.md`
- `ADR-0002-edge-functions-only-for-ai.md`

---

## Template

```markdown
# ADR-NNNN: Title of Decision

**Status:** proposed | accepted | superseded | deprecated
**Created:** YYYY-MM-DD
**Author:** Nick Neal
**Last reviewed:** YYYY-MM-DD
**Related MOP:** MOP-NNNN (optional)

## Context

Describe the problem or situation that motivated this decision.
- What is the current state?
- What constraints exist (technical, organizational, compliance)?
- What specific pain points or risks were identified?

Include tables, code snippets, or file lists if they clarify the scope.

## Decision

State the decision clearly and specifically.
- What pattern, convention, or implementation approach was chosen?
- Include concrete details: class names, file paths, API shapes, configuration values.
- If the decision has multiple parts, use numbered sub-sections.

## Consequences

### Positive
- Benefits gained from this decision

### Negative
- Trade-offs accepted, known limitations, or risks to monitor

## Alternatives considered

Brief description of options that were evaluated and why they were rejected.

## Trigger for revisit (optional)

If this decision is deferred or accepted-with-conditions, list the conditions under which it should be revisited. This is how MealPrep's "deferred MOP" pattern (e.g., MOP-0011) is captured at the decision level — the ADR documents the choice, the linked MOP carries the trigger-conditioned future work.

## Related

- **MOP:** MOP-NNNN (if implementation is tracked by a MOP)
- **ADR:** ADR-NNNN (if this supersedes or extends another ADR)
- **Files impacted:** list key files if helpful for discoverability
```

---

## Field reference

| Field | Required | Notes |
|-------|----------|-------|
| **Status** | Yes | `proposed` → under discussion; `accepted` → approved and implemented; `superseded` → replaced by a newer ADR (link it); `deprecated` → no longer applicable |
| **Created** | Yes | Date the ADR was first written |
| **Author** | Yes | Person who authored the ADR. Default: **Nick Neal** |
| **Last reviewed** | Yes | Update each time the ADR is re-read during a doc audit |
| **Related MOP** | Optional | Link to the implementation MOP if one exists |
| **Context** | Yes | Must explain *why* a decision was needed |
| **Decision** | Yes | Must be specific enough to implement from |
| **Consequences** | Yes | Split into Positive / Negative |
| **Alternatives considered** | Recommended | Can be omitted for trivial decisions, but strongly encouraged |
| **Trigger for revisit** | Optional | Used for deferred or conditional decisions |
| **Related** | Optional | Cross-references to MOPs, other ADRs, or key files |

---

## Style guidelines

1. **Lead with the decision, not the story.** The Context section provides background, but keep it focused on what's relevant to the choice.
2. **Be concrete.** Include file paths, class names, edge function names, migration names — anything that helps a developer locate the implementation.
3. **Include tables** for comparisons (e.g., "before vs after", "option A vs option B").
4. **Keep it scannable.** Use headers, bullets, and tables over long paragraphs.
5. **Don't duplicate MOP content.** If a MOP covers the implementation plan, the ADR covers the *reasoning*. Link to the MOP instead of restating the rollout steps.
6. **One decision per ADR.** If a change involves multiple independent decisions, write separate ADRs.

---

## Lifecycle

1. **Draft** — Author creates the ADR with status `proposed` during planning or implementation.
2. **Accept** — Once the decision is implemented and merged, update status to `accepted`.
3. **Supersede** — If a future decision replaces this one, update status to `superseded` and add a note: `Superseded by ADR-NNNN`.
4. **Review** — During documentation audits (see `DOCUMENTATION_UPDATE_PROCEDURE.md`), update `Last reviewed` dates on all ADRs in scope.

---

## Relationship to MOPs

| Concern | Where it lives |
|---------|---------------|
| *Why* a decision was made (rationale, trade-offs) | **ADR** |
| *How* to implement it (steps, rollback, verification) | **MOP** |
| *What* changed (user-visible summary) | **CHANGELOG.md** |

A MOP may reference an ADR for context. An ADR may reference a MOP for implementation details. Neither should duplicate the other.

**Special case — deferred decisions:** when an ADR documents a decision that has a trigger-conditioned future change (e.g., "we accept JSONB shape today; will normalize when X trigger fires"), the ADR captures the decision + trigger conditions and links to a deferred MOP that holds the future implementation plan. The MOP itself stays in `draft` until the trigger fires.

---

## Checklist (quick reference)

- [ ] Sequential number is correct (no gaps, no duplicates)
- [ ] File name follows `ADR-NNNN-short-kebab-description.md` format
- [ ] Status is set (`proposed` or `accepted`)
- [ ] Author field is populated (default: Nick Neal)
- [ ] Context explains the *problem*, not just the solution
- [ ] Decision is specific enough to implement from
- [ ] Consequences list both positive and negative trade-offs
- [ ] Alternatives section included (recommended)
- [ ] Cross-references to related MOPs/ADRs are correct
- [ ] CHANGELOG.md entry references the ADR (during doc update)
- [ ] If deferred: Trigger for revisit section is populated, linked to a MOP if one exists
