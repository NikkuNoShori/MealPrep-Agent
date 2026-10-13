# MOP-0034: Screenshot / Image Recipe Extraction Accuracy

| Field | Value |
|-------|-------|
| **MOP** | MOP-0034 |
| **Title** | Screenshot / Image Recipe Extraction Accuracy |
| **Date Submitted** | 2026-10-04 |
| **Date Updated** | 2026-10-13 (1f, 1g, 1h, 5a implemented; 3e Step 0 confirmed root cause was model-side, 3e fix deferred; live retest surfaced two more gaps — dropped range quantities, unfolded garnish duplicates — new prompt rules + plausibility checks added same day) |
| **Date Completed** | — |
| **Submitted By** | surface-reviewer (from recipe-pipeline-sme audit, 2026-10-04) |
| **Status** | in_progress |

> Status vocabulary defined in [docs/prompts/MOP_STATUS_LIFECYCLE.md](../prompts/MOP_STATUS_LIFECYCLE.md). Valid values: `draft` / `evaluation` / `approved` / `planned` / `in_progress` / `verifying` / `complete` / `blocked` / `cancelled` / `deferred`.

> **Numbering note:** MOP-0033 is reserved by MOP-0032 §"Deferred to MOP-0033" (nutrition, meal frequency, family meal requests). That number is skipped here on purpose.

---

## Summary

Users report that screenshot recipe extraction is inaccurate. Screenshots have no dedicated adapter. They ride the text adapter with an `images[]` array into a single-shot `qwen/qwen3-vl-8b-instruct` call. That call has no JSON mode, no output validation, and no retry-on-bad-output. The audit found 12 code-level defects along this path. The three likely root causes:
1. Aggressive client downscaling makes small or tall-screenshot text unreadable.
2. A vision prompt that contradicts itself and invites fabrication.
3. A post-process filter that silently deletes short but legitimate steps.

This MOP fixes the vision path in risk order: quick prompt/filter fixes first, then input fidelity, then robustness. Absence/uncertainty semantics are decided in [ADR-0007](../DECISIONS/ADR-0007-extraction-absence-and-provenance-semantics.md). The acceptance bar for "accurate" is set by MOP-0035 §Screenshot.

---

## Scope Map

```
src/components/chat/ChatInterface.tsx
src/components/chat/StructuredRecipeDisplay.tsx
supabase/functions/chat-api/index.ts
supabase/functions/chat-api/agent-loop.ts
supabase/functions/chat-api/tools/handlers.ts
supabase/functions/recipe-pipeline/pipeline.ts
supabase/functions/recipe-pipeline/adapters/text-adapter.ts
supabase/functions/recipe-pipeline/adapters/video-adapter.ts
supabase/functions/recipe-pipeline/stages/extract.ts
supabase/functions/recipe-pipeline/stages/extract_test.ts
supabase/functions/recipe-pipeline/stages/transform.ts
supabase/functions/recipe-pipeline/stages/load.ts
supabase/functions/_shared/recipe-prompts.ts
supabase/functions/_shared/recipe-schema.ts
supabase/functions/_shared/openrouter-client.ts
docs/API.md
docs/ARCHITECTURE.md
```

---

## Scope of Work

### Phase 1: Quick fixes — stop fabrication and step loss (P1)
**Files affected:** `_shared/recipe-prompts.ts`, `recipe-pipeline/stages/extract.ts`, `stages/extract_test.ts`, `chat-api/tools/handlers.ts`

