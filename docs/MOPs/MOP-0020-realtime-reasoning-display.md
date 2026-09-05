# MOP-0020: Realtime Reasoning Display

| Field | Value |
|-------|-------|
| **MOP** | MOP-0020 |
| **Title** | Realtime Reasoning Display — Tool Step Visibility in Chat |
| **Date Submitted** | 2026-09-05 |
| **Date Updated** | 2026-09-05 |
| **Date Completed** | — |
| **Submitted By** | Nick Neal |
| **Status** | approved |

> Status vocabulary defined in [docs/prompts/MOP_STATUS_LIFECYCLE.md](../prompts/MOP_STATUS_LIFECYCLE.md).

---

## Summary

The chat agent runs tool calls silently before streaming the final answer — users see "Thinking…" for 5–15 seconds with no feedback on what's happening. This MOP adds a collapsible reasoning panel to each AI message bubble (à la Claude/ChatGPT/VS Code) that streams live tool-step progress during the agent loop: each tool invocation appears as a step with a human-readable label, duration, and status indicator. The panel collapses to the last active step when closed, and transitions automatically to the final text reply once streaming begins. Tool step events (`tool_start`, `tool_done`) are emitted via the existing MOP-0017 SSE channel — no new transport infrastructure needed.

---

## Scope Map

```
supabase/functions/chat-api/agent-loop.ts
supabase/functions/chat-api/index.ts
supabase/functions/_shared/openrouter-client.ts
src/services/api.ts
src/components/chat/ReasoningDisplay.tsx          (new)
src/components/chat/ChatInterface.tsx
src/components/chat/MessageBubble.tsx             (if exists, else inline in ChatInterface)
e2e/reasoning-display.spec.ts                     (new)
src/components/chat/__tests__/ReasoningDisplay.test.tsx  (new)
docs/API.md
docs/ARCHITECTURE.md
docs/CHANGELOG.md
```

---

## Scope of Work

### Phase 1: SSE event types — `tool_start` / `tool_done`

**Files affected:**
- `src/services/api.ts` — extend `SSEEvent` union
- `supabase/functions/chat-api/agent-loop.ts` — emit events during dispatch loop
- `supabase/functions/chat-api/index.ts` — pass extended event emitter into loop

Extend the `AgentLoopInput` interface:

```ts
onEvent?: (event: AgentEvent) => void;   // replaces onDelta

export type AgentEvent =
  | { type: "delta";      text: string }
  | { type: "tool_start"; name: string; label: string; index: number }
  | { type: "tool_done";  name: string; ok: boolean; durationMs: number; index: number };
```

In `agent-loop.ts`, before each `dispatchTool` call emit `tool_start`; after, emit `tool_done`. The `onDelta` parameter becomes `onEvent` (backwards-compatible: callers that only used `onDelta` pass a wrapper).

**Human-readable label map** (in `agent-loop.ts`):
```ts
const TOOL_LABELS: Record<string, string> = {
  search_recipes:              "Searching your recipes…",
  find_similar_recipes:        "Finding similar recipes…",
  extract_recipe_from_source:  "Fetching recipe from URL…",
  get_household_recipes:       "Checking household recipes…",
  get_household_profile:       "Loading household profile…",
  get_meal_plan:               "Checking your meal plan…",
  assign_recipe_to_meal_plan_slot: "Scheduling meal…",
  add_to_grocery_list:         "Adding to grocery list…",
  get_grocery_list:            "Loading grocery list…",
  mark_grocery_item_purchased: "Marking item purchased…",
  remove_grocery_item:         "Removing grocery item…",
  propose_substitution:        "Finding substitutions…",
  check_recipe_safety:         "Checking allergens and safety…",
  update_member_allergens:     "Updating allergen profile…",
  get_recommendations:         "Getting recommendations…",
  react_to_recipe:             "Saving reaction…",
  scale_recipe:                "Scaling recipe…",
  save_recipe:                 "Saving recipe to library…",
  update_recipe:               "Preparing recipe update…",
  delete_recipe:               "Preparing to delete recipe…",
  web_search_recipe:           "Searching the web…",
  extract_recipe_from_text:    "Extracting recipe…",
  create_meal_plan:            "Creating meal plan…",
  clear_meal_plan_slot:        "Clearing meal slot…",
};
```

`index.ts`: the streaming `ReadableStream` branch already calls `onDelta` as a callback — replace with `onEvent`, emit `tool_start`/`tool_done` frames via `sseEvent()` alongside `delta` frames.

