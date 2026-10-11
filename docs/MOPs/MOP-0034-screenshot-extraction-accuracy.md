# MOP-0034: Screenshot / Image Recipe Extraction Accuracy

| Field | Value |
|-------|-------|
| **MOP** | MOP-0034 |
| **Title** | Screenshot / Image Recipe Extraction Accuracy |
| **Date Submitted** | 2026-10-04 |
| **Date Updated** | 2026-10-04 |
| **Date Completed** | — |
| **Submitted By** | surface-reviewer (from recipe-pipeline-sme audit, 2026-10-04) |
| **Status** | draft |

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

### Phase 4: Absence + uncertainty semantics (P2, implements ADR-0007)
**Files affected:** `_shared/recipe-schema.ts`, `stages/transform.ts`, `stages/load.ts`, `_shared/recipe-prompts.ts`, `src/components/chat/StructuredRecipeDisplay.tsx`, recipe card/detail components

- 4a — Add optional `warnings: string[]` to the extraction schema. Add a prompt instruction to put illegible/ambiguous reads there.
- 4b — Transform: remove `servings || 4` (`transform.ts:34`) and the `"medium"` difficulty default (`:40`). Change the category fallback `"pantry"` → `"other"` (`:47`), pending user confirmation.
- 4c — **Null-safety audit before 4b ships:** meal planner servings scaling, grocery aggregation, difficulty badges/filters, dashboard widgets, `get_recommendations` difficulty matching. Route the audit through `meal-planning-sme` and `recipe-pipeline-sme`.
- 4d — Render `warnings` on the pre-save recipe card (`StructuredRecipeDisplay.tsx`) using semantic warning tokens per `docs/COLOR_SCHEMA.md`.
- No migration: `servings` and `difficulty` are already nullable (`001_core_schema.sql:102-103`).

### Phase 5: Validate-then-escalate on the vision path (P2)
**Files affected:** `stages/extract.ts`, `_shared/openrouter-client.ts`

Today the fallback chain (`qwen3-vl-8b` → `qwen2.5-vl-72b` → `gemini-2.0-flash`, `extract.ts:18-22, 73-90`) escalates **only on thrown errors**. Bad output is accepted.
- Request JSON mode (`response_format: { type: "json_object" }`) where the model supports it. Verify OpenRouter support per model slug.
- After normalizing, run a structural validation (title present, ≥1 ingredient with a name, ≥1 instruction, no string amounts after parsing). On failure, **retry once on the next model in the chain with the validation errors in the message**. This matches the design in `.claude/agents/cooking-bot-knowledge/recipe-extraction.md:87-91,105-124` and the video adapter's 2-attempt pattern.
- Log which model produced the accepted output, as input for a later decision on whether 72B should be the default.

> **Planning required:** cost ceiling per extraction; whether to try 72B first for >2 images.

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
| P2 | Phase 5 — validate-then-escalate + JSON mode | Medium | Medium — cost tradeoff |
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
- [ ] Structurally invalid vision output triggers one escalated retry
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
