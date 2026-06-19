# Recipe Pipeline SME Knowledge Base

Navigation for `recipe-pipeline-sme`.

## Canonical docs

| Doc | Purpose |
|-----|---------|
| [MOP-0001](../../docs/MOPs/MOP-0001.md) | Pipeline improvements |
| [MOP-0012](../../docs/MOPs/MOP-0012.md) | Test fixture library (draft) |
| [MOP-0016](../../docs/MOPs/MOP-0016-short-form-video-intake.md) | **Short-form video intake (TikTok, upload, STT)** |
| [ARCHITECTURE.md](../../docs/ARCHITECTURE.md) | Pipeline data flow |
| [API.md](../../docs/API.md) | `/ingest`, `/extract-only` |

## Pipeline stages

```
adapters (url | text | video) → extract → transform → load (+ embedding)
```

| Stage | Path |
|-------|------|
| Entry | `supabase/functions/recipe-pipeline/index.ts` |
| Adapters | `adapters/url-adapter.ts`, `text-adapter.ts`, `video-adapter.ts` |
| Shared | `_shared/platform-oembed.ts`, `link-extractor.ts`, `transcribe-media.ts`, `video-url-utils.ts` |
| Stages | `stages/extract.ts`, `transform.ts`, `load.ts` |
| Prompts | `supabase/functions/_shared/recipe-prompts.ts` |

## Video intake (MOP-0016)

| Path | What |
|------|------|
| Paste TikTok/YouTube URL | oEmbed caption → link-extractor → optional url-adapter |
| Upload saved video | `videoFrameExtractor.ts` → `media_url` + `frame_urls` → Whisper STT + VL OCR |
| Pinned comment | `pinned_comment_text` on pipeline body (user paste) |
| Frontend | `src/services/videoIntake.ts`, `useRecipePipeline.ts`, chat video attach |

**Models:** Whisper `openai/whisper-large-v3`, Qwen VL `qwen/qwen-2.5-vl-7b-instruct`, Qwen `qwen/qwen-2.5-7b-instruct`. Requires `OPENROUTER_API_KEY`.

**Not done:** TikTok CDN download, comment scraping, Instagram oEmbed, `RecipeIntake.tsx` modal.

## Recipes library (UI + API)

| Surface | Files |
|---------|-------|
| List/detail | `src/components/recipes/`, `src/pages/Recipes.tsx` |
| Save + similar | `StructuredRecipeDisplay.tsx`, `checkSimilarRecipes` |
| API | `api.ts` — CRUD, `ingestRecipe*`, `uploadIntakeMedia`, `searchRecipesText` |

## Common failure modes

1. **URL fetch failed** — generic URL only; TikTok/YouTube should use video adapter (check `isShortFormVideoUrl`).
2. **Empty extract from TikTok URL** — caption may be thin; upload saved video or paste `pinned_comment_text`.
3. **Transcription failed** — `OPENROUTER_API_KEY` missing or Whisper unavailable (check Gemini fallback in logs).
4. **Video too large** — 24MB cap; trim clip or compress before upload.
5. **No embedding after edit** — `needs_reembed` flag (MOP-0015).

## Tests

- `api.test.ts` — recipe CRUD, duplicate, ingest-related describes
- `RecipeCard.test.tsx`
- `_shared/link-extractor_test.ts` (Deno)
- Deno tests under `recipe-pipeline/__tests__` (when added)
