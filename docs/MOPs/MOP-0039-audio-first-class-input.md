# MOP-0039: Audio as a First-Class Recipe Input

| Field | Value |
|-------|-------|
| **MOP** | MOP-0039 |
| **Title** | Audio as a First-Class Recipe Input |
| **Date Submitted** | 2026-10-13 |
| **Date Updated** | 2026-10-13 |
| **Date Completed** | — |
| **Submitted By** | Nick Neal (confirmed direction, 2026-10-11 MOP-0034 session) |
| **Status** | draft |

> Status vocabulary defined in [docs/prompts/MOP_STATUS_LIFECYCLE.md](../prompts/MOP_STATUS_LIFECYCLE.md). Valid values: `draft` / `evaluation` / `approved` / `planned` / `in_progress` / `verifying` / `complete` / `blocked` / `cancelled` / `deferred`.

---

## Summary

The user confirmed, in the session that opened MOP-0034 (2026-10-11), that audio should be built out as a real, first-class recipe input — not declared unsupported. That decision was recorded in a handoff but never acted on. MOP-0035 Phase 3 independently flagged this as an "undocumented half-path" needing resolution. This MOP makes it real.

**Current state, confirmed by reading the code directly (2026-10-13):** audio has no dedicated entry point anywhere. `recipe-pipeline/pipeline.ts`'s `source_type` switch only has `"text"` / `"url"` / `"video"` cases; the chat tool catalog's `source_type` enum (`catalog.ts`) is `["url", "text", "images", "video"]`. Speech-to-text (`_shared/transcribe-media.ts` — Whisper primary, Gemini multimodal fallback) exists and is fully generic (accepts any media bytes or URL, no video-specific logic), but is only ever invoked from inside `video-adapter.ts` as a side effect of processing a video upload. A user cannot attach a bare voice memo or audio clip and have it extracted today — audio transcription only happens when audio arrives bundled with (or mistaken for) a video upload.

**This is smaller than it sounds.** `video-adapter.ts`'s own options type already accepts `media_url`/`media_base64` with no required `video_url` or `frame_urls` — its JSDoc even says "Public URL of user-uploaded **video/audio**" (line 28-30). A call with only audio media and no video fields would likely already flow through transcription correctly today, *untested*. The main work is exposing this as its own `source_type`, wiring the frontend to let a user pick/attach audio specifically, and verifying the extraction prompt handles transcript-only input well (no visual frames, no caption, just spoken words).

---

## Scope Map

```
supabase/functions/recipe-pipeline/pipeline.ts
supabase/functions/recipe-pipeline/adapters/video-adapter.ts
supabase/functions/chat-api/tools/catalog.ts
supabase/functions/chat-api/tools/handlers.ts
supabase/functions/_shared/transcribe-media.ts
supabase/functions/_shared/recipe-prompts.ts
src/components/chat/ChatInterface.tsx
docs/EXTRACTION_REQUIREMENTS.md (once MOP-0035 Phase 1-2 land)
docs/API.md
```

---

## Scope of Work

### Phase 1: Backend — dedicated `audio` source_type (P1)
**Files affected:** `pipeline.ts`, `video-adapter.ts` or a new `audio-adapter.ts`, `catalog.ts`, `handlers.ts`

- Add `"audio"` to the `source_type` enum in `catalog.ts`'s `extract_recipe_from_source` tool schema and `pipeline.ts`'s switch.
- **Planning decision:** route through `video-adapter.ts` (pass `media_url`/`media_base64` with no video fields — likely already works, per the Summary) versus extracting a dedicated `audio-adapter.ts` that calls `transcribeMediaBytes`/`transcribeMediaFromUrl` directly without any of `video-adapter.ts`'s video-specific branches (oEmbed, frame OCR, link mining). The latter is more files but a cleaner contract — an audio adapter that still imports oEmbed/frame-OCR logic it can never use is confusing. Recommend the dedicated adapter; it's a thin wrapper, not a duplication of transcription logic.
- `handlers.ts`'s `extractRecipeFromSource` needs a new `else if (sourceType === "audio")` branch analogous to the existing `images`/`video` branches, mapping to whatever `body` shape the chosen adapter expects.
- Confirm `transcribeMediaBytes`'s existing size/type guards (`MAX_MEDIA_BYTES`, mime-type detection in `_shared/transcribe-media.ts`) are adequate for standalone audio uploads, not just video-extracted audio tracks — audio-only files are typically smaller, but verify the mime-type branches (`webm`/`wav`/`mp3`/`mp4` in `geminiAudioTranscribe`) cover common voice-memo formats (`m4a` notably absent from that list).

### Phase 2: Extraction prompt — transcript-only input quality (P1)
**Files affected:** `_shared/recipe-prompts.ts`

