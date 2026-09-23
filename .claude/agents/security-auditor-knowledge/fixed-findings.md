# Fixed Findings — Closed Issues

Entries here are skipped on every audit run (agent does not re-report them as findings).
Add an entry when a confirmed security finding is fixed, so future runs stay clean.

---

## Unauthenticated Embedding Refresh Function (RISK-0003)

- **File:** supabase/functions/embedding-refresh/index.ts
- **Finding:** No inbound auth gate — any caller with the function URL could trigger a full embedding refresh job using the service-role client. Cost-spike / DoS vector.
- **Fixed in:** 2026-09-22 session — `verify_jwt: true` re-enabled on the function. The pg_cron job passes a service-role JWT; Supabase validates it before the function code runs. No custom auth code needed.
- **Date fixed:** 2026-09-22

---

## confirmAction Server-Side Bypass

- **File:** supabase/functions/chat-api/index.ts (confirmAction branches), supabase/functions/chat-api/tools/dispatch.ts
- **Finding:** `confirmAction` short-circuit executed destructive tools using caller-supplied `tool + args` with no server-side verification that those matched a previously-proposed `pendingConfirmation`. The `idempotencyKey` was a deterministic hash, not a secret nonce. Any authenticated user could craft a `confirmAction` payload and execute `delete_recipe`, `update_recipe`, etc. without an agent-loop proposal.
- **Fixed in:** commit pending — 2026-09-22 session (verifyAndConsumeConfirmation helper + crypto.randomUUID nonce)
- **Date fixed:** 2026-09-22

---

## search_similar_recipes Orphan RPC — Caller-Supplied user_id

- **File:** supabase/migrations/20251201000003_004_search_and_embeddings.sql:105–135
- **Finding:** `search_similar_recipes` accepted a caller-supplied `user_uuid` parameter instead of deriving identity from `auth.uid()` internally. Any authenticated user could pass another user's UUID and read their recipe embeddings. Intentionally excluded from migration 028's auth.uid() hardening pass.
- **Fixed in:** migration 039 (drop function) — 2026-09-22
- **Date fixed:** 2026-09-22

---

## getRecipe Client-Side user_id Filter

- **File:** src/services/api.ts (getRecipe function)
- **Finding:** `getRecipe()` filtered by the viewer's `user_id` before matching the recipe ID/slug, which substituted a client-side ownership check for RLS. Any recipe not owned by the viewer returned zero rows (406), preventing public and household-visibility recipes from being opened by other users.
- **Fixed in:** commit `3a6715a` (2026-09-21)
- **Date fixed:** 2026-09-21
