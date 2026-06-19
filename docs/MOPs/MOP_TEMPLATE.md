# MOP-XXXX: [Title]

| Field | Value |
|-------|-------|
| **MOP** | MOP-XXXX |
| **Title** | [Short descriptive title] |
| **Date Submitted** | YYYY-MM-DD |
| **Date Updated** | YYYY-MM-DD |
| **Date Completed** | — |
| **Submitted By** | [Name] |
| **Status** | draft |

> Status vocabulary defined in [docs/prompts/MOP_STATUS_LIFECYCLE.md](../prompts/MOP_STATUS_LIFECYCLE.md). Valid values: `draft` / `evaluation` / `approved` / `planned` / `in_progress` / `verifying` / `complete` / `blocked` / `cancelled` / `deferred`.

---

## Summary

[1-3 sentence overview of what this MOP covers and why it matters. Reference related ADRs if applicable.]

---

## Scope Map

> File globs that identify the territory this MOP touches. Used by `/post-change-check` (MOP-0010) to route post-merge verification.

```
src/services/api.ts
supabase/functions/<name>/**
docs/<relevant>
```

---

## Scope of Work

### Phase 1: [Phase Name]
**Files affected:** [list of files]

[Description of what this phase accomplishes.]

### Phase 2: [Phase Name]
**Files affected:** [list of files]

[Description of what this phase accomplishes.]

---

## Priority

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P0 | [item] | Small/Medium/Large | High/Medium/Low |
| P1 | [item] | Small/Medium/Large | High/Medium/Low |

---

## Verification

> **Lockticket acceptance criteria.** See [MOP_VERIFICATION_POLICY.md](../prompts/MOP_VERIFICATION_POLICY.md) — **`type: human` is forbidden** (blocks `complete`). Route domain tests via [DOMAIN_TEST_MATRIX.md](../prompts/DOMAIN_TEST_MATRIX.md). Run `/integrity-check` then `/verify-mop MOP-XXXX`.

```yaml
verification:
  - id: lint-clean
    type: command
    run: npm run lint
    expect_exit: 0

  - id: build-clean
    type: command
    run: npm run build
    expect_exit: 0

  - id: unit-tests
    type: command
    run: npm run test:run
    expect_exit: 0

  # Domain-specific — copy from DOMAIN_TEST_MATRIX.md for your Scope Map
  - id: domain-suite
    type: command
    run: npm run test:run -- src/path/__tests__/example.test.ts
    expect_exit: 0
```

Allowed assertion types: `file-exists`, `grep`, `command`, `test-passes`. **Not allowed:** `human`.

## Manual Follow-up (non-blocking)

> Optional human review **after** `complete`. Never gates status.

- [ ] [UX review, staging spot-check, etc.]

---

## Acceptance Criteria

- [ ] All `verification` block items pass (`/verify-mop`)
- [ ] `/integrity-check` passes for this MOP's domains
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] Documentation updated per `/update-docs` procedure
- [ ] CHANGELOG entry added
- [ ] Related ADRs (if any) updated to `accepted`

---

## Related

- **ADRs:** [list any related ADRs]
- **MOPs:** [list any blocking or dependent MOPs]
- **Audit / source:** [link to AI_INTEGRATION_AUDIT.md or other origin doc if applicable]

---

## Notes

[Any additional context, edge cases, risks, or dependencies.]
