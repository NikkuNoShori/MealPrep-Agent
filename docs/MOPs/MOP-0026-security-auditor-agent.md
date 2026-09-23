# MOP-0026: Security Auditor Agent

| Field | Value |
|-------|-------|
| **MOP** | MOP-0026 |
| **Title** | Security Auditor Agent |
| **Date Submitted** | 2026-09-07 |
| **Date Updated** | 2026-09-22 (complete — all findings fixed, KB populated, cron wired) |
| **Date Completed** | 2026-09-22 |
| **Submitted By** | Nick Neal |
| **Status** | complete |

> Status vocabulary defined in [docs/prompts/MOP_STATUS_LIFECYCLE.md](../prompts/MOP_STATUS_LIFECYCLE.md). Valid values: `draft` / `evaluation` / `approved` / `planned` / `in_progress` / `verifying` / `complete` / `blocked` / `cancelled` / `deferred`.

---

## Summary

Author a `security-auditor` subagent that performs a read-only, structured audit of the codebase across seven security dimensions specific to MealPrep Agent's stack (Supabase RLS, edge function safety, service-role discipline, LLM prompt injection, `auth.uid()` enforcement, secret hygiene, and scheduled function exposure). The agent produces a Critical/Warning/Suggestion report with `file:line` citations, persists known accepted-risk decisions in a knowledge base to suppress noise on repeat runs, and appends a structured run-log entry on every invocation. Invocable via `/security-audit` slash command and automatically surfaced by `qa-auditor` and `doc-adherence` for security-relevant changes.

---

## Security Stance (project context)

