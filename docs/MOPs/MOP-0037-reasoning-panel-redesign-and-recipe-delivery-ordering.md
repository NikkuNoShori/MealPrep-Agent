# MOP-0037: Reasoning Panel Redesign + Recipe/Delta Delivery Ordering

| Field | Value |
|-------|-------|
| **MOP** | MOP-0037 |
| **Title** | Reasoning Panel Redesign + Recipe/Delta Delivery Ordering |
| **Date Submitted** | 2026-10-13 |
| **Date Updated** | 2026-10-13 |
| **Date Completed** | — |
| **Submitted By** | Nick Neal (via chat session, bundled per his request) |
| **Status** | draft |

> Status vocabulary defined in [docs/prompts/MOP_STATUS_LIFECYCLE.md](../prompts/MOP_STATUS_LIFECYCLE.md). Valid values: `draft` / `evaluation` / `approved` / `planned` / `in_progress` / `verifying` / `complete` / `blocked` / `cancelled` / `deferred`.

---

## Summary

Two UX issues observed in the same chat session, bundled here because they touch the same code path (the SSE event stream from `chat-api` to the browser during an agent-loop turn) and the user asked for them to be handled together, with no code movement yet — this MOP is draft-only.

1. **Reasoning panel UX is inverted from the Claude/GPT pattern.** `ReasoningDisplay.tsx` defaults to `expanded: true` while a turn is in progress, showing the full step list open, then collapses to a one-line summary only after streaming ends. The user wants the opposite: collapsed by default with the latest step flashing in the header label, expanding only on click to see the full history — "this feels like we are trying to do that but it's more amateur."
2. **Recipe card arrives visibly later than the prose reply, with no explanation in the UI.** User-observed: a ~30s request where the prose reply appeared, then "a few more seconds" later the recipe card popped in separately. Root cause: `chat-api/index.ts`'s title-generation call (line 436) is `await`'d — despite a comment at line 431 calling it "non-blocking" — before the terminal `recipe` SSE event is enqueued (line 450). The DB insert at line 423 also precedes it. Both delay the `recipe` event well after the model's prose content has already streamed via earlier `delta` events, producing the exact two-stage pop-in the user described.

---

## Scope Map

```
src/components/chat/ReasoningDisplay.tsx
src/components/chat/__tests__/ReasoningDisplay.test.tsx
src/components/chat/ChatInterface.tsx
supabase/functions/chat-api/index.ts
```

---

## Scope of Work

### Phase 1: Reasoning panel redesign (P2)
**Files affected:** `ReasoningDisplay.tsx`, `ReasoningDisplay.test.tsx`

