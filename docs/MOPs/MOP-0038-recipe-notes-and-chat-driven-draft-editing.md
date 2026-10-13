# MOP-0038: Recipe Notes Field + Chat-Driven Draft Recipe Editing

| Field | Value |
|-------|-------|
| **MOP** | MOP-0038 |
| **Title** | Recipe Notes Field + Chat-Driven Draft Recipe Editing |
| **Date Submitted** | 2026-10-13 |
| **Date Updated** | 2026-10-13 |
| **Date Completed** | — |
| **Submitted By** | Nick Neal (via chat session) |
| **Status** | draft |

> Status vocabulary defined in [docs/prompts/MOP_STATUS_LIFECYCLE.md](../prompts/MOP_STATUS_LIFECYCLE.md). Valid values: `draft` / `evaluation` / `approved` / `planned` / `in_progress` / `verifying` / `complete` / `blocked` / `cancelled` / `deferred`.

---

## Summary

Two related feature requests from the same session, bundled because both touch recipe editing surfaces:

1. **A free-text notes field on recipes.** User wants to jot down things like "next time, double the garlic" — a single editable field, not a multi-entry log or per-ingredient annotation (explicitly scoped down from those options during planning).
2. **Chat-driven editing of an unsaved, just-extracted recipe card.** User wants to say "change the garlic to 3 cloves" in chat and have the already-rendered (but not yet saved) recipe card update — as an alternative to clicking directly into the card's fields, which **already works today** (see Investigation below).

A third concern raised in the same message — "I want to be able to reuse chat and say 'new recipe' to trigger a separate recipe extraction, handled correctly with its own card" — was investigated and found to **already work** with no code change needed. See Investigation below. No phase in this MOP addresses it because there is nothing to fix.

---

## Investigation (2026-10-13, before any code written)

