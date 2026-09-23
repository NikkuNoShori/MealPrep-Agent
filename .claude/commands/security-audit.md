Invoke the `security-auditor` subagent to run a structured, read-only security audit of the codebase.

## When to use

- Before merging any PR that touches `supabase/functions/`, `supabase/migrations/`, or `src/services/api.ts`
- After adding a new edge function, RPC, or service-role callsite
- When `qa-auditor` or `doc-adherence` flags a security-relevant finding
- Periodically as a full-surface check (quarterly recommended)

## Arguments

Pass an optional scope to narrow the audit:

| Invocation | Dimensions run |
|---|---|
| `/security-audit` | All 7 dimensions — full codebase |
| `/security-audit edge-functions` | Dimensions 3, 4, 5 — `supabase/functions/` only |
| `/security-audit migrations` | Dimensions 2, 6 — `supabase/migrations/` only |
| `/security-audit api` | Dimension 2 — client-side RLS substitution in `src/services/api.ts` only |

## Workflow

1. Read the scope argument (if any).
2. Invoke the `security-auditor` subagent via the Agent tool with `subagent_type: "security-auditor"`, passing the scope as context.
3. The agent will:
   - Read `.claude/agents/security-auditor-knowledge/accepted-risks.md` — suppress approved risks
   - Read `.claude/agents/security-auditor-knowledge/pending-risks.md` — report as `⚠ PENDING APPROVAL`
   - Read `.claude/agents/security-auditor-knowledge/fixed-findings.md` — skip closed findings
   - Audit the specified scope across the relevant dimensions
   - Produce a Critical/Warning/Suggestion report with `file:line` citations
   - Append a run-log entry to `.claude/agents/agents-log.md`
4. Present the full report to the user.
5. For any Critical finding, surface it immediately and recommend blocking the current PR or task.
6. For `⚠ PENDING APPROVAL` items, prompt the user to review `pending-risks.md` and either approve or fix each one.

## Key rules

- The agent is read-only — it never modifies source files, migrations, or edge functions.
- The agent may append to `pending-risks.md` to nominate a new candidate risk.
- Only the user (human) may promote entries from `pending-risks.md` to `accepted-risks.md` by filling in `Approved by` and `Approval date`.
- The agent does not push migrations or modify the remote database. (HARD RULE.)
- Do not suppress a `⚠ PENDING APPROVAL` item on the user's behalf — direct them to review it explicitly.