| # | Fix | Evidence |
|---|---|---|
| 1a | **Remove image prompt Rule 5** ("Infer missing metadata"). Replace it with the text prompt's omit/null rule (ADR-0007 §1). | `recipe-prompts.ts:137` vs `:147`, `:63` |
| 1b | **Replace the image few-shot example values** with `null` for optional scalars (ADR-0007 §2). | `recipe-prompts.ts:141` |
| 1c | **Stop deleting short steps.** Replace the `split(/\s+/).length > 3` gate with a **whole-step** noise match: drop a step only if the *entire* step is a social/filler phrase (`^(enjoy|dig in|bon app[eé]tit)[.!]*$`). Remove `garnish with` and `serve immediately` as prefix matches, because "Garnish with parsley and serve." is a real step. Add test cases: `"Bake 20 minutes."`, `"Season to taste."`, `"Garnish with parsley."` must survive, and `"Enjoy!"` must drop. This **amends MOP-0032 Phase 1 item 6**, which specified the ≤3-word rule. | `extract.ts:296-299`, `:439`; MOP-0032 Phase 1.6 |
| 1d | **Unify the prompt rules.** Move the type/unit/category rules into one shared `RECIPE_FIELD_RULES` string, interpolated into both text and image prompts: fraction → decimal, amount is a number not a string, standard unit list, category list, ≤3-word instruction warning removed. This prevents future drift. Coordinate with MOP-0032 Phase 1.7 (fractions/ranges as `varchar`). Whichever representation shipped is what the shared rule must say. | `recipe-prompts.ts:64-92` vs `:120-154`; `recipe-schema.ts:26` |
| 1e | **Pass the user's caption through.** `handlers.ts` sends the user's message text (if any) as `body.text` instead of `""`. The vision path frames it in the prompt as "User-provided context (may include servings, page order, corrections)". The caption is the user's own input, not third-party content, so there is no new injection surface. | `chat-api/tools/handlers.ts:249-250` |
| 1f | **(Addendum 2026-10-12) Make example arrays non-trivial.** `IMAGE_EXTRACTION_PROMPT`'s single-recipe example has exactly **one** ingredient, and the text prompt's "Example minimal valid response" has one too. Small models copy an example's *shape*, including array length, not just its values. 1b fixed the scalars but left the array at one item. Change both to show **at least 4 placeholder ingredients**, keeping ADR-0007 §2 placeholder style (no realistic values). One of them should show the alternative-quantity pattern from 1g, with the alternative in `notes`. Also add a rule line: "Extract **every** ingredient line visible. Do not summarize, merge, or truncate the list." | `recipe-prompts.ts:148`, `:125` |
| 1g | **(Addendum 2026-10-12) Inline quantity alternatives rule.** Add to `RECIPE_FIELD_RULES`: when a line gives alternative quantities ("3 russet potatoes or 3c (2-3 lbs) diced"), use the **first stated** quantity as `amount`/`unit`, put the alternatives and the prep in `notes` ("or 3 cups (2-3 lbs); diced"), and never let the alternative swallow neighboring lines. *Default proposed here. The user must confirm it (see Open questions), since it decides whether grocery aggregation sees a count or a volume.* | `recipe-prompts.ts:11-16` |
| 1h | **(Addendum 2026-10-12) Recognize single-letter / dotted unit abbreviations.** Add `c`/`c.` → `cup` to `UNIT_CANONICAL`, and add `c\\.?` to `KNOWN_UNITS` (the `UNITS_CAPTURE` boundary already requires whitespace/comma/end). Today a raw `unit: "c"` passes through unvalidated. **Do not** add `T`/`t` (tbsp/tsp) the same way, because `UNIT_CANONICAL` lookups lowercase the key and would merge them. That needs a case-sensitive pre-pass, or should be left out. Also reconcile the prompt's "cups" with the canonical `"cup"`. Add `extract_test.ts` cases: `{amount:3, unit:"c"}` → `unit:"cup"`, and `"1 c. sugar"` parses. | `extract.ts:371-416`, `recipe-prompts.ts:13` |

### Phase 2: Input fidelity — keep text legible (P1)
**Files affected:** `src/components/chat/ChatInterface.tsx`

**Root cause:** `MAX_IMAGE_DIMENSION = 1200` on the *longest* side, plus forced JPEG q0.8 (`ChatInterface.tsx:49-51, 84-88, 107, 115`). A 1170×2532 phone screenshot drops to about 554×1200. A 1170×6000 scrolling capture drops to about 234×1200, which is unreadable.

Planned approach (finalize during planning):
- Cap the **short side** (width) at roughly 1200–1600px instead of the long side, preserving native width for typical phone screenshots.
- For very tall captures (aspect ratio > ~2.5), **slice vertically into overlapping tiles** (~10% overlap) instead of shrinking. Each tile counts against the image cap.
- Keep **PNG for PNG sources**, or use WebP lossless/high quality. Do not re-encode screenshots to lossy JPEG.
- Replace the old MOP-0001 target ("<500KB", payload only) with a legibility target: **effective text x-height ≥ ~10px**. Set a payload ceiling against the Edge Function body limit (record the chosen ceiling here).

