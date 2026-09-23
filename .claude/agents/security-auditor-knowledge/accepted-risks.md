# Accepted Risks — Human-Approved Suppressions

Entries here are suppressed on every audit run (agent does not re-report them as findings).
Every entry requires a human-filled `Approved by` + `Approval date` before it belongs here.

See `README.md` for the entry schema and promotion workflow.

---

## Wildcard CORS Origin

- **Risk ID:** RISK-0001
- **File:** supabase/functions/_shared/cors.ts
- **Risk:** `Access-Control-Allow-Origin: *` allows any origin to make requests to the edge functions.
- **Severity:** Warning
- **Impact if exploited:** A malicious page could make cross-origin requests on behalf of a logged-in user. However, auth is enforced via JWT bearer token — the attacker would still need a valid JWT, which they cannot obtain from another origin.
- **Accepted because:** Supabase-hosted edge functions cannot restrict origin via DNS/firewall; the wildcard is the standard pattern. JWT-based auth means origin is not the security boundary.
- **Revisit trigger:** If any edge function begins accepting non-JWT auth (e.g., cookie-based sessions), wildcard CORS becomes a CSRF vector and must be narrowed.
- **Approved by:** Nick Neal
- **Approval date:** 2026-09-22
- **First surfaced:** 2026-09-21

---

## Unauthenticated Household Invite Details Route

- **Risk ID:** RISK-0002
- **File:** supabase/functions/household-invite/index.ts
- **Risk:** The `details` route of `household-invite` is intentionally unauthenticated — it returns invite metadata (inviter name, household name) without a JWT.
- **Severity:** Warning
- **Impact if exploited:** An attacker with a valid invite token could enumerate invite metadata. Token is a UUID generated server-side; brute-force is computationally infeasible. No PII beyond inviter/household name is returned.
- **Accepted because:** The invite preview page must be readable before the invitee has logged in — requiring auth defeats the UX purpose. Token-scoped access limits the blast radius.
- **Revisit trigger:** If the details route begins returning additional PII (email addresses, member lists, etc.), re-evaluate whether pre-auth access is still acceptable.
- **Approved by:** Nick Neal
- **Approval date:** 2026-09-22
- **First surfaced:** 2026-09-21

---

<!-- RISK-0003 was initially approved 2026-09-22 but immediately superseded by a fix.
     See fixed-findings.md — CRON_SECRET gate added to embedding-refresh 2026-09-22. -->
