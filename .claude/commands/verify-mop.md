Mechanically verify a MOP's `## Verification` block and gate the `verifying → complete` transition.

## Instructions

Single-shot procedure enforcing [MOP_VERIFICATION_POLICY.md](../../docs/prompts/MOP_VERIFICATION_POLICY.md).

## Workflow

1. **Identify MOP** — user provides `MOP-NNNN` or path. Read the MOP file and `docs/MOPs/REGISTRY.md`.
2. **Policy pre-check (hard fail)**
   - If `## Verification` section missing → STOP. Status cannot exceed `in_progress`.
   - Parse YAML `verification:` block. If **any** item has `type: human` → STOP. Report: *"Manual gates block `complete`. Move items to `## Manual Follow-up (non-blocking)` or automate."*
3. **Execute assertions** in order:

   | type | How to verify |
   |------|---------------|
   | `file-exists` | Glob/Read — file must exist |
   | `grep` | Grep path for pattern; `expect: present` or `absent` |
   | `command` | Run `run` field; check `expect_exit` (default 0) |
   | `test-passes` | Run `npm run test:run -- <pattern>` or command specified |

   Use `;` not `&&` when chaining shell commands.

4. **Domain routing** — if MOP has `## Scope Map`, also run `/integrity-check` for that MOP (or invoke `integrity-orchestrator`). Domain failures count as verification failures.

5. **Report** per assertion: `✅ id` or `❌ id — reason`

6. **Status proposal (propose only — do not commit unless user asks)**
   - All pass → propose: MOP status `complete`, fill `Date Completed`, update registry, remind user to run `/update-docs`
   - Any fail → propose: status `blocked`, list failing ids

## Output format

```
## Verify MOP-NNNN

### Policy
- Verification block: [present/missing]
- Human gates: [count — must be 0 for complete]

### Assertions
| id | type | result | detail |
|----|------|--------|--------|

### Verdict
[PASS → eligible for complete | FAIL → blocked]

### Proposed diff
[status/registry changes if PASS]
```

## Do NOT

- Auto-commit or flip registry without user approval.
- Treat `type: human` as pass.
- Push migrations or touch remote DB.