### Phase 2: Frontend SSE event handling

**Files affected:**
- `src/services/api.ts`

Extend `SSEEvent` union:
```ts
| { type: "tool_start"; name: string; label: string; index: number }
| { type: "tool_done";  name: string; ok: boolean; durationMs: number; index: number }
```

`sendMessageStream` already dispatches all frame types to `onEvent` — no change needed to the reader loop.

In `ChatInterface`, accumulate tool steps alongside `streamedContent`:
```ts
type ToolStep = { name: string; label: string; ok?: boolean; durationMs?: number; done: boolean };
let toolSteps: ToolStep[] = [];
// tool_start → push {name, label, done:false}
// tool_done  → update step at index: {ok, durationMs, done:true}
```

Pass `toolSteps` into the thinking-placeholder message so `ReasoningDisplay` can render live state:
```ts
{ ...m, content: streamedContent, toolSteps, isThinking: toolSteps.length > 0 && !streamedContent }
```

### Phase 3: `ReasoningDisplay` component

**Files affected:**
- `src/components/chat/ReasoningDisplay.tsx` (new)
- `src/components/chat/ChatInterface.tsx` (render inside AI bubble)

**Visual design:**
- Sits above the prose text in the AI bubble, below the avatar.
- **Collapsed (default):** Single line. Spinner if in-progress, checkmark if done. Last active step label. Chevron to expand.
- **Expanded:** Scrollable list of steps. Each step: icon (spinner / ✓ / ✗), tool label, duration badge (shown after done). Steps animate in with a subtle fade.
- **Transition:** When first `delta` arrives, reasoning panel animates to collapsed state automatically if it was expanded.
- **Persist after done:** The completed reasoning panel stays collapsible on the finished message. Collapsed by default. User can expand to review what tools ran.

**Props:**
```ts
interface ReasoningDisplayProps {
  steps: ToolStep[];
  isStreaming: boolean;   // true while SSE stream is open
}
```

**States:**
- `streaming + steps.length === 0` → hidden (no tool calls started yet)
- `streaming + steps.length > 0` → show live, auto-expanded or collapsed per user pref
- `!streaming + steps.length > 0` → show collapsed summary "Ran N steps"
- `!streaming + steps.length === 0` → hidden

### Phase 4: Unit tests

**Files affected:**
- `src/components/chat/__tests__/ReasoningDisplay.test.tsx` (new)

Vitest + React Testing Library tests:
- Hidden when no steps.
- Shows spinner for in-progress step.
- Shows checkmark for completed step.
- Shows duration badge after `tool_done`.
- Expand/collapse toggle works.
- Error step (ok=false) shows error indicator.
- Auto-collapses when `isStreaming` transitions to false with steps present.

### Phase 5: E2E tests (Playwright)

**Files affected:**
- `e2e/reasoning-display.spec.ts` (new)

See **Testing Requirements** below.

### Phase 6: Documentation

**Files affected:**
- `docs/API.md` — document `tool_start`/`tool_done` SSE event types on `/chat-api/message`
- `docs/ARCHITECTURE.md` — extend SSE Streaming section with tool event types
- `docs/CHANGELOG.md` — user-visible entry

---

## Priority

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P0 | Phase 1: SSE `tool_start`/`tool_done` events from agent loop | Small | High |
| P0 | Phase 2: Frontend SSE handling + step accumulation | Small | High |
| P1 | Phase 3: `ReasoningDisplay` component | Medium | High — UX payoff |
| P1 | Phase 4: Unit tests | Small | Medium |
| P1 | Phase 5: E2E tests | Small | Medium |
| P2 | Phase 6: Documentation | Small | Low |

---

## Testing Requirements

### Definition of Done

A reasoning display is **done** when:
1. Any AI response that involved at least one tool call shows a reasoning panel on the message bubble.
2. During streaming: steps appear in real-time with a spinner as each tool runs.
3. After a tool completes: its step updates to show ✓ or ✗ and the duration.
4. The panel collapses automatically when the prose text starts streaming.
5. The collapsed panel shows the step count and can be manually expanded after the response is complete.
6. Zero-tool responses (pure text replies) show no reasoning panel.
7. All E2E tests pass. All unit tests pass. Lint and build clean.

### Playwright E2E Test Checklist (`e2e/reasoning-display.spec.ts`)

