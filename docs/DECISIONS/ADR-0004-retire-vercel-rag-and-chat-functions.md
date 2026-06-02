# ADR-0004: Retire Legacy Vercel `api/` Serverless Functions

**Status:** accepted
**Created:** 2026-06-01
**Author:** Nick Neal
**Last reviewed:** 2026-06-01
**Related MOP:** — (deletion is small enough to handle inline once executed)

## Context

The repository contains a Vercel serverless function tree at `api/` that represents an earlier architecture predating the Supabase Edge Functions migration. These functions are still exposed by `vercel.json` (which routes `/api/*` to handlers) but no functional path in the live frontend reaches them. They sit as legacy code with their own database backend, their own AI SDK, and their own auth layer — all parallel to the current Supabase Edge Functions + pgvector + OpenRouter stack.

### Files in question

| File | Last touched | Purpose | Backend | Status |
|---|---|---|---|---|
| `api/rag/search.js` | 2025-11-14 | RAG search (semantic + text + hybrid) | Neon DB via `@neondatabase/serverless` | Dead |
| `api/rag/auth.js` | 2025-11-14 | Supabase JWT verification helper for the above | n/a | Dead (only consumed by search.js) |
| `api/chat.js` | 2025-08-31 | Chat endpoint via n8n webhook | Neon DB | Dead |
| `api/chat/` | 2025 | Additional chat sub-endpoints | Neon DB | Dead |
| `backend/rag-api.js` | 2026-06-01 (recent) | Helper module used by `server.js` | — | Live via server.js only |
| `src/services/recipeService.ts` | unknown | Frontend wrapper for `/api/...` endpoints | — | Dead in components/pages/hooks |
| `src/services/supabase.ts:58–75` | unknown | Stub `recipeService` returning empty data | — | Dead, conflicts with recipeService.ts name |

### Evidence that the Vercel functions are dead

1. **No Supabase edge function exists at `/rag/*`.** `supabase/functions/` contains `_shared`, `admin-api`, `chat-api`, `household-invite`, `recipe-pipeline` — no `rag` function. So `apiClient.ragSearch()` (api.ts:748–752) routes to a path that does not exist in production. It works in localhost only because `server.js` provides `/api/rag/search`.
2. **`ragService.ts` wrappers are unused.** The only file importing `ragService` is `ChatInterface.tsx`, and it imports only `detectIntent` — a client-side regex classifier with no API call. None of `apiClient.ragSearch`, `ragEmbedding`, `ragSimilar`, `ragIngredients`, `ragRecommendations` are reached from any component, page, or hook.
3. **`recipeService.ts` is unused.** Grep across `src/` returns zero imports of `recipeService` from components, pages, or hooks. A stub of the same name exists at `src/services/supabase.ts:58–75` that returns empty data — also unused.
4. **`api/chat.js`** was last touched 2025-08-31 (~10 months ago) — predates the current `chat-api` edge function that handles all live chat.
5. **`DATABASE_URL` (Neon) is not set in `.env`** — meaning even if someone hit the Vercel endpoints, they'd connect to a dummy URL (`postgresql://dummy:dummy@localhost/dummy` per `api/chat.js:4` fallback) and fail.
6. **`vercel.json` rewrites still expose `/api/*`** — but the functions either don't connect (no Neon) or 404 silently for the chain since no frontend code calls them.

### Why this matters

- **Security surface:** dead authenticated endpoints are still attack surface. `api/rag/search.js` validates Supabase JWTs — if the auth helper drifts from the current Supabase patterns, it becomes a vulnerability.
- **Cost surface:** if any external system (e.g., the old n8n webhook integration mentioned in `server.js`) still calls these endpoints, they'd consume OpenRouter quota on the legacy `OPENROUTER_API_KEY` path with the legacy `openai` SDK.
- **Mental model burden:** 3 parallel AI/RAG paths (Supabase Edge Functions, `server.js`, Vercel `api/`) is too many. ADR-0002 already documents `server.js` as legacy with retirement triggers. This ADR completes the cleanup by removing the third path.
- **Dependency cleanup:** `@neondatabase/serverless` has no consumers outside `api/`. `openai` has only `src/services/embeddingService.js` (consumed by `server.js`) as the remaining consumer.

## Decision

**Retire the Vercel `api/` directory.** Specifically:

1. **Delete** `api/rag/search.js`, `api/rag/auth.js`, `api/chat.js`, `api/chat/` (entire subdirectory), and the now-empty `api/rag/` and `api/` directories.
2. **Delete** `src/services/recipeService.ts` (dead frontend wrapper for the deleted endpoints).
3. **Delete** the duplicate `recipeService` stub at `src/services/supabase.ts:58–75` (conflicts in name with the file above; both are dead).
4. **Remove** unused npm dependency `@neondatabase/serverless` from `package.json`.
5. **Keep** `openai` npm dependency — `src/services/embeddingService.js` still uses it via `server.js` per ADR-0002.
6. **Keep** `backend/rag-api.js` — consumed by `server.js`, which is intentionally retained per ADR-0002. When `server.js` retires (per ADR-0002 triggers), `backend/rag-api.js` retires with it.
7. **Update** `vercel.json` to remove the `/api/(.*)` CORS headers block — there are no `/api/*` handlers left to serve. The rewrites pattern `(?!api/)` can stay (no functional change without `api/` files).
8. **Verify** by running `npm run build` and `npm run lint` after deletion. The build passing is the primary safety check.

This decision is **paired with ADR-0002**: that ADR keeps `server.js` (and the dev-time `/api/rag/*` shortcut through it) until its retirement triggers fire. This ADR removes the Vercel-deployed parallel `/api/*` path that nobody calls. The two ADRs are consistent: localhost-only convenience (`server.js`) is acceptable; production-deployed dead endpoints are not.

## Consequences

### Positive

- **Eliminates dead production surface.** No more authenticated endpoints sitting unmonitored.
- **Removes Neon DB dependency.** `@neondatabase/serverless` is no longer in the bundle path; one fewer npm package; one fewer database backend in the mental model.
- **Reduces mental-model burden** from 3 parallel AI paths to 2 (Supabase Edge Functions + `server.js`).
- **Vercel deployment is simpler** — no serverless function deploy step needed; only static frontend.
- **`api.ts`'s `ragSearch`/`ragEmbedding`/`ragSimilar`/etc. methods become honestly broken in production** instead of silently 404ing — discoverable as dead code in the next audit, candidate for cleanup once MOP-0007 wires real RAG into the UI.

### Negative

- **If a hidden external caller exists** (e.g., a personal n8n integration, a Postman collection, a forgotten test rig), it will break with the deletion. Risk mitigated by the 7-10 month inactivity of the Vercel functions and the absence of `DATABASE_URL` in the current `.env` (any caller is already broken).
- **`apiClient.rag*` methods in `api.ts` remain in the codebase but route to non-existent Supabase paths in production.** This is pre-existing — the deletion does not worsen it. MOP-0007 will either wire them to real edge functions or remove the methods.
- **`ragService.ts` becomes more obviously dead** post-deletion since its wrappers point at a now-confirmed-broken backend. Candidate for follow-on cleanup but out of scope for this ADR.

## Alternatives considered

1. **Keep with deprecation notice in code comments.** *Rejected:* code comments are not enforced. Dead code rots; deprecation notices get ignored. Active deletion is cleaner.
2. **Migrate `api/rag/search.js` to a Supabase Edge Function `rag-api/`.** *Rejected:* `chat-api` already has the RAG handler. Building a separate `rag-api` edge function would duplicate functionality. Better to wire `api.ts ragSearch` to call `chat-api`'s RAG handler if/when MOP-0007 needs it.
3. **Delete only `api/chat*` and keep `api/rag*` for potential future use.** *Rejected:* both are equally dead, equally outdated. Partial deletion creates an inconsistent state — half-removed feels worse than fully removed or fully kept.
4. **Wait for an external caller to break before deleting.** *Rejected:* waiting for the negative signal is not actionable. The deletion is small (5 files + 1 npm dep). Cost of executing is lower than cost of waiting.

## Trigger for revisit

This ADR does not include a trigger because the decision is terminal — the files are deleted, not deferred. If a future need for a Vercel-deployed serverless function arises (separate from Supabase Edge Functions), it should be designed fresh with a new architecture, not by resurrecting these legacy files.

## Related

- **ADRs:** ADR-0002 (legacy `server.js` retention — sibling pattern, opposite outcome) — `server.js` stays for now; Vercel `api/` goes
- **MOPs:** MOP-0007 (proposed — wire RAG into the Recipes page) would be the natural cleanup point for the orphaned `apiClient.rag*` methods in `api.ts` left behind by this ADR
- **AI Integration Audit (2026-06-01):** §1 cleanup discussion flagged the parallel paths; this ADR closes the Vercel branch
- **Files to delete:**
  - `api/rag/search.js`, `api/rag/auth.js`
  - `api/chat.js`, `api/chat/` (subdirectory contents)
  - `api/rag/`, `api/` (directories, once empty)
  - `src/services/recipeService.ts`
  - `src/services/supabase.ts:58–75` (in-file deletion of the duplicate `recipeService` export)
- **`package.json`:** remove `"@neondatabase/serverless": "^1.0.2"` from `dependencies`
- **`vercel.json`:** remove the `"/api/(.*)"` headers block
- **`server.js`:** unchanged (per ADR-0002)
- **`backend/rag-api.js`:** unchanged (consumed by `server.js`)
- **`src/services/embeddingService.js`:** unchanged (consumed by `server.js`)