**"New recipe in the same session" — already works, no bug found.** `runAgentLoop` ([agent-loop.ts:206-209](../../supabase/functions/chat-api/agent-loop.ts#L206-L209)) declares `lastRecipe`/`lastRecipes` fresh on every single HTTP invocation — there is no server-side state that could leak between messages in the same conversation. `extract_recipe_from_source` always runs a brand-new `recipe-pipeline` extraction scoped to whatever images/text are in the *current* message only; it never references a prior turn's recipe. The prose + card appearing together that prompted this investigation is expected behavior (a short prose intro alongside the full structured card below it — the system prompt's own response-style rules at [recipe-prompts.ts:282](../../supabase/functions/_shared/recipe-prompts.ts#L282) describe exactly this shape), not a carryover bug. **No fix needed; no phase in this MOP addresses it.**

**Direct card editing — already works.** `StructuredRecipeDisplay.tsx` has a full local-edit → `patchDraft` sync loop ([StructuredRecipeDisplay.tsx:342](../../src/components/chat/StructuredRecipeDisplay.tsx#L342) `editingField` state through [:388-402](../../src/components/chat/StructuredRecipeDisplay.tsx#L388-L402) syncing `saveTitle`/`ingredients`/`instructions` into the draft store on every change). `useDraftRecipeStore` ([draftRecipeStore.ts](../../src/stores/draftRecipeStore.ts)) is a `sessionStorage`-backed Zustand store, keyed by `conversationId:messageId:recipeIndex`, purpose-built for exactly this: an unsaved recipe a user is actively tweaking before committing to `save_recipe`. This already covers clicking into a field on the card and typing. **No fix needed for this half; it narrows Phase 2 below to only the chat-driven half.**

**Chat-driven draft editing — does not exist. This is the real gap.** Two blockers, both confirmed by reading the code, not assumed:
1. **No tool exists for it.** `update_recipe` ([catalog.ts:308-355](../../supabase/functions/chat-api/tools/catalog.ts#L308-L355)) requires a `recipe_id` (a persisted, saved recipe) and is `destructive: true` (triggers a confirmation round-trip) — wrong shape entirely for "tweak a draft before I've even saved it." There is no `edit_draft_recipe`-equivalent tool in the catalog.
2. **The server has no visibility into which draft is on-screen.** `draftRecipeStore` is 100% client-side (`sessionStorage`), never sent to the backend. `ToolContext` ([dispatch.ts:19-32](../../supabase/functions/chat-api/tools/dispatch.ts#L19-L32)) has no field for "the current draft recipe." The closest existing channel is `context.recentMessages` (sent from [ChatInterface.tsx:1143-1144](../../src/components/chat/ChatInterface.tsx#L1143-L1144), last 5 messages, which do include `recipe`/`recipes` in their metadata per [ChatInterface.tsx:207-208](../../src/components/chat/ChatInterface.tsx#L207-L208)) — so the *model* can technically see a recently-extracted recipe in conversation history, but there is no tool for it to act on that and no way for a tool result to come back as "apply this patch to the on-screen draft" rather than "here's a brand new recipe to render as a new card."

---

## Scope Map

```
supabase/functions/_shared/recipe-schema.ts
supabase/functions/_shared/recipe-prompts.ts
supabase/functions/chat-api/tools/catalog.ts
supabase/functions/chat-api/tools/handlers.ts
supabase/functions/chat-api/tools/dispatch.ts
supabase/functions/chat-api/agent-loop.ts
supabase/functions/chat-api/index.ts
supabase/migrations/ (new column)
src/stores/draftRecipeStore.ts
src/components/chat/ChatInterface.tsx
src/components/chat/StructuredRecipeDisplay.tsx
src/components/recipes/RecipeForm.tsx
src/components/recipes/RecipeCard.tsx
src/types/ (StructuredRecipe, Recipe)
docs/DATA_MODEL.md
docs/API.md
```

---

## Scope of Work

### Phase 1: Recipe notes field (P2)
**Files affected:** migration, `recipe-schema.ts`, `RecipeForm.tsx`, recipe detail view, `types/`

- Migration: add `notes text null` to `recipes` (and wherever the saved-recipe shape lives — confirm single source of truth during planning, likely one table per `docs/DATA_MODEL.md`). No RLS change needed beyond existing recipe-row policies.
- Add `notes` to the `ExtractedRecipe`/`ValidatedRecipe`/saved-recipe TypeScript shapes.
- UI: a plain textarea on the recipe detail/edit view, labeled "Notes" — not on the extraction card itself (notes are a feature of a *saved* recipe the user revisits, not the one-shot extraction flow). Decide during planning whether the notes field also appears on `RecipeCard.tsx`'s list/grid view (e.g. a small icon indicating a recipe has notes) or only on the detail/edit view.
- Decide during planning: does this field participate in `search_recipes`/full-text search? Reasonable default: yes, same as `description`, but confirm — a private scratch note like "ex's recipe, don't tell anyone" might be something the user does NOT want to be full-text searchable or surfaced in RAG results. If it should be excluded from search/RAG, make that explicit in the migration/schema comment.
- Out of scope for Phase 1 (per user's explicit scope choice): multiple timestamped notes, per-ingredient/per-step annotations. If wanted later, that's a new MOP, not an extension of this field.

### Phase 2: Chat-driven draft recipe editing (P1)
**Files affected:** `catalog.ts`, `handlers.ts`, `dispatch.ts`, `agent-loop.ts`, `chat-api/index.ts`, `recipe-prompts.ts`, `ChatInterface.tsx`, `draftRecipeStore.ts`

This phase needs a planning decision on the round-trip shape before implementation — two viable approaches:

**Option A — client sends current draft as context, server returns a patch, client applies it.**
- Frontend: when sending a chat message, if a draft recipe is currently on-screen in this conversation, include it in the request (new field alongside `context.recentMessages`, e.g. `context.activeDraftRecipe`), sourced from `useDraftRecipeStore.getDraft(draftKey)`.
- Backend: new tool `edit_draft_recipe` (NOT destructive — no confirmation round-trip; it's an unsaved draft, there's nothing to lose) taking a sparse patch shape mirroring `update_recipe`'s `changes` object (title, description, servings, ingredients, instructions, prepTime, cookTime, difficulty, cuisine, tags) minus `recipe_id`.
- The tool handler doesn't touch the database at all — it validates the patch against the draft it was given in `ToolContext` and returns the patch back up through the normal tool-result → `AgentEvent` → SSE pipe, as a new event type (e.g. `{type: "draft_patch", patch: {...}}`) rather than the existing `recipe`/`recipes` events (which mean "here is a brand new recipe to render," wrong semantics for "apply this change to the existing one").
- Frontend: a new `onEvent` branch in `ChatInterface.tsx` that calls `patchDraft` directly — the same function `StructuredRecipeDisplay.tsx` already calls for direct edits, so both edit paths converge on one mechanism.
- System prompt: add a rule to `CHAT_AGENT_SYSTEM_PROMPT` describing when to call `edit_draft_recipe` vs. `update_recipe` vs. `save_recipe` — this three-way distinction (draft/unsaved vs. persisted vs. "save this new one") needs to be unambiguous to the model, or it will misfire (e.g. trying `update_recipe` with a fabricated `recipe_id` on an unsaved draft).

**Option B — re-extraction with an edit instruction folded in, discard-and-replace the card.**
- Simpler to build (no new event type, no `ToolContext` change) but loses any user hand-edits made directly on the card since the last message (re-extracting from the same images with an added instruction would overwrite whatever the user already typed into the card fields). Likely unacceptable given direct editing already exists and users may mix both editing modes in one session.

**Recommendation for planning: Option A.** It's more work but is the only approach that doesn't silently discard direct-edit progress, and it reuses `patchDraft` — the same mechanism direct editing already uses — rather than inventing a second, divergent way to mutate a draft.

- Needs a decision on scope limiting: should `edit_draft_recipe` be restricted to only the most-recently-extracted, still-visible draft in the conversation (simplest, matches "the card I'm looking at"), or should the model be able to target an older draft by name/index if multiple extractions happened earlier in the same long-running conversation? Recommend starting with "most recent draft only" — multi-draft targeting adds real ambiguity (which "it" does "change the garlic" refer to) for a corner case.

---

## Priority

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P1 | Phase 2 — chat-driven draft editing | Medium–Large | High — the actually-requested new capability; needs a real design decision (Option A vs B) before implementation |
| P2 | Phase 1 — notes field | Small | Medium — straightforward additive feature, no architectural ambiguity |

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

  - id: notes-field-in-schema
    type: grep
    path: supabase/functions/_shared/recipe-schema.ts
    pattern: "notes"
    expect: present
    note: Phase 1 — will already match existing per-ingredient notes; tighten pattern during implementation to target the recipe-level field specifically

  - id: edit-draft-recipe-tool-exists
    type: grep
    path: supabase/functions/chat-api/tools/catalog.ts
    pattern: "edit_draft_recipe"
    expect: present
    note: Phase 2, Option A

  - id: edit-draft-recipe-not-destructive
    type: command
    run: "! grep -B5 'edit_draft_recipe' supabase/functions/chat-api/tools/catalog.ts | grep -q 'destructive: true'"
    expect_exit: 0
    note: Phase 2 — must NOT require confirmation; it's an unsaved draft

  # TODO (planning): add a test asserting the agent calls edit_draft_recipe
  # (not update_recipe) when a draft recipe is in context and the user asks
  # for a change with no explicit "save" language. Add a test for the
  # draft_patch SSE event reaching patchDraft in ChatInterface.tsx.
```

Allowed assertion types: `file-exists`, `grep`, `command`, `test-passes`. **Not allowed:** `human`.

## Manual Follow-up (non-blocking)

- [ ] Confirm with the user whether recipe notes should be included in full-text search / RAG results, or kept private to the recipe detail view
- [ ] After Phase 2 ships, test mixing both edit modes in one session: direct-edit a field, then chat-edit a different field, then chat-edit the first field again — confirm no edit is silently lost

---

## Acceptance Criteria

- [ ] All `verification` block items pass (`/verify-mop`)
- [ ] A recipe has an editable `notes` text field, persisted, visible on the recipe detail/edit view
- [ ] A chat message like "change the garlic to 3 cloves" updates the currently-visible unsaved draft card without a confirmation prompt and without discarding other direct edits already made to that draft
- [ ] The system prompt unambiguously distinguishes `edit_draft_recipe` (unsaved, in-session) from `update_recipe` (saved, needs `recipe_id`, destructive) from `save_recipe` (commit a new one)
- [ ] Documentation updated per `/update-docs` procedure

---

## Related

- **ADRs:** none yet — if Option A's draft/saved/new three-way tool-choice ambiguity proves hard to keep the model reliable on, consider an ADR documenting the chosen prompt pattern once implemented
- **MOPs:** MOP-0031 (direct recipe sharing / original draft-card editing work — `draftRecipeStore` and the direct-edit sync loop in `StructuredRecipeDisplay.tsx` likely trace back here; confirm during planning), MOP-0008 (tool-use agent loop this phase extends), MOP-0037 (reasoning panel + recipe delivery ordering — same SSE event pipe this MOP's `draft_patch` event would travel through)
- **Audit / source:** 2026-10-13 chat session, user-requested feature + investigation of a reported co-occurrence "bug" that turned out to be expected behavior

---

## Notes

- Deliberately **draft, no code written** — scoping and investigation only, per this session's working mode.
- The "new recipe in same session" concern that prompted this MOP's investigation turned out not to be a bug. Recorded here rather than silently dropped, so a future session doesn't re-investigate the same non-issue.
- Direct card editing already working means Phase 2's actual net-new surface area is smaller than it first appeared — one tool, one new SSE event type, one prompt rule, one new `onEvent` branch — not a parallel editing system.