| ID | Scenario | Assertion |
|----|----------|-----------|
| `reasoning-01` | Send a message that triggers a tool call (e.g. "search my recipes for pasta") | Reasoning panel visible during response |
| `reasoning-02` | At least one step label appears while streaming | Step label text present in DOM |
| `reasoning-03` | Panel collapses when prose text begins | Panel in collapsed state once text appears |
| `reasoning-04` | Expand toggle opens full step list | All steps visible after click |
| `reasoning-05` | Completed response has persisted reasoning panel | Panel still present after `done` event |
| `reasoning-06` | Pure text response (no tools) has no reasoning panel | Panel element absent |
| `reasoning-07` | Error step shown for a failed tool | Error indicator visible |

### Unit Test Checklist (`src/components/chat/__tests__/ReasoningDisplay.test.tsx`)

| ID | What to test |
|----|-------------|
| `unit-01` | No steps → component returns null |
| `unit-02` | One in-progress step → spinner visible |
| `unit-03` | One done step → checkmark + duration badge |
| `unit-04` | One failed step (ok=false) → error indicator |
| `unit-05` | Expand/collapse toggle |
| `unit-06` | isStreaming false + steps present → collapsed summary |
| `unit-07` | Multiple steps render in order |

---

## Verification

```yaml
verification:
  - id: tool-start-event-in-agent-loop
    type: grep
    path: supabase/functions/chat-api/agent-loop.ts
    pattern: 'tool_start'
    expect: present

  - id: tool-done-event-in-agent-loop
    type: grep
    path: supabase/functions/chat-api/agent-loop.ts
    pattern: 'tool_done'
    expect: present

  - id: tool-labels-map-exists
    type: grep
    path: supabase/functions/chat-api/agent-loop.ts
    pattern: 'TOOL_LABELS'
    expect: present

  - id: sse-event-types-extended
    type: grep
    path: src/services/api.ts
    pattern: 'tool_start'
    expect: present

  - id: reasoning-display-component-exists
    type: file-exists
    path: src/components/chat/ReasoningDisplay.tsx

  - id: reasoning-display-rendered
    type: grep
    path: src/components/chat/ChatInterface.tsx
    pattern: 'ReasoningDisplay'
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

  - id: reasoning-unit-suite
    type: command
    run: npm run test:run -- src/components/chat/__tests__/ReasoningDisplay.test.tsx
    expect_exit: 0

  - id: e2e-reasoning-suite
    type: command
    run: npm run test:e2e -- e2e/reasoning-display.spec.ts
    expect_exit: 0
```

## Manual Follow-up (non-blocking)

- [ ] UX review: animation timing, collapsed label wording, step duration formatting
- [ ] Verify step labels feel natural for all 23 tool names in real conversations
- [ ] Check that reasoning panel does not visually crowd short replies

---

## Acceptance Criteria

- [ ] All `verification` block items pass (`/verify-mop MOP-0020`)
- [ ] Tool calls emit `tool_start`/`tool_done` SSE events during streaming responses
- [ ] `ReasoningDisplay` renders during streaming with live step updates
- [ ] Panel collapses automatically when prose text starts streaming
- [ ] Completed responses persist a collapsible reasoning panel
- [ ] Zero-tool responses show no reasoning panel
- [ ] All 7 Playwright E2E test cases pass (`e2e/reasoning-display.spec.ts`)
- [ ] All 7 unit tests pass (`ReasoningDisplay.test.tsx`)
- [ ] `data-testid` on reasoning panel (`reasoning-panel`), step list (`reasoning-steps`), toggle (`reasoning-toggle`)
- [ ] Documentation updated per `/update-docs` procedure
- [ ] CHANGELOG entry added

---

## Related

- **MOPs:** MOP-0017 (SSE streaming — this MOP extends the same event channel), MOP-0019 (batch import — both emit structured events over SSE)
- **ADRs:** None
- **Audit / source:** User request 2026-09-05 — "like how ChatGPT and Claude and VS Code does"

---

## Notes

**Backwards compatibility:** `onDelta` in `AgentLoopInput` becomes `onEvent`. Non-streaming callers that pass no callback are unaffected. The streaming path in `index.ts` already wraps `onDelta` in a closure — replace with `onEvent` emitting the full `AgentEvent` union.

**Performance:** `tool_start`/`tool_done` frames are tiny JSON objects (~100 bytes each). Even 5 tool calls = 10 extra frames — negligible overhead on the SSE channel.

**User preference:** Consider persisting the expand/collapse preference to `localStorage` so power users who always want to see steps don't have to re-expand each time.