MealPrep Agent uses **RLS as the primary authorization layer**. The authenticated Supabase client (built from the user's JWT via `getUserFromToken`) runs every query with RLS active and `auth.uid()` resolving automatically — no `user_id` parameter is passed. The service-role client (`createServiceClient`) bypasses RLS and is reserved for admin operations, scheduled jobs, and invite-email sending. SECURITY DEFINER RPCs enforce `auth.uid()` internally rather than accepting a caller-supplied `user_id`. The auditor must enforce this discipline and flag any deviation.

**Known accepted risks (require sign-off before suppression):**
No risk may be suppressed by the agent until it has been reviewed and approved by a human. Candidate risks are staged in `pending-risks.md` first. Only after explicit sign-off (filling in `Approved by` + `Approval date`) are they promoted to `accepted-risks.md`. The three risks listed below are pre-staged in `pending-risks.md` at Phase 0 scaffold time — they require review before the first audit run is considered clean.

- `cors.ts` wildcard `Access-Control-Allow-Origin: *` — intentional for a Supabase-hosted edge function; client enforces auth via JWT, not origin.
- `household-invite/details` route is intentionally unauthenticated — invite preview must be readable before login.
- `embedding-refresh` has no inbound auth gate — intended to be called only by Supabase internal cron scheduler; URL is not publicly advertised.

---

## Scope Map

```
.claude/agents/security-auditor.md              (new — agent definition)
.claude/commands/security-audit.md             (new — /security-audit slash command)
.claude/agents/security-auditor-knowledge/      (new — accepted-risk KB)
  README.md
  pending-risks.md
  accepted-risks.md
  fixed-findings.md
supabase/functions/chat-api/index.ts
supabase/functions/admin-api/index.ts
supabase/functions/household-invite/index.ts
supabase/functions/recipe-pipeline/index.ts
supabase/functions/embedding-refresh/index.ts
supabase/functions/_shared/cors.ts
supabase/functions/_shared/supabase-client.ts
supabase/functions/_shared/openrouter-keys.ts
supabase/functions/_shared/web-search-client.ts
supabase/migrations/**
src/services/api.ts
src/stores/authStore.ts
.claude/agents/qa-auditor.md                    (Phase 2 cross-ref)
.claude/agents/doc-adherence.md                 (Phase 2 cross-ref)
CLAUDE.md                                       (Phase 2 — add agent row + invocation rule)
docs/RUNBOOK.md                                 (Phase 2 — add security audit runbook entry)
```

---

## Scope of Work

### Phase 0: Knowledge base scaffold
**Files affected:** `.claude/agents/security-auditor-knowledge/README.md`, `pending-risks.md`, `accepted-risks.md`, `fixed-findings.md`

Create the knowledge base directory with four files. Pre-populate `pending-risks.md` with the three known candidate risks listed in the Security Stance section (wildcard CORS, unauthenticated invite details, unauthenticated embedding-refresh) — they are staged here, not in `accepted-risks.md`, because they require explicit human sign-off before they suppress audit findings. Pre-populate `fixed-findings.md` with the `getRecipe` user_id client-filter bug fixed in commit `3a6715a` (2026-09-21). `accepted-risks.md` starts empty; entries are promoted from `pending-risks.md` only after approval.

**Promotion workflow:**
1. Agent finds a potential accepted-risk candidate → writes it to `pending-risks.md` (agent may write here)
2. Human reviews the entry, fills in `Approved by` + `Approval date`, and moves it to `accepted-risks.md` (human-only step)
3. Agent reads `accepted-risks.md` on every run and suppresses matching findings
4. Agent reads `pending-risks.md` on every run and reports those entries as `⚠ PENDING APPROVAL` — they are not suppressed

`pending-risks.md` schema per entry:
```
## <short-title>
- **Risk ID:** RISK-NNNN
- **File:** <path:line>
- **Risk:** <what it is>
- **Severity:** Critical / Warning / Suggestion
- **Impact if exploited:** <concrete harm — what an attacker could do>
- **Nominated because:** <why this is a candidate for acceptance rather than a fix>
- **Revisit trigger:** <condition that would close or reopen this>
- **Date nominated:** YYYY-MM-DD
```

`accepted-risks.md` schema per entry:
```
## <short-title>
- **Risk ID:** RISK-NNNN
- **File:** <path:line>
- **Risk:** <what it is>
- **Severity:** Critical / Warning / Suggestion
- **Impact if exploited:** <concrete harm — what an attacker could do>
- **Accepted because:** <rationale>
- **Revisit trigger:** <condition that would reopen this>
- **Approved by:** <name>
- **Approval date:** YYYY-MM-DD
- **First surfaced:** YYYY-MM-DD
```

`fixed-findings.md` schema per entry:
```
## <short-title>
- **File:** <path:line>
- **Finding:** <what it was>
- **Fixed in:** <commit or PR>
- **Date fixed:** YYYY-MM-DD
```

### Phase 1: Author the security-auditor agent definition
**Files affected:** `.claude/agents/security-auditor.md` (new)

The agent is **read-only and audit-first** — it never modifies source files. The one exception: it may append new candidate entries to `pending-risks.md` when it identifies something that warrants human review for potential acceptance. It reads `accepted-risks.md` on every run to suppress approved risks, reads `pending-risks.md` to surface any unapproved candidates as `⚠ PENDING APPROVAL`, and reads `fixed-findings.md` to skip closed issues. It cites `file:line` evidence for every finding and appends a run-log entry on completion.

**Seven audit dimensions:**

**1. Secret exposure**
- API keys / tokens in client-side code (`src/` tree)
- Service role key usage outside `_shared/supabase-client.ts` `createServiceClient()`
- OpenRouter keys hardcoded anywhere (vs. `Deno.env.get(...)`)
- Logged auth headers, user emails, or full request bodies in edge functions
- Any key or secret returned in a response body

**2. RLS enforcement**
- Every table in `supabase/migrations/` has `ENABLE ROW LEVEL SECURITY` + at least one `CREATE POLICY`
- No client-side `user_id` filter used as an RLS substitute in `src/services/api.ts` — all ownership scoping must be done by RLS or SECURITY DEFINER RPCs, not by `.eq("user_id", user.id)` on SELECT queries
- Any new `supabase.from()` SELECT in `api.ts` that filters by `user_id` before an id/slug match is a finding

**3. Edge function security**
- CORS headers reviewed (wildcard origin is an accepted risk — do not re-report; flag if a non-shared function adds its own non-wildcard CORS that conflicts)
- JWT validated via `getUserFromToken` on every non-health, non-public route entry point
- Raw `error.message` passed to `corsError(error.message, 5xx)` — flag each callsite; internal stack traces and DB error details must not reach callers
- Image/media MIME type derived from client-controlled input (not independently validated) — flag
- `confirmAction` in `chat-api`: verify there is server-side validation that the tool + args match a previously-proposed `pendingConfirmation` before executing; flag if absent
- `handleGetHistory` and similar: verify that chat/conversation ownership is enforced by RLS, not just by a `conversation_id` parameter lookup

**4. Service-role discipline**
- `createServiceClient()` must only appear in: `_shared/supabase-client.ts` (definition), `admin-api/` (admin ops), `household-invite/` (invite mutations), `embedding-refresh/` (scheduled job)
- Any new file or function importing / calling `createServiceClient()` is a Critical finding unless it follows the same access-gating pattern
- Scheduled functions that use service-role without an inbound auth gate (e.g. `embedding-refresh`) are an accepted risk — document in KB, do not re-report

**5. OWASP LLM Top 10 alignment**
- Prompt injection surface: user-supplied strings (recipe URLs, message text, recipe titles) that flow into LLM prompts without sanitization — check `url-adapter.ts`, `chat-api`, `recipe-prompts.ts`
- Output validation: extraction results from LLM should be schema-validated before being written to the DB — check `recipe-schema.ts` usage in the pipeline
- Tool-output handling: in `chat-api`, verify that tool results from RPC/DB calls are not passed back to the LLM as trusted instructions
- No model-name or temperature parameters accepted from client input (user should not be able to override the model)

**6. `auth.uid()` discipline**
- No SECURITY DEFINER RPC in any migration accepts a `user_id` or `p_user_id` parameter — all must derive the caller identity from `auth.uid()` internally
- All SECURITY DEFINER functions must carry `SET search_path = public` in their definition
- Flag any new RPC that does not raise `errcode = '42501'` for unauthenticated callers

**7. HARD RULE adherence**
- No `supabase db push`, `supabase migration push`, `supabase link`, or `--linked` in any committed script, Makefile, GitHub Actions workflow, or documentation
- No remote DB modification logic reachable from any edge function (edge functions may read/write through the Supabase client, but must not call `supabase CLI` commands)

**Scoped invocation:** The agent accepts an optional scope argument:
- `security-auditor` (no arg) — full audit across all seven dimensions
- `security-auditor edge-functions` — dimensions 3, 4, 5 only against `supabase/functions/`
- `security-auditor migrations` — dimension 2 (RLS) and 6 (`auth.uid()`) against `supabase/migrations/`
- `security-auditor api` — dimension 2 (client-side RLS substitution) against `src/services/api.ts`

**Report format:**
```
## Security Audit — <scope> — <date>

### Summary
- Dimensions audited: N
- Findings: N (critical: X, warning: Y, suggestion: Z)
- Pending-approval risks (not suppressed): N
- Accepted-risk items suppressed: N
- Fixed findings skipped: N

### Findings

| Severity | Dimension | Location | Finding | Remediation |
|----------|-----------|----------|---------|-------------|
| Critical | RLS | src/services/api.ts:244 | user_id client filter substituting for RLS on getRecipe | Remove .eq("user_id"...) — let RLS authorize |
| Warning  | Edge Fn   | supabase/functions/chat-api/index.ts:493 | Raw error.message in corsError() | Sanitize to generic message; log detail server-side |

### Pending Approval (staged in pending-risks.md — not suppressed)
- RISK-NNNN: <title> — <one-line description> — **ACTION REQUIRED: review and approve or fix**

### Accepted Risks (suppressed — approved in accepted-risks.md)
- RISK-NNNN: <title> — <one-line rationale> (approved by <name> on YYYY-MM-DD)

### Notes
- Any dimension where no findings were found is listed here as "clean"
```

**Run log format** (append to `.claude/agents/agents-log.md`):
```
| YYYY-MM-DD | security-auditor | <scope> | C:<n> W:<n> S:<n> | P0: yes/no | <invoker> |
```

### Phase 2: Wire into existing agents and CLAUDE.md
**Files affected:** `.claude/agents/qa-auditor.md`, `.claude/agents/doc-adherence.md`, `CLAUDE.md`, `docs/RUNBOOK.md`

1. **`qa-auditor.md`** — add a note in the "What You Do NOT Do" section: "For security-specific findings (RLS gaps, secret exposure, LLM injection, `auth.uid()` discipline), invoke `security-auditor` rather than reporting them here."
2. **`doc-adherence.md`** — add a note in check category 8 (or a new category): "Security-relevant doc drift (e.g. a new edge function not covered in RUNBOOK, a new RPC not audited against `auth.uid()` discipline) should trigger `security-auditor`."
3. **`CLAUDE.md`** — add `security-auditor` to the agent inventory table, and add a rule: "Before merging any PR that touches `supabase/functions/`, `supabase/migrations/`, or `src/services/api.ts`, invoke `security-auditor` (or the scoped variant matching the changed surface)."
4. **`docs/RUNBOOK.md`** — add a "Security Audit" runbook entry with: how to invoke the agent, how to interpret findings, how to add an accepted-risk entry to the KB, and the run-log location.
5. **`.claude/commands/security-audit.md`** — wire `/security-audit` as a slash command that invokes the `security-auditor` subagent with the optional scope argument.

---

## Priority

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P0 | Phase 0 — KB scaffold + accepted risks | Tiny | High — prevents noise masking real findings |
| P1 | Phase 1 — agent definition | Small | High — closes real risk surface |
| P2 | Phase 2 — cross-references + CLAUDE.md + RUNBOOK | Small | Medium (discoverability + enforcement) |

---

## Verification

```yaml
verification:
  - id: agent-file-exists
    type: file-exists
    path: .claude/agents/security-auditor.md

  - id: kb-pending-risks-exists
    type: file-exists
    path: .claude/agents/security-auditor-knowledge/pending-risks.md

  - id: kb-accepted-risks-exists
    type: file-exists
    path: .claude/agents/security-auditor-knowledge/accepted-risks.md

  - id: kb-fixed-findings-exists
    type: file-exists
    path: .claude/agents/security-auditor-knowledge/fixed-findings.md

  - id: agent-has-seven-dimensions
    type: grep
    path: .claude/agents/security-auditor.md
    pattern: 'auth\.uid\(\)|OWASP|RLS enforcement|secret|HARD RULE|edge function|service.role'
    expect: present

  - id: agent-is-readonly
    type: grep
    path: .claude/agents/security-auditor.md
    pattern: 'read.only|audit.only|never modif'
    expect: present

  - id: agent-accepts-scoped-invocation
    type: grep
    path: .claude/agents/security-auditor.md
    pattern: 'edge-functions|migrations|scoped'
    expect: present

  - id: agent-has-run-log-format
    type: grep
    path: .claude/agents/security-auditor.md
    pattern: 'agents-log'
    expect: present

  - id: kb-pending-has-cors-risk
    type: grep
    path: .claude/agents/security-auditor-knowledge/pending-risks.md
    pattern: 'CORS|cors'
    expect: present

  - id: kb-pending-has-embedding-refresh-risk
    type: grep
    path: .claude/agents/security-auditor-knowledge/pending-risks.md
    pattern: 'embedding.refresh|embedding_refresh'
    expect: present

  - id: kb-accepted-starts-empty
    type: grep
    path: .claude/agents/security-auditor-knowledge/accepted-risks.md
    pattern: 'Approved by:'
    expect: absent

  - id: kb-pending-has-risk-id-field
    type: grep
    path: .claude/agents/security-auditor-knowledge/pending-risks.md
    pattern: 'Risk ID|RISK-'
    expect: present

  - id: agent-references-pending-risks
    type: grep
    path: .claude/agents/security-auditor.md
    pattern: 'pending.risks|PENDING APPROVAL'
    expect: present

  - id: agent-references-approved-by
    type: grep
    path: .claude/agents/security-auditor.md
    pattern: 'Approved by|approved-by'
    expect: present

  - id: kb-has-fixed-getrecipe-finding
    type: grep
    path: .claude/agents/security-auditor-knowledge/fixed-findings.md
    pattern: 'getRecipe|user_id'
    expect: present

  - id: qa-auditor-cross-ref
    type: grep
    path: .claude/agents/qa-auditor.md
    pattern: 'security-auditor'
    expect: present

  - id: claude-md-agent-row
    type: grep
    path: CLAUDE.md
    pattern: 'security-auditor'
    expect: present

  - id: security-audit-command-exists
    type: file-exists
    path: .claude/commands/security-audit.md

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

- [ ] Review the three pre-staged entries in `pending-risks.md` (wildcard CORS, unauthenticated invite details, unauthenticated embedding-refresh) — approve each or decide to fix; promote approved entries to `accepted-risks.md` with `Approved by` + `Approval date` filled in
- [ ] Run `security-auditor` against the current codebase after shipping and triage any findings
- [ ] Verify the scoped invocations (`security-auditor edge-functions`, `security-auditor migrations`) produce narrowed output
- [ ] Confirm run-log entry appears in `.claude/agents/agents-log.md` after first run

---

## Acceptance Criteria

- [ ] All `verification` block items pass (`/verify-mop`)
- [ ] `.claude/agents/security-auditor.md` exists and follows audit-first, read-only protocol
- [ ] Agent covers all seven audit dimensions with project-specific callsites named
- [ ] Knowledge base scaffolded: three candidate risks in `pending-risks.md` (with Risk IDs), `accepted-risks.md` starts empty, one fixed finding in `fixed-findings.md`
- [ ] Agent reports `pending-risks.md` entries as `⚠ PENDING APPROVAL` — does not suppress them
- [ ] `accepted-risks.md` schema requires `Risk ID`, `Approved by`, and `Approval date` fields
- [ ] Agent accepts scoped invocation (`edge-functions`, `migrations`, `api`)
- [ ] Run-log format defined and agent appends to `.claude/agents/agents-log.md`
- [ ] Cross-references added to `qa-auditor`, `doc-adherence`, `CLAUDE.md`, and `RUNBOOK.md`
- [ ] CHANGELOG entry added

---

## Related

- **MOPs:** MOP-0009 (source — Phase 6 extracted here), MOP-0014 (SECURITY DEFINER RPC pattern this agent enforces)
- **Commits:** `3a6715a` (2026-09-21) — `getRecipe` user_id client-filter fix, pre-populated in `fixed-findings.md`
- **Audit / source:** MOP-0009 Phase 6 description; OWASP LLM Top 10

---

## Notes

- The agent is a sibling to `qa-auditor` (architectural rules) — this one is security-specific. They can be invoked together before any PR touching the security-relevant surface.
- The knowledge base is the key differentiator from a one-shot grep: it makes repeat runs useful by suppressing accepted-risk noise, so findings that do appear are signal, not background.
- Wildcard CORS (`Access-Control-Allow-Origin: *`) is an **accepted risk** for Supabase-hosted edge functions — auth is enforced via JWT bearer token, not origin. Do not report it as a finding.
- `embedding-refresh` intentionally has no inbound auth gate — it is triggered only by Supabase's internal cron scheduler. The accepted-risk KB entry documents this so it does not surface as a Critical finding on every run.
- `confirmAction` bypass in `chat-api` warrants a Suggestion finding on first run until server-side validation of the proposed tool+args is confirmed or added.
