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

> **Lockticket-format acceptance criteria.** Each assertion is machine-checkable except where marked `type: human`. `/verify-mop` (MOP-0010) runs these and gates the `verifying → complete` transition.

```yaml
verification:
  - id: example-file-exists
    type: file-exists
    path: src/example.ts

  - id: example-grep-present
    type: grep
    path: src/example.ts
    pattern: 'expectedSymbol'
    expect: present

  - id: example-grep-absent
    type: grep
    path: src/example.ts
    pattern: 'forbiddenPattern'
    expect: absent

  - id: example-command
    type: command
    run: npm run lint
    expect_exit: 0

  - id: example-test
    type: test-passes
    pattern: 'test name or file pattern'

  - id: example-human
    type: human
    description: A criterion that requires human judgment (UX, code quality, etc.)
    target: clearly-stated target
    hard_gate: true  # optional — if true, MOP cannot complete without this passing
```

Assertion types: `file-exists`, `grep`, `command`, `test-passes`, `human`. See MOP-0010 for full schema.

---

## Acceptance Criteria

- [ ] All `verification` block items pass
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