- Default `expanded` to `false`, not `true` ([ReasoningDisplay.tsx:22](../../src/components/chat/ReasoningDisplay.tsx#L22)). Remove the auto-collapse-on-stream-end effect (lines 25-31) — there is no longer an expanded state to collapse out of by default.
- Header label while collapsed and streaming: show the **latest** step's label (already computed as `lastStep?.label` at line 41), with a brief flash/pulse transition each time it updates — not a full re-render that draws attention away from the chat content, something closer to how Claude Code's own status line subtly updates in place.
- Clicking the header still expands to the full step list (existing `<ol>` block, lines 77-110) — this part of the implementation doesn't change, only the default state and the collapsed-state label behavior.
- Decide, during planning: does "collapsed by default" apply even to the very first step of a turn (i.e., never auto-expand, full stop), or does it still start expanded for the first ~1 step and then collapse once more than one step is running? The user's "GPT/Claude session" comparison suggests the former — those products never auto-expand a reasoning/tool-use panel — but confirm before implementing.
- Update `ReasoningDisplay.test.tsx` assertions that currently depend on the `expanded: true` default.

### Phase 2: Synthetic step for vision-model escalation (P2, depends on MOP-0034 5a)
**Files affected:** `chat-api/tools/handlers.ts`, `chat-api/index.ts`

- `recipe-pipeline`'s vision escalation (MOP-0034 Phase 5a, `extract.ts`'s `plausibilityFlags` + retry loop) happens entirely inside one blocking `fetch()` call from `extractRecipeFromSource` ([handlers.ts:306-318](../../supabase/functions/chat-api/tools/handlers.ts#L306-L318)) to `recipe-pipeline/extract-only`. There is currently no channel for `recipe-pipeline` to report "trying 8B... escalating to 72B..." back through `chat-api`'s already-open SSE stream while that fetch is in flight — see "Related: Live cross-service streaming" below, which is explicitly **out of scope** for this MOP per the user's own call.
- **In scope for this MOP:** an *after-the-fact* synthetic step. `recipe-pipeline`'s response can include which model(s) were tried (e.g. `source_metadata.extraction_models_tried: string[]`, `source_metadata.escalated: boolean`) — it already knows this by the time it returns. `extractRecipeFromSource` reads that off the result and `chat-api/index.ts` can then emit an extra `tool_start`/`tool_done` pair (or a single informational event) labeled something like "Escalated to a larger model for better accuracy" immediately after the real `extract_recipe_from_source` tool_done fires. Not live/mid-flight, but visible as a distinct, truthful step rather than invisible.
- Needs its own payload-shape decision during planning: extend `recipe-pipeline`'s `extract-only` response schema, or infer purely from existing fields. Prefer the explicit field — inferring from `source_metadata` shape is fragile.

### Phase 3: Recipe/delta delivery ordering (P1)
**Files affected:** `chat-api/index.ts`

- Move the title-generation call (lines 431-447) so it no longer blocks the terminal event sequence. Options to evaluate during planning:
  - (a) Enqueue `recipe`/`recipes`/`confirmation`/`done` events **before** attempting title generation, then fire title generation as a genuinely fire-and-forget `Promise` (not awaited) that updates the conversation title asynchronously and relies on a separate mechanism (existing conversation-list refetch, or a dedicated `title` SSE event sent whenever it resolves) to update the UI once ready.
  - (b) Run title generation and the DB insert in parallel (`Promise.all`) rather than sequentially, cutting the delay roughly in half without fully decoupling it.
  - (a) is the more complete fix and matches the existing comment's stated intent ("non-blocking") — it just was never actually implemented that way.
- The DB insert (lines 423-429) itself also precedes the `recipe` event and cannot be fully eliminated (the message needs an id before `done` reports `messageId`), but moving title-gen out of the critical path removes the larger of the two delays.
- Decide during planning whether `recipe`/`recipes`/`confirmation` events should move earlier still — e.g., enqueued as soon as `agentReply` resolves (before the DB insert), with the DB-assigned message id patched in later via the `done` event only. This would make the card appear at the same moment the prose finishes, not after any persistence step at all. Weigh against the small risk of the client rendering a recipe for a message that doesn't have a DB id yet if the insert then fails.

---

## Priority

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P1 | Phase 3 — recipe/delta ordering | Small–Medium | High — directly reported by the user, affects every image/URL extraction |
| P2 | Phase 1 — reasoning panel redesign | Small–Medium | Medium — polish/perception, not correctness |
| P2 | Phase 2 — synthetic escalation step | Small | Medium — observability for MOP-0034 5a, no user-facing bug without it |

---

## Verification

> **Lockticket acceptance criteria.** See [MOP_VERIFICATION_POLICY.md](../prompts/MOP_VERIFICATION_POLICY.md) — `type: human` is forbidden. Route domain tests via [DOMAIN_TEST_MATRIX.md](../prompts/DOMAIN_TEST_MATRIX.md).

```yaml
verification:
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

  - id: reasoning-panel-defaults-collapsed
    type: grep
    path: src/components/chat/ReasoningDisplay.tsx
    pattern: "useState(false)"
    expect: present
    note: Phase 1 — adjust pattern to final syntax during implementation; today it is useState(true)

  - id: title-gen-not-blocking-terminal-events
    type: command
    run: "! grep -n 'await openRouter.chat' supabase/functions/chat-api/index.ts | grep -B2 -A2 'Generate a very short title'"
    expect_exit: 0
    note: Phase 3 — placeholder check; finalize exact assertion once the chosen approach (a vs b) is implemented

  # TODO (planning): add a DOM/interaction test asserting the reasoning panel
  # does not auto-expand on first tool_start, and that clicking the header
  # toggles it. Add an integration-style test (or manual follow-up) for
  # Phase 3's event ordering, since it's timing-dependent and hard to assert
  # deterministically in a unit test.
```

Allowed assertion types: `file-exists`, `grep`, `command`, `test-passes`. **Not allowed:** `human`.

## Manual Follow-up (non-blocking)

- [ ] Re-test the exact pickle-soup upload flow after Phase 3 ships; confirm the recipe card appears at the same time as (or immediately after) the prose reply, not several seconds later
- [ ] Visually compare the redesigned reasoning panel against Claude Code's / ChatGPT's own tool-use step indicators for the "flashing latest step in a collapsed header" behavior

---

## Acceptance Criteria

- [ ] All `verification` block items pass (`/verify-mop`)
- [ ] Reasoning panel starts collapsed; latest step label updates in the collapsed header as new steps start
- [ ] Expanding the panel shows the full step history for the current turn
- [ ] A vision-model escalation (MOP-0034 5a firing) surfaces as a visible, labeled step — even if only after the fact, not live
- [ ] The recipe card is enqueued without waiting on title generation
- [ ] Documentation updated per `/update-docs` procedure

---

## Related

- **ADRs:** none
- **MOPs:** MOP-0034 (Phase 5a is what Phase 2 of this MOP makes visible), MOP-0020 (original reasoning-display implementation, which this MOP revises)
- **Out of scope, explicitly deferred by the user:** true live cross-service streaming of `recipe-pipeline`'s internal retry/escalation progress back through `chat-api`'s SSE connection while the extraction is still in flight. Today, `extract_recipe_from_source` is one blocking `fetch()` ([handlers.ts:306-318](../../supabase/functions/chat-api/tools/handlers.ts#L306-L318)); the browser-to-`chat-api` leg is genuine SSE, but the `chat-api`-to-`recipe-pipeline` leg is not. Making the latter stream (via a callback URL, shared realtime channel, or similar) is real architecture work and needs its own MOP when prioritized.
- **Audit / source:** 2026-10-13 chat session, user-reported during MOP-0034 retesting

---

## Notes

- Deliberately **draft, no code written** — the user asked to bundle these into a MOP for later, not to start implementation now.
- Phase 3's root cause was found by reading `chat-api/index.ts` directly during this session: the comment at line 431 says "Generate title (non-blocking)" but the call is `await`'d on the next line, so it is in fact blocking. This mismatch between comment and behavior is itself worth fixing regardless of which ordering approach is chosen.
