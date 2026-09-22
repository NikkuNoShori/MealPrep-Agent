# MOP-0026: Security Auditor Agent

| Field | Value |
|-------|-------|
| **MOP** | MOP-0026 |
| **Title** | Security Auditor Agent |
| **Date Submitted** | 2026-09-07 |
| **Date Updated** | 2026-09-21 |
| **Date Completed** | — |
| **Submitted By** | Nick Neal |
| **Status** | draft |

> Status vocabulary defined in [docs/prompts/MOP_STATUS_LIFECYCLE.md](../prompts/MOP_STATUS_LIFECYCLE.md). Valid values: `draft` / `evaluation` / `approved` / `planned` / `in_progress` / `verifying` / `complete` / `blocked` / `cancelled` / `deferred`.

---

## Summary

Author a `security-auditor` subagent that performs a read-only, structured audit of the codebase across seven security dimensions specific to MealPrep Agent's stack (Supabase RLS, edge function safety, service-role discipline, LLM prompt injection, `auth.uid()` enforcement, secret hygiene, and scheduled function exposure). The agent produces a Critical/Warning/Suggestion report with `file:line` citations, persists known accepted-risk decisions in a knowledge base to suppress noise on repeat runs, and appends a structured run-log entry on every invocation. Invocable via `/security-audit` slash command and automatically surfaced by `qa-auditor` and `doc-adherence` for security-relevant changes.

---

## Security Stance (project context)

MealPrep Agent uses **RLS as the primary authorization layer**. The authenticated Supabase client (built from the user's JWT via `getUserFromToken`) runs every query with RLS active and `auth.uid()` resolving automatically — no `user_id` parameter is passed. The service-role client (`createServiceClient`) bypasses RLS and is reserved for admin operations, scheduled jobs, and invite-email sending. SECURITY DEFINER RPCs enforce `auth.uid()` internally rather than accepting a caller-supplied `user_id`. The auditor must enforce this discipline and flag any deviation.

**Known accepted risks (document in knowledge base, not findings):**
- `cors.ts` wildcard `Access-Control-Allow-Origin: *` — intentional for a Supabase-hosted edge function; client enforces auth via JWT, not origin.
- `household-invite/details` route is intentionally unauthenticated — invite preview must be readable before login.
- `embedding-refresh` has no inbound auth gate — intended to be called only by Supabase internal cron scheduler; URL is not publicly advertised.

---

## Scope Map

```
.claude/agents/security-auditor.md              (new — agent definition)
.claude/agents/security-auditor-knowledge/      (new — accepted-risk KB)
  README.md
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
**Files affected:** `.claude/agents/security-auditor-knowledge/README.md`, `accepted-risks.md`, `fixed-findings.md`

Create the knowledge base directory. Pre-populate `accepted-risks.md` with the three known accepted risks listed in the Security Stance section above (wildcard CORS, unauthenticated invite details, unauthenticated embedding-refresh). Pre-populate `fixed-findings.md` with the `getRecipe` user_id client-filter bug fixed in commit `3a6715a` (2026-09-21). These entries prevent re-reporting on every run.

`accepted-risks.md` schema per entry:
```
## <short-title>
- **File:** <path:line>
- **Risk:** <what it is>
- **Accepted because:** <rationale>
- **Revisit trigger:** <condition that would reopen this>
- **Date accepted:** YYYY-MM-DD
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

The agent is **read-only and audit-first** — it never modifies files. It reads its knowledge base on every run to suppress accepted-risk noise and avoid re-reporting fixed findings. It cites `file:line` evidence for every finding and appends a run-log entry on completion.

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
- Accepted-risk items suppressed: N
- Fixed findings skipped: N

### Findings

| Severity | Dimension | Location | Finding | Remediation |
|----------|-----------|----------|---------|-------------|
| Critical | RLS | src/services/api.ts:244 | user_id client filter substituting for RLS on getRecipe | Remove .eq("user_id"...) — let RLS authorize |
| Warning  | Edge Fn   | supabase/functions/chat-api/index.ts:493 | Raw error.message in corsError() | Sanitize to generic message; log detail server-side |

### Accepted Risks (not findings)
- <title> — <one-line rationale> (see accepted-risks.md)

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

  - id: kb-has-accepted-cors-risk
    type: grep
    path: .claude/agents/security-auditor-knowledge/accepted-risks.md
    pattern: 'CORS|cors'
    expect: present

  - id: kb-has-accepted-embedding-refresh-risk
    type: grep
    path: .claude/agents/security-auditor-knowledge/accepted-risks.md
    pattern: 'embedding.refresh|embedding_refresh'
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
- [ ] Verify the scoped invocations (`security-auditor edge-functions`, `security-auditor migrations`) produce narrowed output
- [ ] Confirm run-log entry appears in `.claude/agents/agents-log.md` after first run

---

## Acceptance Criteria

- [ ] All `verification` block items pass (`/verify-mop`)
- [ ] `.claude/agents/security-auditor.md` exists and follows audit-first, read-only protocol
- [ ] Agent covers all seven audit dimensions with project-specific callsites named
- [ ] Knowledge base scaffolded with three accepted risks and one fixed finding pre-populated
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
