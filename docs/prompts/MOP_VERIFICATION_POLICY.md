# MOP Verification Policy

> **Hard gate for `complete` status.** No MOP may be marked `complete` unless this policy is satisfied.

**Publisher:** Nick Neal  
**Created:** 2026-06-14  
**Authority:** Supersedes informal "check boxes by hand" practice. Works with [MOP_STATUS_LIFECYCLE.md](MOP_STATUS_LIFECYCLE.md) and [MOP_TEMPLATE.md](../MOPs/MOP_TEMPLATE.md).

---

## Rules

### 1. Verification block required

Every MOP must have a `## Verification` section with a `verification:` YAML block **before** entering `verifying` status.

MOPs without a verification block cannot advance past `in_progress`.

### 2. No manual gates on `complete`

**`type: human` assertions are forbidden as completion gates.**

| Assertion type | May gate `complete`? |
|----------------|----------------------|
| `file-exists` | Yes |
| `grep` | Yes |
| `command` | Yes |
| `test-passes` | Yes |
| `human` | **No — ever** |

If work genuinely requires human judgment (UX review, golden-set scoring, production latency measurement):

- Keep the criterion in a separate `## Manual Follow-up (non-blocking)` section, **outside** the verification YAML, OR
- Automate it (scripted eval, Playwright assertion, Deno test with fixtures) and use `command` / `test-passes`, OR
- Split into a child MOP (e.g. MOP-0008 eval sub-MOP) that stays `in_progress` while parent ships structural work.

**Rationale:** A step only you can execute is a blocker. "Complete" means the next developer (or agent) can verify without you in the loop.

### 3. Post-implementation checklist = verification block

The verification block **is** the post-implementation test checklist. It must include:

1. **Structural checks** — key files/symbols exist (`file-exists`, `grep`)
2. **Build health** — `npm run lint`, `npm run build` (exit 0)
3. **Automated tests** — domain-specific suites per [DOMAIN_TEST_MATRIX.md](DOMAIN_TEST_MATRIX.md)
4. **Smoke** — at minimum `npm run test:run`; E2E smoke when UI flows change (`npm run test:e2e`)

### 4. Domain integrity routing

When a MOP's `## Scope Map` touches a product domain, include integrity commands from [DOMAIN_TEST_MATRIX.md](DOMAIN_TEST_MATRIX.md) for that domain in the verification block.

Invoke `integrity-orchestrator` (or `/integrity-check`) to run the routed suite after implementation.

### 5. Transition workflow

```
in_progress → verifying → complete
                  ↓
               blocked (fix → in_progress)
```

| Step | Who | Action |
|------|-----|--------|
| Enter `verifying` | Developer | All implementation merged; verification YAML authored |
| Run checks | `integrity-orchestrator` or `/verify-mop` | Execute every non-human assertion |
| Pass | Developer | `/verify-mop MOP-NNNN` proposes status flip + registry update |
| Fail | Developer | Status → `blocked`; fix or narrow scope |

### 6. Retroactive compliance

MOPs marked `complete` before this policy (0001, 0002, 0004, 0005, 0006) must gain a `## Verification` block on next touch. `/update-registry` flags `complete` MOPs missing verification blocks.

MOP-0008 is **not completable** under this policy until golden-set / human eval items are automated or moved to non-blocking follow-up.

---

## Authoring template (copy into new MOPs)

```yaml
verification:
  # Global gates
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

  # Domain-specific (from DOMAIN_TEST_MATRIX.md)
  - id: domain-example
    type: command
    run: npm run test:run -- src/path/__tests__/example.test.ts
    expect_exit: 0
```

Do **not** add `type: human` entries to this block.

---

## Related

- [DOMAIN_TEST_MATRIX.md](DOMAIN_TEST_MATRIX.md) — domain → test routing
- [MOP_STATUS_LIFECYCLE.md](MOP_STATUS_LIFECYCLE.md) — status definitions
- `.claude/commands/verify-mop.md` — mechanical verifier skill
- `.claude/commands/integrity-check.md` — domain-routed test runner
- `.claude/agents/integrity-orchestrator.md` — agent definition
