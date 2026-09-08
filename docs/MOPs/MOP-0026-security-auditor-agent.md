# MOP-0026: Security Auditor Agent

| Field | Value |
|-------|-------|
| **MOP** | MOP-0026 |
| **Title** | Security Auditor Agent |
| **Date Submitted** | 2026-09-07 |
| **Date Updated** | 2026-09-07 |
| **Date Completed** | — |
| **Submitted By** | Nick Neal |
| **Status** | draft |

> Status vocabulary defined in [docs/prompts/MOP_STATUS_LIFECYCLE.md](../prompts/MOP_STATUS_LIFECYCLE.md). Valid values: `draft` / `evaluation` / `approved` / `planned` / `in_progress` / `verifying` / `complete` / `blocked` / `cancelled` / `deferred`.

---

## Summary

MOP-0009 Phase 6 identified a `security-auditor` subagent as the highest-value automation remaining in the dev tooling backlog. This MOP extracts and delivers that single piece. The agent performs a read-only audit of the codebase across six security dimensions specific to MealPrep's stack (Supabase RLS, edge function safety, LLM prompt injection, `auth.uid()` discipline) and reports violations in the same structured format used by `qa-auditor` and `doc-adherence`.

---

## Scope Map

```
.claude/agents/security-auditor.md         (new)
supabase/functions/**
src/services/api.ts
supabase/migrations/**
docs/RUNBOOK.md
```

---

## Scope of Work

### Phase 1: Author the security-auditor agent definition
**Files affected:** `.claude/agents/security-auditor.md` (new)

The agent is **read-only and audit-first** — it never modifies files. It cites `file:line` evidence for every finding, runs a structured report, and appends to `.claude/agents/agents-log.md`.

**Six audit dimensions:**

1. **Secret exposure** — API keys / tokens in client-side code; service role keys outside server context; `.env` leakage via git; logged auth headers, emails, or full request bodies in edge functions.

2. **RLS enforcement** — every table has `ENABLE ROW LEVEL SECURITY` + at least one `CREATE POLICY`; no client-side filtering used as an RLS substitute.

3. **Edge function security** — CORS headers scoped correctly; JWT validated on every handler entry; input sanitized before LLM injection; no internal error details leaked in 5xx responses; service role key usage audited.

4. **HARD RULE adherence** — no `supabase db push`, `supabase migration push`, or `--linked` in any committed file or script.

5. **OWASP LLM Top 10 alignment** — prompt injection surface (especially `url-adapter.ts` URL → LLM path); output validation on extraction results; tool-output handling in chat-api.

6. **`auth.uid()` discipline** — no `SECURITY DEFINER` RPC accepts a `user_id` parameter; all `SECURITY DEFINER` functions carry `SET search_path = public`.

**Report format:** Critical / Warning / Suggestion, each with file:line citation, severity rationale, and recommended remediation. Appends run log entry to `.claude/agents/agents-log.md`.

### Phase 2: Reference from existing agents
**Files affected:** `.claude/agents/qa-auditor.md`, `.claude/agents/doc-adherence.md`

Add a cross-reference in each agent's definition: "For security-specific findings (RLS, secrets, LLM injection), invoke `security-auditor`."

---

## Priority

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P1 | Phase 1 — agent definition | Small | High — closes real risk surface (prompt injection, `user_id` param creep, RLS drift) |
| P2 | Phase 2 — cross-references | Tiny | Low (discoverability) |

---

## Verification

```yaml
verification:
  - id: agent-file-exists
    type: file-exists
    path: .claude/agents/security-auditor.md

  - id: agent-has-six-dimensions
    type: grep
    path: .claude/agents/security-auditor.md
    pattern: 'auth\.uid\(\)|OWASP|RLS enforcement|secret|HARD RULE|edge function'
    expect: present

  - id: agent-is-readonly
    type: grep
    path: .claude/agents/security-auditor.md
    pattern: 'read.only|audit.only|never modif'
    expect: present

  - id: qa-auditor-cross-ref
    type: grep
    path: .claude/agents/qa-auditor.md
    pattern: 'security-auditor'
    expect: present

  - id: lint-clean
    type: command
    run: npm run lint
    expect_exit: 0

  - id: build-clean
    type: command
    run: npm run build
    expect_exit: 0
```

## Manual Follow-up (non-blocking)

- [ ] Run `security-auditor` against the current codebase after shipping and triage any findings

---

## Acceptance Criteria

- [ ] All `verification` block items pass (`/verify-mop`)
- [ ] `.claude/agents/security-auditor.md` exists and follows the audit-first, read-only protocol
- [ ] Agent covers all six audit dimensions
- [ ] Cross-references added to `qa-auditor` and `doc-adherence`
- [ ] CHANGELOG entry added

---

## Related

- **MOPs:** MOP-0009 (source — Phase 6 extracted here), MOP-0007 (Phase 1's `user_id` RPC issue is a finding this agent would catch)
- **Audit / source:** MOP-0009 Phase 6 description; OWASP LLM Top 10

---

## Notes

- The agent is a sibling to `qa-auditor` (architectural rules) — this is security-specific. They can be invoked together before merging non-trivial PRs.
- Security findings default to P0/P1 per CLAUDE.md surface-reviewer guidance — this agent should be invoked before any PR that touches edge functions, migrations, or `api.ts`.