> **Planning required:** confirm the OpenRouter per-image token cost and the Qwen3-VL internal resize behavior before picking final dimensions. Larger inputs are only useful if the model doesn't downsample them again.

### Phase 3: Multi-image correctness (P2)
**Files affected:** `_shared/openrouter-client.ts`, `adapters/text-adapter.ts`, `adapters/video-adapter.ts`, `ChatInterface.tsx`, `chat-api/index.ts`, `_shared/recipe-prompts.ts`

- **3a — One image-cap constant.** Replace the three hardcoded `4`s (`ChatInterface.tsx:2292`, `text-adapter.ts:21`, `openrouter-client.ts:168`) with one shared constant per path. **Fixes a latent video bug:** `chatWithImages` truncates to 4, so frames 5–8 of `MAX_OCR_FRAMES = 8` (`video-adapter.ts:17,141`) are silently dropped. Either raise the client cap to the video limit, or make the cap a parameter.
- **3b — Label images.** Interleave `"Image 1 of N"` text parts before each image in `chatWithImages` (`openrouter-client.ts:166-172`), in the order the user attached them.
- **3c — Merge guidance in the prompt.** Images are in page/scroll order. Consecutive images may overlap, so de-duplicate repeated lines. Section headers ("For the sauce") are ingredient groups, not separate recipes. Emit `recipes[]` only for distinct titled recipes. Addresses the spurious split at `extract.ts:181-199`.
- **3d — Surface partial upload failure.** In `chat-api/index.ts:275-278,330`, when only some uploads fail: fall back to base64 *per image* (not just when all fail), or add a pipeline warning (ADR-0007 §4) naming the dropped image. Never drop an image silently.
- **3e — (Addendum 2026-10-12) `recipes[]` unwrap field precedence. CONFIRM BEFORE FIXING.** `parseRecipeResponse` (`extract.ts:159-168,176`) merges `{ ...topLevelFields, ...item }`, so the **item wins** on every key. Suppose the model emits `{recipes:[{title, ingredients:[<1 stub>], instructions}], ingredients:[<17>]}`. The full top-level list is then discarded, and the result is exactly the observed symptom: 1 ingredient, every step intact. This competes with "the model returned 1 ingredient" as a root-cause hypothesis for the 2026-10-12 report.
  - **Step 0 (diagnostic, read-only):** pull the failing request's `Raw LLM response (first 1000 chars)` log line (`extract.ts:122`) from the `recipe-pipeline` function logs. If it starts `{"recipe":{…"ingredients":[{one item}]` → model-side, and 1f/1g/Phase 5 are the fix. If it starts `{"recipes":[` → this bug is live. Note the 1000-char cap: a 17-ingredient top-level list may be cut off, so a `recipes`-prefixed log with no visible top-level `ingredients` is *not* exculpatory. Raise the log cap, or log key shapes and array lengths, if inconclusive.
  - **Also confirm which build is deployed.** The 2026-10-12 handoff found `chat-api` running a pre-HEAD build. If `recipe-pipeline` is also stale, the live failure ran against pre-Phase-1 prompts.
  - **Fix, if confirmed:** for array fields (`ingredients`, `instructions`), take the longer non-empty array of item vs. top level. Scalars keep item-wins. Add an `extract_test.ts` case for the degenerate shape.

### Phase 4: Absence + uncertainty semantics (P2, implements ADR-0007)
**Files affected:** `_shared/recipe-schema.ts`, `stages/transform.ts`, `stages/load.ts`, `_shared/recipe-prompts.ts`, `src/components/chat/StructuredRecipeDisplay.tsx`, recipe card/detail components