- A transcribed voice memo has no visual structure (no ingredient list formatting, no section headers) — it's a stream of speech-to-text output, likely including filler words, false starts, and conversational phrasing ("so first you're gonna want to, uh, grab about a cup of flour"). Confirm `RECIPE_EXTRACTION_PROMPT` (the text-path prompt, since transcript becomes `raw_text`) handles this register well, or add guidance specific to transcribed-speech input (e.g., "the input may be a verbatim speech transcript; extract the recipe content from conversational/filler language, don't treat filler as recipe steps").
- Apply the same "extract every ingredient" and quantity-handling rules from MOP-0034 Phase 1 here too — a spoken recipe is just as likely to drop quantities as a dense screenshot, for different reasons (speech-to-text transcription errors on numbers, not visual OCR misreads).

### Phase 3: Frontend — audio attach UI (P2)
**Files affected:** `ChatInterface.tsx`

- Add an audio-file attach affordance alongside the existing image/video attach buttons (check `ChatInterface.tsx`'s existing image-picker and video-upload UI for the pattern to follow — likely a new accepted-mime-types branch on the same file-input component, not a wholly separate control).
- Decide on accepted formats (mp3, m4a, wav, webm — match whatever `transcribe-media.ts` ends up supporting per Phase 1).
- Decide on a size cap matching or distinct from `MAX_MEDIA_BYTES` (24MB) — a multi-minute voice memo could be sizable; confirm this limit is reasonable for audio specifically, not just inherited from the video path's assumptions.

### Phase 4: Documentation (P2, depends on MOP-0035)
**Files affected:** `docs/EXTRACTION_REQUIREMENTS.md` (once it exists per MOP-0035 Phase 1-2), `docs/API.md`

- Once MOP-0035's per-modality spec doc exists, add the audio modality section there (input path, limits, failure modes, acceptance criteria) rather than only in this MOP. Until then, document audio's `source_type` and limits directly in `docs/API.md`.

---

## Priority

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P1 | Phase 1 — backend source_type + adapter | Small–Medium | High — the actual capability gap |
| P1 | Phase 2 — transcript-only prompt quality | Small | High — a working path that extracts garbage isn't a working path |
| P2 | Phase 3 — frontend attach UI | Small–Medium | High for user-facing completeness, but backend-first is the right order |
| P2 | Phase 4 — docs | Small | Medium |

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

  - id: audio-source-type-in-catalog
    type: grep
    path: supabase/functions/chat-api/tools/catalog.ts
    pattern: "\"audio\""
    expect: present
    note: Phase 1

  - id: audio-source-type-in-pipeline
    type: grep
    path: supabase/functions/recipe-pipeline/pipeline.ts
    pattern: "case \"audio\""
    expect: present
    note: "Phase 1 — adjust pattern once the switch statement's exact syntax is implemented"

  # TODO (planning): add a Deno test exercising the new audio path end-to-end
  # against a fixture transcript (once MOP-0012/MOP-0036 make Deno tests
  # runnable). Add a frontend test for the new attach-audio UI affordance.
```

Allowed assertion types: `file-exists`, `grep`, `command`, `test-passes`. **Not allowed:** `human`.

## Manual Follow-up (non-blocking)

- [ ] Record a real voice memo reciting a simple recipe and run it through the new path end-to-end before calling this done — transcription quality on real speech (accents, background noise, "um"s) is the actual risk here, not the plumbing.
- [ ] Confirm `m4a` (the default iPhone Voice Memos format) is supported, since that's the most likely real-world source for this feature.

---

## Acceptance Criteria

- [ ] All `verification` block items pass (`/verify-mop`)
- [ ] A user can attach a standalone audio file (not bundled with video) in chat and get a recipe extraction
- [ ] The extraction prompt handles conversational/filler speech-to-text output without treating filler as recipe content
- [ ] Common voice-memo formats (at minimum mp3, m4a, wav) are accepted
- [ ] `docs/API.md` or `docs/EXTRACTION_REQUIREMENTS.md` documents the audio input path and its limits
- [ ] Documentation updated per `/update-docs` procedure
- [ ] CHANGELOG entry added

---

## Related

- **MOPs:** MOP-0035 (per-modality requirements spec — Phase 3 flagged this exact gap and points here), MOP-0034 (screenshot/image accuracy — same extraction pipeline, same plausibility-gate pattern worth reusing for transcript quality), MOP-0012 / MOP-0036 (test infrastructure this MOP's Deno test depends on)
- **ADRs:** none yet
- **Source:** user-confirmed direction, 2026-10-11 MOP-0034 session (recorded in `docs/handoffs/2026-10-11-mop-0034-screenshot-extraction-phase1-3.md`); investigated and drafted 2026-10-13 during a handoff-catchup pass

---

## Notes

- Deliberately **draft, no code written** — this session's job was investigating and scoping the gap, not building it.
- The video adapter's existing `media_url`/`media_base64` handling being audio-agnostic is a genuine head start, not a reason to assume this is trivial — transcription quality on real spoken recipes (vs. a video's audio track, which may have different acoustic characteristics) is unverified.
