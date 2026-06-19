# Session Handoff

**Last session:** 2026-06-16  
**Branch:** `cursor/mop-0008-golden-routing-video-intake`  
**Status:** Feature-complete for merge pending smoke test + `recipe-pipeline` deploy. **Docs updated 2026-06-16** (canonical set + MOP-0016).

---

## ✅ Done this session

| Area | Status |
|------|--------|
| Chat agent tool-use fix (`qwen/qwen3-8b`, `require_parameters`) | Shipped in code |
| Video intake (frames, STT, OCR, keyframe picker) | Shipped |
| Image + source credit on save | Shipped |
| `persist-extraction` + history refetch | Shipped |
| Stop / draft / queue chat UX | Shipped |
| `draftRecipeStore` + React Query `staleTime` | Shipped |
| Inline recipe edit (chat card + RecipeForm) | Shipped |
| Recipes default tab → My Recipes | Shipped |
| **`chat-api` deploy** | ✅ Nick deployed |
| **Documentation update** | ✅ 2026-06-16 |
| **Git commit** | ❌ Uncommitted (code + docs on branch) |

---

## ⏳ Before merging to `main`

1. **Deploy `recipe-pipeline`** (if not already):
   ```bash
   npx supabase functions deploy recipe-pipeline
   ```
2. **Smoke test** (~10 min):
   - [ ] Video upload in chat → recipe card → edit ingredient → Save → image + source on recipe
   - [ ] Switch chats / refresh → video conversation visible in history with recipe card
   - [ ] Stop button cancels long extraction
   - [ ] Type while loading; Enter queues follow-up text
3. **Commit** code + docs on branch (separate commits OK: code then `docs:` commit)
4. **Open PR** → merge after CI green

---

## 📁 Key new files

| Path | Purpose |
|------|---------|
| `src/stores/draftRecipeStore.ts` | Unsaved preview edits; sessionStorage (no base64) |
| `src/config/queryCache.ts` | React Query `staleTime` constants |
| `src/utils/recipeImagePicker.ts` | Best keyframe selection |
| `src/services/videoIntake.ts` | URL vs upload orchestration |
| `supabase/functions/chat-api/conversation-context.ts` | Recipe in agent history |
| `supabase/functions/chat-api/index.ts` | `persist-extraction` route |

---

## 🗂 MOP status

| MOP | Status | Notes |
|-----|--------|-------|
| **0008** | `complete` | Agent loop + confirmation UI |
| **0016** | `in_progress` | Phases 1–3b shipped; Phase 4 smoke + `recipe-pipeline` deploy |

---

## 🪤 Gotchas

1. **Pre-deploy extractions** are not in DB — only new video chats after `chat-api` deploy persist.
2. **`previewImageDataUrl`** is memory-only — lost on full page refresh; thumbnail URL survives via metadata/sessionStorage.
3. **TikTok thumbnail CORS** may leave external `image_url` on save — expected fallback.
4. **Uncommitted work** — run `git status` before merge; large diff on feature branch.

---

## 📋 Suggested first action on return

Run the smoke checklist above, deploy `recipe-pipeline` if needed, then commit + PR.
