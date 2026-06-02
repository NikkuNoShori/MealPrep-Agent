# ADR-0002: Keep `server.js` as Legacy Local-Dev Server

**Status:** accepted
**Created:** 2026-06-01
**Author:** Nick Neal
**Last reviewed:** 2026-06-01
**Related MOP:** — (retirement is small enough to handle inline when triggers fire)

## Context

The repository contains a legacy Node.js Express server at the project root (`server.js`, 585 lines) wired into `package.json`:

```json
"server": "node server.js",
"dev:all": "concurrently \"npm run server\" \"npm run dev\""
```

The server provides HTTP endpoints that **duplicate** edge function functionality:

| Express endpoint (`server.js`) | Edge function equivalent | Status |
|---|---|---|
| `POST /api/chat/message` (via n8n webhook) | `supabase/functions/chat-api/message` (direct OpenRouter) | Duplicated, different paths |
| `POST /api/rag/search` | `chat-api` RAG handler (uses `search_recipes_semantic` RPC) | Duplicated |
| `GET /api/rag/similar/:recipeId` | `chat-api` `find_similar_recipes` RPC wrap | Duplicated |
| `POST /api/rag/ingredients` | `search_recipes_by_ingredients` RPC (not currently UI-wired) | Duplicated |
| `POST /api/rag/recommendations` | `get_recipe_recommendations` RPC (not currently UI-wired) | Duplicated |
| `POST /api/rag/embedding` | `_shared/embedding-utils.ts` (called by recipe-pipeline) | Duplicated |
| `POST /api/recipes` | Recipe save via `apiClient.createRecipe` | Partially duplicated |

The server uses `OPENROUTER_API_KEY` server-side (secure — same secret as edge functions). It also reads `VITE_OPENROUTER_API_KEY` for backward compatibility but does not require it.

**Last meaningful change:** 2025-12-01 (JWT auth refactor — commit `90b8271`). Not abandoned; actively maintained.

**Usage today:** `npm run dev:all` is the only entry point. The frontend dev workflow (`npm run dev`) does not require it for any production-path feature — the deployed frontend talks to edge functions, not to `server.js`.

## Decision

**Keep `server.js` for now.** Do not retire pre-emptively.

Specifically:
1. `server.js` remains as a local-dev convenience that bypasses the need to run `supabase functions serve` for chat and RAG endpoints.
2. New AI capabilities are NOT added to `server.js` — they go in edge functions only (per `CLAUDE.md`). The Express path is frozen; the duplication does not deepen.
3. Drift between `server.js` and edge functions is acknowledged: the Express endpoints lag the edge functions in features (e.g., `chat-api`'s recipe extraction, intent routing, structured responses). This is acceptable for a dev-only shortcut.
4. The legacy `VITE_OPENROUTER_API_KEY` env var log line at `server.js:6` is harmless (it just logs whether the var is set) and is left in place to avoid pulling on the dependency thread.

## Consequences

### Positive

- `npm run dev:all` continues to work without changes. Existing muscle memory for local dev preserved.
- Avoids a churning retirement effort that would touch package.json scripts, `src/services/embeddingService.js` (only consumer), `src/services/database.js` (only consumer), `backend/rag-api.js`, and `api/rag/search.js` — a multi-file change for a feature with effectively one user.
- Server-side `OPENROUTER_API_KEY` discipline is preserved (no key leakage).

### Negative

- **Feature drift.** Changes to `chat-api` (intent routing, MOP-0008's tool-using agent, schema validation) are NOT mirrored to `server.js`. Anyone testing chat behavior via `dev:all` sees the legacy path, not the production path.
- **Maintenance surface.** Two sets of code paths handle similar concerns. Bug fixes may need to land twice (in practice they rarely do — see drift above).
- **Onboarding confusion.** A new contributor seeing `dev:all` may assume it's the canonical dev workflow and base their mental model on `server.js`'s behavior rather than the edge functions.
- **Dead-adjacent code.** `src/services/embeddingService.js` and `src/services/database.js` exist primarily to support `server.js`. If `server.js` retires, those go with it.

## Alternatives considered

1. **Retire `server.js` now.** *Rejected:* the work (delete file + remove scripts + clean up `embeddingService.js`/`database.js` + verify nothing else breaks) is small but adds churn without unblocking any current task. The drift cost is real but bounded.
2. **Bring `server.js` to feature parity with edge functions.** *Rejected:* would double the maintenance burden permanently. The point of `server.js` is local-dev convenience, not production parity.
3. **Replace `server.js` with `supabase functions serve` documentation.** *Future option:* document the `supabase functions serve` workflow as the canonical local-dev path (currently undocumented). Once the docs exist, `server.js` becomes a clear retirement candidate.

## Trigger for revisit

Retire `server.js` (delete file + remove `npm run server` / `npm run dev:all` scripts + clean up the embeddingService.js + database.js consumers) when **any one** of the following is true:

1. **`supabase functions serve` workflow is documented** in `docs/Development/` as the canonical local-dev AI path.
2. **A feature must be tested against `chat-api`'s current behavior locally** and the gap forces someone to wire `supabase functions serve` anyway. The redundancy then has no defenders.
3. **`server.js`'s n8n webhook chat path stops working** (n8n endpoint goes away, webhook key rotates without update, etc.) and no one cares to fix it.
4. **A new contributor onboards** and the duplication causes a real confusion incident (debug session, wrong mental model, mis-filed bug).
5. **Security drift** — if any future change introduces a divergent secret-handling pattern between `server.js` and edge functions.

Retirement is small enough to handle inline — no MOP required. Track the work in the commit message; reference this ADR with status `superseded` once executed.

## Related

- **CLAUDE.md** — `"npm run dev:all"` is mentioned in the build/dev commands section
- **`server.js`** — root of repo (585 lines)
- **`src/services/embeddingService.js`**, **`src/services/database.js`** — only consumed by `server.js`
- **`backend/rag-api.js`**, **`api/rag/search.js`** — additional consumers worth auditing at retirement
- **AI Integration Audit (2026-06-01)** — surfaced `server.js` as legacy in §1 cleanup discussion
- **ADR-0001** — sibling decision (also a "keep for now, defined triggers for revisit" pattern)
