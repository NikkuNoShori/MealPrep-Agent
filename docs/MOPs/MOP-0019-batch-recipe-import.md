# MOP-0019: Batch Recipe Import

| Field | Value |
|-------|-------|
| **MOP** | MOP-0019 |
| **Title** | Batch Recipe Import — SSE-Streamed Multi-URL Extraction |
| **Date Submitted** | 2026-09-05 |
| **Date Updated** | 2026-09-05 |
| **Date Completed** | — |
| **Submitted By** | Nick Neal |
| **Status** | approved |

> Status vocabulary defined in [docs/prompts/MOP_STATUS_LIFECYCLE.md](../prompts/MOP_STATUS_LIFECYCLE.md).

---

## Summary

Users frequently need to import multiple recipes at once (45+ URLs from bookmarks, recipe blogs, Reddit threads, etc.). The current `extract_recipe_from_source` tool handles one URL per agent turn — serial, limited by `MAX_ITERS=5`, and with no progress visibility. This MOP builds a dedicated `POST /chat-api/batch-extract` endpoint that accepts up to 50 URLs, fires parallel extraction via `recipe-pipeline/extract-only`, streams SSE progress events as each recipe completes, renders a live card per result, and batches saves behind a single confirmation. Designed to handle Nick's real workload of 45 URLs.

---

## Scope Map

```
supabase/functions/chat-api/batch-extract.ts      (new)
supabase/functions/chat-api/index.ts              (register route)
src/services/api.ts                               (batchImport client method)
src/components/chat/BatchImportPanel.tsx          (new UI)
src/components/chat/BatchImportCard.tsx           (new — per-recipe progress card)
src/components/chat/ChatInterface.tsx             (wire panel into composer area)
e2e/batch-import.spec.ts                          (new E2E suite)
src/services/__tests__/batchImport.test.ts        (new unit tests)
docs/API.md
docs/ARCHITECTURE.md
docs/CHANGELOG.md
```

---

## Scope of Work

### Phase 1: Edge Function — `batch-extract` route

**Files affected:**
- `supabase/functions/chat-api/batch-extract.ts` (new)
- `supabase/functions/chat-api/index.ts`

Build `POST /functions/v1/chat-api/batch-extract`.

**Request body:**
```json
{
  "urls": ["https://...", "https://..."],
  "auto_save": false
}
```

**Behaviour:**
- Auth via Supabase JWT (same as `/message`). Rejects unauthenticated requests.
- Validates: array of 1–50 string URLs. Returns 400 for empty or oversized input.
- Returns `Content-Type: text/event-stream` immediately (no buffering).
- Fires `Promise.allSettled()` across all URLs, each calling `recipe-pipeline/extract-only` with a 50s per-URL timeout (`AbortSignal.timeout(50_000)`).
- As each settles (success or failure), enqueues an SSE frame:

```
data: {"type":"progress","index":0,"total":5,"url":"https://...","status":"extracting"}
data: {"type":"result","index":0,"url":"https://...","recipe":{...}}
data: {"type":"error","index":2,"url":"https://...","message":"Could not fetch page"}
data: {"type":"done","total":5,"succeeded":4,"failed":1}
```

- Frames arrive as each URL resolves — not buffered until all finish.
- Chunked into waves of 10 for inputs > 10 URLs to respect Supabase's 150s wall-clock limit: fire wave 1 (URLs 0–9), stream results, fire wave 2 (URLs 10–19), etc.
- Register route in `index.ts`: `if (url.pathname.endsWith("/batch-extract"))`.

### Phase 2: Frontend client method

**Files affected:**
- `src/services/api.ts`

Add `apiClient.batchImport(urls, callbacks)`:
- Sends `POST /chat-api/batch-extract` with `Accept: text/event-stream`.
- SSE reader loop identical to `sendMessageStream` pattern.
- Callback types:

```ts
export type BatchSSEEvent =
  | { type: "progress"; index: number; total: number; url: string; status: "extracting" }
  | { type: "result";   index: number; url: string; recipe: any }
  | { type: "error";    index: number; url: string; message: string }
  | { type: "done";     total: number; succeeded: number; failed: number };

export type BatchImportCallbacks = {
  onEvent: (event: BatchSSEEvent) => void;
};
```

### Phase 3: UI — BatchImportPanel + BatchImportCard

**Files affected:**
- `src/components/chat/BatchImportPanel.tsx` (new)
- `src/components/chat/BatchImportCard.tsx` (new)
- `src/components/chat/ChatInterface.tsx`

**BatchImportPanel** — triggered by a "Import multiple URLs" button in the chat composer area (or a `/import` slash command in the chat input):
- Textarea for pasting URLs (one per line, or space/comma separated).
- URL count badge: "12 URLs detected".
- Validate button — checks format, dedupes, shows list preview.
- Import button — starts the SSE stream.
- Progress header: "Extracting 12 recipes… (3 done, 9 remaining)".
- Live card list: renders a `BatchImportCard` per URL as results arrive — cards appear in real-time, not after all finish.
- Error cards shown inline for failed URLs with a "Retry" affordance.
- "Save all (N recipes)" button — enabled once ≥1 result; uses existing `save_recipe` flow per card.
- "Save selected" checkbox mode for cherry-picking.
- Dismiss button — cancels in-flight requests via `AbortController`.

