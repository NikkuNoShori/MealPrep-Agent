# Video Intake + Chat Agent (MOP-0008/0016) — 2026-06-16

## Summary
Implemented the tool-using chat agent loop (MOP-0008) and video recipe intake (MOP-0016 phases 1–3b): frame extraction, speech-to-text, OCR, keyframe picker, image + source credit on save, inline recipe editing from chat, and stop/draft/queue chat UX. Session ended feature-complete pending a smoke test and `recipe-pipeline` deploy before merging.

## What changed (committed)

> Note: This entry was written before the git-verification rule was established. Commit hashes were not recorded. The branch at time of writing was `cursor/mop-0008-golden-routing-video-intake`. Cross-check `git log` against this branch for the authoritative list.

- Chat agent tool-use fix — `qwen/qwen3-8b` model wired with `require_parameters`
- Video intake pipeline — frames, STT, OCR, keyframe picker (`src/utils/recipeImagePicker.ts`, `src/services/videoIntake.ts`)
- Image + source credit persisted on recipe save
- `persist-extraction` route + chat history refetch (`supabase/functions/chat-api/conversation-context.ts`, `index.ts`)
- Stop / draft / queue chat UX
- `draftRecipeStore` + React Query `staleTime` constants (`src/stores/draftRecipeStore.ts`, `src/config/queryCache.ts`)
- Inline recipe edit from chat card + RecipeForm
- Recipes default tab changed to My Recipes
- `chat-api` edge function deployed by Nick
- Documentation updated 2026-06-16 (canonical set + MOP-0016)

## Uncommitted / in-flight

> Note: `git status` was not verified at time of writing. The entry noted "large diff on feature branch, code + docs uncommitted." Cross-check actual state with `git status` on branch `cursor/mop-0008-golden-routing-video-intake` before assuming anything below is current.

- All code and docs changes were uncommitted on the feature branch at session end

## Decisions and reasoning

- **`previewImageDataUrl` is memory-only** — lost on full page refresh by design; thumbnail URL survives via metadata/sessionStorage. Intentional tradeoff to avoid storing base64 in DB.
- **TikTok thumbnail CORS** — leaves external `image_url` on save as an expected fallback. Not a bug.
- **Pre-deploy extractions not in DB** — only video chats after `chat-api` deploy persist. Historical chats are not backfilled; accepted as out of scope.

## Known issues / things that look wrong but aren't (or are)

- `previewImageDataUrl` disappearing on refresh looks like a bug but is intentional — see Decisions above.
- TikTok recipes may show an external image URL — also intentional fallback, not broken.

## Suggested next steps

1. Deploy `recipe-pipeline` if not already: `npx supabase functions deploy recipe-pipeline`
2. Smoke test:
   - Video upload in chat → recipe card → edit ingredient → Save → image + source on recipe
   - Switch chats / refresh → video conversation visible in history with recipe card
   - Stop button cancels long extraction
   - Type while loading; Enter queues follow-up text
3. Commit code + docs on branch (code commit, then separate `docs:` commit)
4. Open PR → merge after CI green