- 4a — Add optional `warnings: string[]` to the extraction schema. Add a prompt instruction to put illegible/ambiguous reads there.
- 4b — Transform: remove `servings || 4` (`transform.ts:34`) and the `"medium"` difficulty default (`:40`). Change the category fallback `"pantry"` → `"other"` (`:47`), pending user confirmation.
- 4c — **Null-safety audit before 4b ships:** meal planner servings scaling, grocery aggregation, difficulty badges/filters, dashboard widgets, `get_recommendations` difficulty matching. Route the audit through `meal-planning-sme` and `recipe-pipeline-sme`.
- 4d — Render `warnings` on the pre-save recipe card (`StructuredRecipeDisplay.tsx`) using semantic warning tokens per `docs/COLOR_SCHEMA.md`.
- No migration: `servings` and `difficulty` are already nullable (`001_core_schema.sql:102-103`).

### Phase 5: Validate-then-escalate on the vision path (5a: P1, 5b: P2; revised 2026-10-12)
**Files affected:** `stages/extract.ts`, `_shared/openrouter-client.ts`, `stages/extract_test.ts`

Today the fallback chain (`qwen3-vl-8b` → `qwen2.5-vl-72b` → `gemini-2.0-flash`, `extract.ts:18-22, 60-87`) escalates **only on thrown errors**. Bad output is accepted.

> **Why revised:** the original spec ("title present, ≥1 ingredient with a name, ≥1 instruction, no string amounts") would have **passed** the 2026-10-12 failure: 1 named ingredient, `amount: 3`, 3 instructions. A structural check alone cannot catch truncated or collapsed extractions. Phase 5 now has a plausibility layer, and that part is promoted to P1 because it is the only defense that does not depend on the 8B model obeying prompt fixes 1f/1g.

**5a — Plausibility gate + escalation (P1):**
- **Structural checks (hard):** title present; ≥1 ingredient with a non-empty name; ≥1 instruction; no string `amount` after parsing.
- **Plausibility checks (soft, trigger escalation, never rejection):**
  - `ingredients.length < 3`. Legitimate 1–2 ingredient recipes exist, so this escalates and does not fail.
  - Any ingredient `unit` not in the canonical set after normalization (catches raw `"c"`-style leakage).
  - Any ingredient `name` or `unit` containing an alternative-quantity marker (`/\bor\b.*\d/`, a parenthesized quantity) that suggests two lines merged.
  - Instruction text references more distinct ingredient-like tokens than the ingredient list contains. *Optional; planning decides whether this heuristic is worth the complexity.*
- **On soft failure:** retry **once** on the next model in the chain, with the specific failed checks in the user message ("Your previous extraction returned 1 ingredient; the image appears to contain more. Re-read and list every ingredient line."). The user already confirmed "one retry on the larger model, no cost cap" (handoff 2026-10-11).
- **Never fail closed on soft checks.** If the escalated result also trips them, return the escalated model's result and attach an ADR-0007 §4 `warnings[]` entry ("Only N ingredients detected — please verify against the source"). Do not auto-pick "the longer result", because that favors hallucination.
- **Implementation note:** throwing from inside the loop's `try` (`extract.ts:75`) already advances the model chain. But on the *last* model it ends in `All vision models failed` (`:81-86`), a hard failure. Soft-check failures must keep the best result rather than throw.
- **Text path:** apply the same plausibility checks to the text/URL path (`:89-112`), which today retries only on a throw too. Same model, so the retry gets the failed checks in its message but does not escalate.
- Log which model produced the accepted output and which checks fired. This is the input for a later decision on whether 72B should be the default.