**BatchImportCard** — per-recipe card with states:
- `extracting` — pulsing skeleton with URL label
- `done` — recipe title, thumbnail (if any), ingredient count, "Edit" and "Save" actions
- `error` — URL label + error message + "Retry" button

**ChatInterface wiring:**
- "Import URLs" button in the composer toolbar (beside image attach).
- Opens `BatchImportPanel` as an overlay/drawer above the input area.
- Does NOT go through the agent loop — bypasses `handleSendMessage` entirely.
- After a successful batch save, posts a summary message into the conversation: "I saved 12 recipes from your import. Here's a summary: …"

### Phase 4: Unit tests

**Files affected:**
- `src/services/__tests__/batchImport.test.ts` (new)

Vitest unit tests covering:
- `batchImport` SSE parser: correct parsing of `progress`, `result`, `error`, `done` frames.
- Malformed frame skipping (parser resilience).
- `AbortSignal` cancellation mid-stream.
- URL deduplication in the panel (if logic lives in a utility).
- Edge: 0 URLs → validation error. 51 URLs → truncation or error.

### Phase 5: E2E tests (Playwright)

**Files affected:**
- `e2e/batch-import.spec.ts` (new)

See **Testing Requirements** section below for full spec.

### Phase 6: Documentation

**Files affected:**
- `docs/API.md` — new `POST /chat-api/batch-extract` section with request/response/SSE frame types
- `docs/ARCHITECTURE.md` — Batch Import section (parallel extraction, wave chunking)
- `docs/CHANGELOG.md` — user-visible entry

---

## Priority

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P0 | Phase 1: `batch-extract` edge function | Medium | High — unblocks all downstream |
| P0 | Phase 2: `batchImport` client method | Small | High |
| P1 | Phase 3: BatchImportPanel + BatchImportCard UI | Medium | High — UX payoff |
| P1 | Phase 4: Unit tests | Small | Medium |
| P1 | Phase 5: E2E tests | Medium | High — required for `complete` |
| P2 | Phase 6: Documentation | Small | Medium |

---

## Testing Requirements

### Definition of Done

A batch import is **done** when:
1. A user can paste ≥1 URL into the panel and trigger extraction.
2. Recipe cards appear in real-time as each URL resolves — not all at once at the end.
3. Failed URLs show an error card with a retry affordance; they do not block successful cards from appearing.
4. At least one "Save" path works: either "Save all" or per-card save persists the recipe to the DB and is queryable via the API.
5. An `AbortController` cancel mid-stream stops further extraction and leaves already-completed cards intact.
6. The wave-chunking strategy handles a 45-URL input without hitting the 150s wall-clock ceiling.
7. All E2E tests in the Playwright suite pass.
8. All unit tests pass.
9. Lint and build are clean.

### Playwright E2E Test Checklist (`e2e/batch-import.spec.ts`)

> Tests run against the live Supabase project (same auth fixture as `e2e/fixtures/auth.ts`). MSW is NOT used for E2E — real `recipe-pipeline/extract-only` calls are made or the suite uses URL fixtures that are known-good (e.g. a static test page on a controlled domain, or a mock server started in `global-setup`).
>
> Where live network calls are impractical in CI, seed the `batch-extract` route with a `TEST_MODE=true` env flag that returns fixture responses instead of calling `recipe-pipeline`. Document this in the test file.

#### Required test cases

| ID | Scenario | Assertion |
|----|----------|-----------|
| `batch-01` | Panel opens via toolbar button | Panel visible, textarea focused |
| `batch-02` | URL detection — 3 newline-separated URLs | Badge shows "3 URLs" |
| `batch-03` | URL detection — mixed comma/space/newline | Correctly counts distinct URLs |
| `batch-04` | Duplicate URLs deduplicated | Panel shows count after dedup |
| `batch-05` | Import starts — progress header appears | "Extracting N recipes…" visible |
| `batch-06` | First card appears before all complete | Card visible while spinner still shown for others |
| `batch-07` | Error URL shows error card | Error card with message; does not block other cards |
| `batch-08` | "Save all" saves N recipes to DB | After save, recipes appear in Recipes page |
| `batch-09` | Per-card "Save" saves one recipe | Recipe appears in Recipes page; others unchanged |
| `batch-10` | Abort mid-stream stops extraction | Cards already complete stay; progress stops |
| `batch-11` | 0 URLs → validation error shown | Import button disabled or error message |
| `batch-12` | 51 URLs → capped or error shown | UI communicates limit |
| `batch-13` | Summary chat message posted after batch save | Conversation shows "I saved N recipes…" |
| `batch-14` | Panel dismisses cleanly with no orphaned state | Reopening panel is empty |

#### Test infrastructure notes

