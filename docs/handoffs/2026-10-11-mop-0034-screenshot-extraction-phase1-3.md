# MOP-0034 Screenshot Extraction Accuracy (Phases 1–3, partial) — 2026-10-11

## Summary
This fills in context the same-day `2026-10-11-mop-0032-qol-batch-1-complete.md`
entry correctly flagged as unidentified: the large set of uncommitted,
non-MOP-0032 file changes it listed under "likely MOP-0029 or MOP-0034 work in
progress" are **MOP-0034** (screenshot/image recipe extraction accuracy),
**not** MOP-0029 color-token work. This session picked up MOP-0034 a week
after it was opened, continued Phase 3, and is handing off mid-phase.

Background: a user report that screenshot extraction was inaccurate led to a
`recipe-pipeline-sme` audit (14 bugs + a documentation gap), triaged by
`surface-reviewer` into **ADR-0007** (absence/provenance semantics),
**MOP-0034** (6-phase fix plan, this file's subject), and **MOP-0035**
(per-modality requirements spec, not started). See
`docs/MOPs/MOP-0034-screenshot-extraction-accuracy.md` for the full plan and
`docs/DECISIONS/ADR-0007-extraction-absence-and-provenance-semantics.md` for
the absence/`warnings` decision this MOP implements.

## What changed (committed)

Nothing from MOP-0034 is committed yet. The only extraction-pipeline-adjacent
commit in history is `87d7bec` (`fix(chat-api): remove invalid created_by
field from save_recipe insert`), which is unrelated — a separate P0 bug fix
from the MOP-0032 session, already documented in that session's handoff entry.

One thing worth correcting in that same-day MOP-0032 entry: it says "the
current session only touched `handlers.ts`," which is accurate for *that*
session, but `handlers.ts` itself has no uncommitted diff right now (confirmed
via `git diff` — empty) because the `attachedImagesCaption` passthrough
(MOP-0034 Phase 1e) is already baked into HEAD's version of that file. That
change must have landed in `fc61c7f` or an earlier commit before this
handoff's session started; it is **not** still in flight.

## Uncommitted / in-flight

Current `git status` (verified just now) shows these MOP-0034 files modified,
all from this MOP's Phases 1–3, all mine from this and the prior session one
week ago — not MOP-0029:

- `supabase/functions/_shared/recipe-prompts.ts` — Phase 1 (done, see below)
- `supabase/functions/recipe-pipeline/stages/extract.ts` — Phase 1 (done)
- `supabase/functions/recipe-pipeline/stages/extract_test.ts` — Phase 1 (done)
- `supabase/functions/chat-api/__tests__/test-helpers.ts` — Phase 1 (done)
- `supabase/functions/chat-api/tools/dispatch.ts` — Phase 1 (done, `attachedImagesCaption` type)
- `supabase/functions/chat-api/index.ts` — Phase 1 (done, caption wiring)
- `src/components/chat/ChatInterface.tsx` — Phase 2 (done) + no Phase 3 changes yet
- `supabase/functions/_shared/openrouter-client.ts` — **Phase 3, partial** (see below)
- `supabase/functions/_shared/recipe-schema.ts` — **Phase 3, partial** (see below)
- `supabase/functions/recipe-pipeline/adapters/text-adapter.ts` — **Phase 3, partial** (done for this file)
- `docs/MOPs/MOP-0012.md`, `docs/MOPs/MOP-0032-qol-backlog-batch-1.md` — surface-reviewer's cross-reference notes, not code
- `docs/prompts/DOCUMENTATION_UPDATE_PROCEDURE.md`, `.claude/agents/agents-log.md`, `.claude/settings.local.json` — ambient/tooling, not MOP-0034 content

Untracked, also mine, not yet registered:
- `docs/DECISIONS/ADR-0007-extraction-absence-and-provenance-semantics.md`
- `docs/MOPs/MOP-0034-screenshot-extraction-accuracy.md`
- `docs/MOPs/MOP-0035-extraction-requirements-spec.md`

The files the MOP-0032 entry flagged as unexplained (`GroceryCart.tsx`,
`RecipeList.tsx`, `index.css`, `Admin.tsx`, `InviteAccept.tsx`,
`themeStore.ts`, `package.json`, `.color-baseline.json`,
`scripts/check-color-governance.js`) are confirmed **not** mine across two
sessions now — flagged and left untouched both times. They're most likely
MOP-0029 Phase 8/9 (color governance) in-progress work, per that MOP's commit
`492f7c7` now in HEAD. Still unverified; still don't touch them without
checking with the user first.

### Phase-by-phase status

**Phase 1 — prompt/filter fixes: done, verified.**
- Removed the image prompt's "infer missing metadata" contradiction; both
  prompts now say null when a field is absent.
- Removed realistic few-shot example values (`prepTime:15, servings:4,
  difficulty:"easy"` → `null`) so the 8B vision model can't copy them.
- Fixed the instruction-noise filter: previously dropped any step ≤3 words or
  starting with "Garnish with"/"Serve immediately" (deleting real steps like
  "Bake 20 minutes."). Now only drops a step if the **entire** trimmed step is
  pure filler ("Enjoy!", "Dig in!", "Bon appétit").
- Added a shared `RECIPE_FIELD_RULES` block interpolated into both the text
  and image prompts (fraction→decimal, amount-is-number, unit list, category
  list with `"other"` fallback) so they can't drift apart again.
- User's typed caption now reaches the vision model via `attachedImagesCaption`
  instead of being discarded as `body.text = ""`.
- Added test cases to `extract_test.ts` for the noise-filter fix.
- Verified: `npm run build` clean, `npm run lint` clean on touched files
  (pre-existing warnings elsewhere untouched), all 265 Vitest tests pass.
  Deno is not installed in this environment, so `extract_test.ts` itself was
  never executed — verified only by manual trace of the new regex against the
  new test cases. **Run it before trusting it fully.**

**Phase 2 — image fidelity fix: done, verified.**
- `validateAndCompressImage` in `ChatInterface.tsx`: cap moved from
  long-side 1200px to **short-side 1280px**, so tall/scrolling screenshots
  (e.g. 1170×6000) no longer get squashed to an unreadable ~234px wide.
- PNG sources stay PNG (no forced lossy JPEG re-encode); only genuine JPEG
  sources get re-encoded, now at quality 0.92 (was 0.8).
- Skips the canvas round-trip entirely when an image is already a supported
  format and within the size cap.
- Tiling for very tall captures explicitly deferred to Phase 3 (coupled to
  the image-count-cap rework below).
- Verified: build, lint, all 265 tests pass.

**Phase 3 — image-cap consistency + merge guidance + upload-failure
surfacing: partial, STOPPED mid-phase.**
- Added `MAX_VISION_IMAGES = 8` as a shared constant in `recipe-schema.ts`
  (previously three separate hardcoded `4`s across the codebase, while
  video's own OCR frame cap was already `MAX_OCR_FRAMES = 8` — frames 5–8
  were being silently truncated by `chatWithImages`'s old
  `images.slice(0, 4)` before ever reaching the model; this constant fixes
  that latent bug once wired through).
- Updated `openrouter-client.ts`'s `chatWithImages` to use the shared
  constant and to **label each image** ("Image 1 of N:" before each
  `image_url` part) so the model can reason about page order and multi-image
  merging — this was previously unlabeled, contributing to duplicated
  ingredients / spurious multi-recipe splits on multi-screenshot input.
- Updated `text-adapter.ts` to slice on the shared constant instead of a
  hardcoded `4`.
- Confirmed `pipeline.ts:167-168` (cited in the original audit) is just a
  call site dispatching to `textAdapter`, not a separate cap — no change
  needed there.
- **Stopped here, before the frontend change, mid-question.** The chat UI's
  image picker (`ChatInterface.tsx`, hardcoded `4` in ~4 places: around lines
  751, 780–781, 2325, 2331, 2333) was never updated. Raising the *backend*
  cap to 8 without raising the *frontend* picker cap means: users still
  attach at most 4 screenshots per message (no user-visible change there),
  but the video OCR frame-drop bug is fixed, and a future image-cap bump in
  the UI would now "just work" without further backend changes. The question
  of whether to raise the frontend cap to 8 too was asked and the interaction
  was interrupted before the user answered — **this is the single most
  concrete next step.**
- **Not started within Phase 3**: merge guidance in the image prompt (how to
  handle page order / overlapping scroll captures / section headers so the
  model doesn't spuriously split one recipe into `recipes[]`), and surfacing
  partial image-upload failures (`chat-api/index.ts:275-278,330` — currently
  a failed upload for 1-of-N images is silently dropped with no error to the
  user; only an all-fail case falls back to base64).

**Phases 4–6: not started.**
- Phase 4 (ADR-0007 implementation: add `warnings: string[]` to the schema,
  remove `transform.ts`'s `servings||4` / `difficulty→"medium"` /
  `category→"pantry"` defaults) — **requires a cross-domain null-safety audit
  first**, across meal planner servings scaling, grocery aggregation, and
  difficulty badges/filters, before the defaults can safely be removed. Do
  not ship 4b without 4c (see the MOP file's own phase ordering).
- Phase 5 (validate-then-escalate on the vision path: JSON mode + retry with
  validation errors, instead of only retrying on a thrown exception).
- Phase 6 (doc corrections — stale vision model name references in
  `API.md`, `ARCHITECTURE.md`, MOP-0016, the SME README).

**Outside MOP-0034, not started:**
- MOP-0035 (per-modality extraction requirements spec doc) — not started.
- MOP-0012 promotion (image fixture test library) — user confirmed promoting
  it into active scope, but no file work has happened yet.
- Audio input build-out (user confirmed wiring it up as a first-class input
  type, not marking it unsupported) — not started.

## Decisions and reasoning

All of these were confirmed by the user in the session that opened MOP-0034
and still stand; nothing has reopened them:

- **Blank/null over fabricated defaults** (servings, difficulty) when the
  source doesn't state them — confirmed, this is ADR-0007 §1.
- **`"other"` is an acceptable fallback grocery category** — confirmed,
  resolves ADR-0007 §3's open question.
- **Promote MOP-0012** (image fixture test library) into active scope —
  confirmed, not yet acted on.
- **Audio: build it out** as a real input type rather than declaring it
  unsupported — confirmed, not yet acted on.
- **Vision retry: one retry on the larger model, no cost cap** — confirmed,
  this is Phase 5's design, not yet implemented.
- **Execution style: one phase at a time, user reviews each** — this is why
  Phase 3 stopped mid-way to ask about the frontend cap rather than deciding
  unilaterally and continuing.
- **Pre-existing uncommitted unit-handling edit** (the "piece"/"stalk" unit
  fix in `recipe-prompts.ts`/`extract.ts` that predated this MOP) was
  deliberately left uncommitted and layered under, rather than committed
  first, when this MOP's Phase 1 session started. **Verified now:** `fc61c7f`
  (MOP-0032's batch commit) already introduced `COUNTABLE_UNITS`,
  `UNIT_CANONICAL`, and the "piece/stalk → empty unit" prompt wording (see
  `git show fc61c7f --stat` and its commit body). The current working-tree
  diff on both files is confirmed to be **only** MOP-0034 Phase 1 content on
  top of that already-committed base — there is no separate leftover
  unit-handling delta to worry about. This was an open question in an earlier
  draft of this entry; it's now resolved.

## Known issues / things that look wrong but aren't (or are)

- **Deno is not installed in this environment.** `extract_test.ts` changes
  (Phase 1's new noise-filter test cases) have never actually been executed,
  only manually traced. If Deno becomes available, run
  `deno test supabase/functions/recipe-pipeline/stages/extract_test.ts`
  before trusting Phase 1 is fully correct.
- **`chatWithImages`'s image-labeling change** (Phase 3) alters the exact
  shape of the `userContent` array sent to OpenRouter (now alternating
  `{type:"text"}` / `{type:"image_url"}` pairs instead of one text block
  followed by all images). This is untested against a live OpenRouter call
  in this session — it compiles and passes existing unit tests, but no test
  actually asserts on the vision model's real response to the new labeled
  format. Worth a live smoke test with an actual screenshot before merging.
- **The `created_by` removal** (`87d7bec`) that an earlier version of this
  session flagged as suspicious is **not** suspicious — it's a confirmed,
  intentional, committed P0 bug fix from a different (MOP-0032) session,
  fully explained in that session's own handoff entry. Resolved; no longer
  an open item.

## Open questions for the user

1. **Frontend image-cap question (blocking Phase 3 completion)** — now that
   the backend vision-call cap is a shared `MAX_VISION_IMAGES = 8` constant
   (fixing the video OCR frame-drop bug), should the chat UI's screenshot
   picker also raise its hardcoded `4`-image limit to `8`? Tradeoff: raising
   it lets users attach more pages of a multi-page recipe card or more
   scroll-capture tiles per message; leaving it at 4 keeps the current UX
   unchanged and limits scope to just the backend fix. This was asked and
   interrupted mid-session — needs an answer before Phase 3 can be called
   done.
2. **Commit strategy** — given Phases 1–2 are complete and verified, and
   Phase 3 is half-done, does the user want Phases 1–2 committed now as a
   checkpoint (keeping Phase 3's in-progress files uncommitted), or everything
   held until Phase 3 (and ideally 4–6) are done? No commits have been made
   for MOP-0034 yet either way.

## Suggested next steps

1. Get the user's answer on the frontend image-cap question above, then
   finish Phase 3: update the four `ChatInterface.tsx` hardcoded `4`s if the
   answer is yes, add merge guidance to the image prompt, and fix the silent
   partial-upload-failure drop in `chat-api/index.ts`.
2. Verify Deno test execution if the environment allows it by then.
3. Do a live smoke test of a real screenshot extraction (ideally the one
   that originally prompted this MOP) to confirm Phases 1–2 actually improved
   accuracy before investing further in Phases 3–5.
4. Run the cross-domain null-safety audit (meal-planning-sme +
   recipe-pipeline-sme) before starting Phase 4, per the MOP's own
   sequencing rule (4c before 4b).
5. Register ADR-0007, MOP-0034, and MOP-0035 in `docs/MOPs/REGISTRY.md` once
   there's a commit to point them at — they're currently untracked drafts.