**5b — JSON mode (P2):**
- Request `response_format: { type: "json_object" }` where the model supports it. Verify OpenRouter support per model slug (the comment at `extract.ts:66-67` says vision models don't reliably support it).

> **Planning required:** final plausibility thresholds (the `< 3` cutoff); whether to try 72B first for >2 images; whether 5a ships before Phase 4, since it needs `warnings[]` from 4a. If it ships first, add `warnings` to the schema early or log-only.

### Phase 6: Doc corrections (P3, can land any time)
**Files affected:** `docs/API.md:387,946`, `docs/ARCHITECTURE.md:176`, `docs/MOPs/MOP-0016-short-form-video-intake.md:100-101`, recipe-pipeline-sme README `:38`, `docs/MOPs/MOP-0001.md:253`

Replace `qwen-2.5-vl-7b` / Gemini 1.5 references with the current chain: `qwen/qwen3-vl-8b-instruct` → `qwen2.5-vl-72b` → `gemini-2.0-flash`, citing `extract.ts:18-22` as the source of truth. *(For completed MOPs 0001/0016, add a dated "model since replaced" note instead of rewriting history.)*

---

## Priority

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P1 | Phase 1 — prompt contradiction, example leak, short-step deletion, prompt parity, caption passthrough | Small | High — direct accuracy fix, all low-risk edits |
| P1 | Phase 2 — downscaling / JPEG re-encode | Small–Medium | High — likely root cause for tall screenshots |
| P2 | Phase 3 — image caps (incl. video frame-drop bug), labeling, merge guidance, partial upload failure | Medium | Medium |
| P2 | Phase 4 — ADR-0007 absence/warnings | Medium | Medium — cross-domain null-safety audit required |
| — | ~~(2026-10-12) 3e Step 0 — raw-log + deployed-build check for the 1-ingredient report~~ | Tiny | **Done 2026-10-13** — confirmed model-side (hypothesis a), not the merge bug |
| — | ~~(2026-10-12) Phase 1 addendum 1f–1h — example array length, alternative-quantity rule, `c` unit~~ | Small | **Done 2026-10-13** |
| — | ~~Phase 5a — plausibility gate + escalate (revised 2026-10-12)~~ | Small–Medium | **Done 2026-10-13** |
| defer | Phase 3e fix — array-field merge precedence | Small | Not needed for the 2026-10-12 failure (ruled out). Kept as a latent-bug note; revisit only if a future raw log starts with `"recipes":[`. |
| P2 | Phase 5b — JSON mode | Small | Medium |
| P3 | Phase 6 — doc model-name drift | Small | Low |

---

## Verification

> **Lockticket acceptance criteria.** See [MOP_VERIFICATION_POLICY.md](../prompts/MOP_VERIFICATION_POLICY.md) — **`type: human` is forbidden** (blocks `complete`). Route domain tests via [DOMAIN_TEST_MATRIX.md](../prompts/DOMAIN_TEST_MATRIX.md). Run `/integrity-check` then `/verify-mop MOP-0034`.

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

  - id: extract-deno-tests
    type: command
    run: deno test supabase/functions/recipe-pipeline/stages/extract_test.ts
    expect_exit: 0
    note: must include new short-step-survival cases (Phase 1c)

  - id: no-infer-missing-metadata
    type: grep
    path: supabase/functions/_shared/recipe-prompts.ts
    pattern: "Infer missing metadata"
    expect: absent

  - id: no-word-count-instruction-filter
    type: grep
    path: supabase/functions/recipe-pipeline/stages/extract.ts
    pattern: "split\\(/\\\\s\\+/\\)\\.length > 3"
    expect: absent

  - id: shared-field-rules
    type: grep
    path: supabase/functions/_shared/recipe-prompts.ts
    pattern: "RECIPE_FIELD_RULES"
    expect: present

  - id: no-servings-default-4
    type: grep
    path: supabase/functions/recipe-pipeline/stages/transform.ts
    pattern: "\\|\\| 4"
    expect: absent

  - id: warnings-in-schema
    type: grep
    path: supabase/functions/_shared/recipe-schema.ts
    pattern: "warnings"
    expect: present

  - id: no-stale-vision-model-in-docs
    type: grep
    path: docs/API.md
    pattern: "qwen-2.5-vl-7b"
    expect: absent

  - id: c-unit-canonical
    type: grep
    path: supabase/functions/recipe-pipeline/stages/extract.ts
    pattern: "c: \"cup\""
    expect: present
    note: "Phase 1h — implemented 2026-10-13 in UNIT_CANONICAL + KNOWN_UNITS (\"c\\\\.?\" pattern)"

  - id: alternative-quantity-rule
    type: grep
    path: supabase/functions/_shared/recipe-prompts.ts
    pattern: "Alternative quantities"
    expect: present
    note: "Phase 1g — implemented 2026-10-13 in RECIPE_FIELD_RULES"

  - id: plausibility-tests
    type: command
    run: deno test supabase/functions/recipe-pipeline/stages/extract_test.ts --filter plausibilityFlags
    expect_exit: 0
    note: "Phase 5a — implemented 2026-10-13, extended same day after live retest. Includes: the exact 2026-10-12 pickle-soup fixture (1 ingredient, amount 3, unit c, 3 instructions) asserting escalation; a well-formed-recipe negative case; an alternative-quantity-marker case; an instructions-reference-missing-ingredient case; a dropped-range-quantity case (amount null, digit left in name) with its negative case (genuinely unquantifiable ingredient); and an unfolded-garnish-duplicate case with its negative case (distinct ingredients sharing words). 8 tests total. Depends on MOP-0036 for Deno availability in CI; not yet run locally."

  # TODO (planning): add assertions for Phase 2 (resize constant changed / no forced image/jpeg for PNG),
  # Phase 3a (single image-cap constant), Phase 5 (response_format + retry path). If MOP-0012 is promoted,
  # add an image-fixture golden run here.
```

Allowed assertion types: `file-exists`, `grep`, `command`, `test-passes`. **Not allowed:** `human`.

## Manual Follow-up (non-blocking)

- [ ] Re-run the user's original failing screenshot(s) before/after Phase 1 and after Phase 2; record results in Notes
- [ ] Spot-check one tall scrolling capture, one 2-image page-1/page-2 recipe, one handwritten card
- [ ] Confirm cost delta per extraction after Phase 5 is acceptable

---

## Acceptance Criteria

- [ ] All `verification` block items pass (`/verify-mop`)
- [ ] `/integrity-check` passes for this MOP's domains (recipe-pipeline, chat-rag, meal-planning for Phase 4 null-safety)
- [ ] Image prompt contains no inference instruction and no realistic example values
- [ ] Steps like "Bake 20 minutes." and "Garnish with parsley." survive normalization
- [ ] Text and image prompts share one field-rules block
- [ ] User caption reaches the vision model
- [ ] Phone screenshots keep native width; tall captures are tiled, not shrunk; PNG is not re-encoded to lossy JPEG
- [ ] Video OCR frames 5–8 are no longer silently dropped
- [ ] Partial image upload failure produces a visible warning or a per-image fallback
- [ ] Missing servings/difficulty persist as null and render cleanly across recipe, planner, grocery, and dashboard surfaces
- [x] Structurally invalid vision output triggers one escalated retry (pre-existing: throw → next model)
- [x] Implausible vision output (e.g., <3 ingredients, merged-alternative marker, instructions referencing ingredients absent from the list) triggers escalation through the remaining fallback chain; if it persists, the best available result is still returned rather than a hard failure. **Not yet done:** attaching a `warnings[]` entry on persistent failure — blocked on Phase 4a (schema doesn't have `warnings` yet). Currently only logged via `console.warn`.
- [x] The 2026-10-12 Instagram screenshot (17 ingredients) extracts ≥17 ingredients, or surfaces a warning — **retested live 2026-10-13 after 1f/1g/1h/5a deployed.** Result: 20 ingredients returned (improvement from 1). Two new defects found in that retest, not yet fixed in a live retest (prompt/plausibility-check changes made same day, unverified against real images): (1) "4-6 cups of vegetable or chicken broth" came back with `amount: null` — a plain range, not the alternative-quantity pattern 1g covers, so the model had no rule to follow; (2) "heavy cream", "sriracha", and "fresh dill" each appeared twice — once correctly in the main list, once again as a blank-amount duplicate from the recipe's "for garnish" line. Added two new `RECIPE_FIELD_RULES` (range handling: use low end of range as amount, never null; garnish-line folding: don't duplicate an already-listed ingredient, fold into instructions instead) and two new `plausibilityFlags` checks (null amount with a digit in the ingredient's own name; duplicate ingredient names). **Not yet redeployed or retested against live images.**
- [x] Root cause of the 2026-10-12 collapse recorded in Notes (confirmed model-side via `recipe-pipeline` logs 2026-10-13; `recipes[]` merge precedence ruled out; deployed-build staleness not applicable since this was tested on today's fresh redeploy)
- [ ] Meets MOP-0035 §Screenshot acceptance criteria (once that spec exists)
- [ ] Documentation updated per `/update-docs` procedure
- [ ] CHANGELOG entry added
- [ ] ADR-0007 updated to `accepted`

---

## Related

- **ADRs:** ADR-0007 (absence/provenance semantics — governs Phases 1a, 1b, 4)
- **MOPs:** MOP-0032 Phase 1 (item 6 amended by Phase 1c; item 7 fraction representation must match Phase 1d), MOP-0035 (per-modality requirements spec — defines this MOP's accuracy bar), MOP-0012 (fixture library — deferral trigger arguably fired; image category proposed), MOP-0001 (original image-input work), MOP-0016 (video two-stage pattern this MOP borrows from)
- **Audit / source:** recipe-pipeline-sme screenshot extraction audit, 2026-10-04 (14 findings + doc gap), triaged by surface-reviewer

---

## Notes

- Phase 1 is independent and safe to ship first. Its edits touch the same files as the current uncommitted unit-handling changes (`recipe-prompts.ts`, `extract.ts`), so commit those first to keep diffs reviewable.
- Phase 1c also affects URL and text extraction, because the noise filter is shared. That is intended: short steps are being lost on every path.
- Phase 4 is the only phase with cross-domain blast radius. Do not ship 4b without 4c.
- No remote DB changes are required anywhere in this MOP.
- **Addendum 2026-10-12 (surface-reviewer, from recipe-pipeline-sme diagnosis):** A 17-ingredient Instagram screenshot extracted as 1 ingredient (`"russet potatoes"`, `amount: 3`, `unit: "c"`) with all 3 steps verbatim. The SME ruled out truncation, resize, and parser bugs by reading the code path. Root cause has **not** been confirmed against logs. Two hypotheses compete: (a) the model returned 1 ingredient, which 1f/1g/5a address; (b) `recipes[]` unwrap precedence discarded a full top-level list, which 3e addresses. Run 3e Step 0 first. Phase 5's original validation spec would have passed this output, so it was revised. Status drift: Phases 1–2 and most of 3 (3a backend, 3b, 3c) are committed in `286c34e`, yet this MOP's status is still `draft`. Project lead to move it to `in_progress`.
- **3e Step 0 result (2026-10-13, confirmed via `recipe-pipeline` function logs):** Raw LLM response for the failing request starts `{"recipe":{"title":"Pickle Soup",...,"ingredients":[{"name":"russet potatoes","amount":3,"unit":"c",...,"notes":"(2-3 pounds) diced (this also works with frozen potatoes)"}],"instructions":[...]}`. Singular `"recipe"`, not `"recipes"` — **hypothesis (a) confirmed, (b) ruled out.** The model itself collapsed the ingredient list; the remaining 16 ingredient lines were never parsed as separate entries at all (not even merged into one ingredient's notes — the `notes` field only holds the trailing qualifier for the one ingredient it did keep). Phase 3e's fix is **not needed** for this failure; downgrade 3e to defer-with-trigger (keep the code as a latent-bug note, only revisit if a future failure's raw log actually starts with `"recipes":[`). 1f/1g/1h/5a are the active fix path.
- **User decisions (2026-10-13):** 1g resolves to **first-stated/count**: `"3 russet potatoes or 3c (2-3 lbs) diced"` → `amount: 3, unit: ""`, alternatives and prep moved to `notes`. 5a's escalation trigger is **broadened**: escalate on `ingredients.length < 3` **OR** when instruction/description text contains ingredient-like tokens not present in the parsed ingredients list (the "wider net" option — catches cases like this one where dropped ingredient text lands in a `notes` field rather than triggering the count check alone, though in this specific failure the count check alone would also have fired since 1 < 3).
- **Fixture:** if the user can share the original screenshot, add it as the first image-category fixture under MOP-0012 (promotion already confirmed 2026-10-11).
- **Implementation notes (2026-10-13):**
  - 1f/1g: `RECIPE_FIELD_RULES` gained an "extract every ingredient line" rule and the alternative-quantity rule (first-stated/count, per user decision). Both prompt examples (`RECIPE_EXTRACTION_PROMPT`'s JSON block, its minimal-response line, `IMAGE_EXTRACTION_PROMPT`'s example) now show 4-5 placeholder ingredients, one demonstrating the alternative-quantity pattern.
  - 1h: added `c`/`c.` → `cup` to `UNIT_CANONICAL` and `"c\\.?"` to `KNOWN_UNITS`. Confirmed safe against false-positive matches inside other words: `UNITS_CAPTURE`/`UNITS_PATTERN` are anchored at `^` and require a trailing whitespace/comma/end boundary, so a bare "c" can only match as a standalone token, not inside "cup" or "chicken". Per the MOP's caution, did **not** add `T`/`t` for tbsp/tsp, since `UNIT_CANONICAL` lookups lowercase the key first and `T`/`t` would collide.
  - 5a: implemented as `plausibilityFlags()` in `extract.ts`, called after each vision model's result parses successfully. Checks: ingredient count < 3; an unresolved alternative-quantity marker (`/\bor\b\s+[\d½⅓⅔¼¾⅛]/i`) leaking into an ingredient name; and — per the user's broadened escalation-trigger decision — a crude keyword scan for common ingredient words (onion, garlic, cheese, etc.) that appear in instructions/description but not in the parsed ingredient list. **Deviation from the drafted spec:** the loop escalates through the *entire* remaining fallback chain on a soft failure, not a single retry, and keeps the first flagged result as a fallback if every model trips the checks (never hard-fails on a soft check). This is stricter than "retry once then accept" but was straightforward given the existing loop structure. Did not implement the "non-canonical unit after normalization" soft check from the original draft — `UNIT_CANONICAL` only maps verbose→short forms, most valid units (stalk, clove, sprig, etc.) are never in that map by design, so "not in `UNIT_CANONICAL`" is not itself a plausibility signal. The alternative-quantity-marker and notes-dumping-ground checks cover the same failure mode more precisely.
  - Did not implement 5b (JSON mode) — left as P2, not attempted.
  - Tests added to `extract_test.ts`: a fixture reproducing the exact 2026-10-12 raw response shape (asserts escalation fires), a well-formed-recipe negative case, an alternative-quantity-marker case, and an instructions-reference-missing-ingredient case. **Not run** — Deno isn't installed locally (MOP-0036 dependency, same gap noted throughout this MOP).
  - 3e: downgraded to defer-with-trigger after Step 0 confirmed the raw log starts `{"recipe":{...}` (singular), not `{"recipes":[...]}`. The merge-precedence code path is unexercised by this failure. Left as-is; not modified.
- **Follow-up implementation notes (2026-10-13, same day, after live retest):** 1f/1g/1h/5a were redeployed and retested against the same pickle-soup images. Ingredient count went from 1 → 20 (source has ~17 distinct lines plus a few legitimately-separate garnish items), confirming the escalation/prompt-rule approach works directionally. Two new defects surfaced in that same retest, both logged (not from a hypothesis, from the actual raw response this time — no ambiguity about root cause):
  - **Dropped range quantity:** "4-6 cups of vegetable or chicken broth" → `amount: null`. 1g's alternative-quantity rule only covers "X or Y" phrasing; a plain range ("4-6") has no rule at all, so the model's behavior there was unconstrained. Added a new `RECIPE_FIELD_RULES` line: ranges use the low end as amount, full range goes to notes, amount is never null just because a range was given.
  - **Unfolded garnish duplicates:** "heavy cream", "sriracha", "fresh dill" each appeared twice — correctly once in the main list, then again as a blank-amount duplicate from the source's "For garnish: heavy cream for drizzling, sriracha for drizzling, remaining fresh dill" line. Added a new `RECIPE_FIELD_RULES` line: a garnish line repeating an already-listed ingredient is a serving instruction, not a new ingredient — fold it into instructions text instead of duplicating.
  - Added two matching `plausibilityFlags` checks: (a) an ingredient with a null/missing amount whose own **name** (not notes) still contains a digit — signals a quantity the model saw but failed to extract, deliberately not triggered by digits in notes alone since "(2-3 lbs) diced" in notes is the *correct* shape for an alternative quantity; (b) duplicate ingredient names (case-insensitive) after trimming, which is exactly the garnish-duplication signature.
  - **Not yet redeployed or retested.** These are code-only changes pending another `recipe-pipeline` deploy + live retest cycle, same as the first round.