- Reuse the `goToFreshChat` fixture from `e2e/chat.spec.ts` for auth setup.
- Each test that saves recipes must clean up via `supabase.from('recipes').delete().eq('user_id', ...)` in `afterEach` to avoid cross-test pollution.
- Use `data-testid` attributes on: panel container (`batch-import-panel`), URL textarea (`batch-url-input`), URL count badge (`batch-url-count`), import button (`batch-import-btn`), progress header (`batch-progress-header`), individual cards (`batch-card-{index}`), save-all button (`batch-save-all`), abort button (`batch-abort`).

### Unit Test Checklist (`src/services/__tests__/batchImport.test.ts`)

| ID | What to test |
|----|-------------|
| `unit-01` | SSE parser: `progress` frame → correct callback shape |
| `unit-02` | SSE parser: `result` frame → recipe object passed through |
| `unit-03` | SSE parser: `error` frame → error object passed through |
| `unit-04` | SSE parser: `done` frame → totals correct |
| `unit-05` | Malformed JSON frame skipped; stream continues |
| `unit-06` | `AbortSignal` already-aborted before fetch → immediate rejection |
| `unit-07` | URL parse: blank lines and duplicates stripped |

---

## Verification

```yaml
verification:
  - id: batch-extract-route-exists
    type: grep
    path: supabase/functions/chat-api/index.ts
    pattern: 'batch-extract'
    expect: present

  - id: batch-extract-handler-exists
    type: file-exists
    path: supabase/functions/chat-api/batch-extract.ts

  - id: batch-import-client-exists
    type: grep
    path: src/services/api.ts
    pattern: 'batchImport'
    expect: present

  - id: batch-import-panel-exists
    type: file-exists
    path: src/components/chat/BatchImportPanel.tsx

  - id: batch-import-card-exists
    type: file-exists
    path: src/components/chat/BatchImportCard.tsx

  - id: sse-done-event
    type: grep
    path: supabase/functions/chat-api/batch-extract.ts
    pattern: '"done"'
    expect: present

  - id: wave-chunking
    type: grep
    path: supabase/functions/chat-api/batch-extract.ts
    pattern: 'wave\|chunk\|slice\|WAVE_SIZE'
    expect: present

  - id: abort-signal
    type: grep
    path: supabase/functions/chat-api/batch-extract.ts
    pattern: 'AbortSignal'
    expect: present

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

  - id: e2e-batch-suite
    type: command
    run: npm run test:e2e -- e2e/batch-import.spec.ts
    expect_exit: 0
```

## Manual Follow-up (non-blocking)

- [ ] Smoke test with real 45-URL payload (Nick's actual bookmarks) — verify wave chunking holds under real-world latency
- [ ] Check Supabase function logs for any timeout errors on wave boundaries
- [ ] UX review: card animation timing, save-all confirmation wording

---

## Acceptance Criteria

- [ ] All `verification` block items pass (`/verify-mop MOP-0019`)
- [ ] `/integrity-check` passes for chat domain
- [ ] A user can paste 45 URLs and all extract within the wave chunking strategy (no wall-clock timeout)
- [ ] Cards appear in real-time as each URL resolves (not all at once)
- [ ] Failed URLs do not block successful cards
- [ ] "Save all" persists all successful recipes to the DB
- [ ] Per-card save works independently
- [ ] Abort mid-stream stops extraction and preserves completed cards
- [ ] All 14 Playwright E2E test cases pass (`e2e/batch-import.spec.ts`)
- [ ] All 7 unit tests pass (`src/services/__tests__/batchImport.test.ts`)
- [ ] `data-testid` attributes present on all required elements
- [ ] Documentation updated per `/update-docs` procedure
- [ ] CHANGELOG entry added
- [ ] 45-URL smoke test passes (manual follow-up, non-blocking for `complete`)

---

## Related

- **MOPs:** MOP-0017 (SSE streaming — same `ReadableStream`/SSE pattern reused), MOP-0018 (tool catalog — `extract_recipe_from_source` is the single-URL predecessor)
- **ADRs:** None yet — if wave-chunking strategy produces a non-obvious tradeoff, consider ADR-0004
- **Audit / source:** Nick Neal — 45 URL import requirement, 2026-09-05 session

---

## Notes

**Wave chunking strategy:** Supabase Edge Functions cap at 150s wall-clock. Each URL extraction takes 5–20s. At 10 concurrent URLs × 20s worst case = 200s — over the limit. Waves of 10 URLs each: wave finishes in ≤20s, streaming intermediate results, then fire next wave. For 45 URLs: 5 waves × ≤20s = ≤100s total, well within the ceiling.

**`auto_save` flag:** Phase 1 always sends `auto_save: false` to `recipe-pipeline/extract-only` (preview mode). Save is always an explicit user action from the UI. A future phase could add an `auto_save: true` fast-import mode.

**Recipe deduplication:** If the same recipe URL appears twice in the input (or was previously imported), the edge function does not deduplicate — it extracts and returns both. Deduplication at save time is handled by the existing similar-recipe check in `recipe-pipeline/load.ts`. The UI deduplicates URLs before sending.

**No agent loop involvement:** This route bypasses `runAgentLoop` entirely. It is a direct pipeline call, not a chat turn. The summary message posted to the conversation after a batch save is generated client-side (not by the LLM) to avoid the round-trip cost.
