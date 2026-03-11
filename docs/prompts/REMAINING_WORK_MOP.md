# MOP: Remaining Work to Complete the Centralized ETL Pipeline

**Created:** 2026-03-10
**Author:** Nick Neal + Claude
**Status:** Active
**Plan reference:** `.claude/plans/whimsical-singing-swan.md`

---

## Overview

Phases 1–4 of the ETL pipeline are code-complete. This MOP covers the remaining work to reach production-ready status: deployment, testing, frontend UI integration (Phase 5), and cleanup.

---

## Phase A: Deploy Edge Functions

**Goal:** Get `recipe-pipeline` and updated `chat-api` running on Supabase.

### A.1 — Set Edge Function Secrets

The edge functions require these environment variables. Set them via the Supabase CLI:

```bash
# OpenRouter API key (used by both chat-api and recipe-pipeline)
npx supabase secrets set OPENROUTER_API_KEY=sk-or-v1-<your-key>

# n8n webhook URL (used by chat-api for RAG search)
npx supabase secrets set N8N_RAG_WEBHOOK_URL=<your-n8n-url>
```

**Verification:**
```bash
npx supabase secrets list
```

Confirm `OPENROUTER_API_KEY` and `N8N_RAG_WEBHOOK_URL` appear in the list.

> **Note:** `SUPABASE_URL` and `SUPABASE_ANON_KEY` are automatically available to edge functions — do not set them manually.

### A.2 — Deploy recipe-pipeline

```bash
npx supabase functions deploy recipe-pipeline --project-ref tiibvcgnxnpgvygmqzvu
```

**Verification:**
```bash
curl -s https://tiibvcgnxnpgvygmqzvu.supabase.co/functions/v1/recipe-pipeline/health \
  -H "Authorization: Bearer <ANON_KEY>" | jq .
```

Expected response:
```json
{
  "status": "OK",
  "service": "recipe-pipeline",
  "timestamp": "..."
}
```

### A.3 — Deploy chat-api

```bash
npx supabase functions deploy chat-api --project-ref tiibvcgnxnpgvygmqzvu
```

**Verification:**
```bash
curl -s https://tiibvcgnxnpgvygmqzvu.supabase.co/functions/v1/chat-api/health \
  -H "Authorization: Bearer <ANON_KEY>" | jq .
```

Expected:
```json
{
  "status": "OK",
  "timestamp": "...",
  "openRouterConfigured": true,
  "n8nConfigured": true
}
```

If `openRouterConfigured` is `false`, the `OPENROUTER_API_KEY` secret was not set correctly (repeat A.1).

---

## Phase B: End-to-End Testing

**Goal:** Verify each intake method works through the full pipeline.

### B.1 — Text Intake (Happy Path)

```bash
# Get a valid JWT token first (sign in via the app, copy from browser DevTools > Application > Local Storage > sb-<ref>-auth-token)

TOKEN="<user-jwt>"

curl -X POST https://tiibvcgnxnpgvygmqzvu.supabase.co/functions/v1/recipe-pipeline/ingest \
  -H "Authorization: Bearer $TOKEN" \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "source_type": "text",
    "text": "Classic Chocolate Chip Cookies\n\nIngredients:\n- 2 1/4 cups flour\n- 1 tsp baking soda\n- 1 tsp salt\n- 1 cup butter, softened\n- 3/4 cup sugar\n- 3/4 cup brown sugar\n- 2 eggs\n- 2 tsp vanilla\n- 2 cups chocolate chips\n\nInstructions:\n1. Preheat oven to 375°F\n2. Mix flour, baking soda, salt\n3. Beat butter and sugars until creamy\n4. Add eggs and vanilla\n5. Gradually blend in flour mixture\n6. Stir in chocolate chips\n7. Drop by tablespoon onto baking sheets\n8. Bake 9-11 minutes until golden brown",
    "auto_save": true
  }'
```

**Expected:** `{ "success": true, "recipe_id": "uuid", "recipe": { "title": "Classic Chocolate Chip Cookies", ... } }`

**DB verification:**
```sql
SELECT id, title, slug, servings, difficulty, embedding_vector IS NOT NULL as has_embedding
FROM recipes
WHERE title ILIKE '%chocolate chip%'
ORDER BY created_at DESC
LIMIT 1;
```

### B.2 — Text Intake (Extract Only — No Save)

```bash
curl -X POST https://tiibvcgnxnpgvygmqzvu.supabase.co/functions/v1/recipe-pipeline/extract-only \
  -H "Authorization: Bearer $TOKEN" \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "source_type": "text",
    "text": "Simple Pasta: Boil 1lb spaghetti. Saute 3 cloves garlic in olive oil. Toss together with parmesan."
  }'
```

**Expected:** `{ "success": true, "recipe": { ... } }` — no `recipe_id` (not saved).

**DB verification:** Confirm NO new recipe was inserted.

### B.3 — URL Intake

```bash
curl -X POST https://tiibvcgnxnpgvygmqzvu.supabase.co/functions/v1/recipe-pipeline/ingest \
  -H "Authorization: Bearer $TOKEN" \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "source_type": "url",
    "url": "https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/",
    "auto_save": false
  }'
```

**Expected:** Recipe extracted with title, ingredients, instructions from the page's JSON-LD or HTML content.

> **Note:** Some sites block server-side fetching. If this fails with `URL_FETCH_FAILED`, try a different recipe URL or test with a simpler site.

### B.4 — Duplicate Check

Run B.1 again with the same recipe title.

**Expected:** `{ "success": false, "errors": [{ "stage": "load", "code": "DUPLICATE_RECIPE", ... }] }`

### B.5 — Chat Flow Integration

1. Open the app at `http://localhost:5173`
2. Sign in and navigate to Chat
3. Send a message like: "Here's a recipe: Banana Bread. Ingredients: 3 bananas, 1/3 cup melted butter, 3/4 cup sugar, 1 egg, 1 tsp vanilla, 1 tsp baking soda, pinch of salt, 1 1/3 cups flour. Instructions: Preheat to 350. Mash bananas, mix in butter, sugar, egg, vanilla. Add dry ingredients. Pour into loaf pan. Bake 60 min."
4. Verify the intent is detected as `recipe_extraction`
5. Verify the recipe is extracted and displayed for review

---

## Phase C: Frontend UI (Plan Phase 5)

**Goal:** Add UI for URL and video intake to the recipe creation experience.

### C.1 — Recipe Intake Component

Create a new component that provides multiple intake options:

**File:** `src/components/recipes/RecipeIntake.tsx`

**Requirements:**
- Tab or button group to select intake method: "Paste Text", "Import from URL", "Import from Video"
- Text tab: textarea with "Extract Recipe" button → calls `apiClient.ingestRecipeFromText()`
- URL tab: URL input with "Import" button → calls `apiClient.ingestRecipeFromUrl()`
- Video tab: URL input for YouTube + optional file upload for frames → calls `apiClient.ingestRecipeFromVideo()`
- All tabs initially use `auto_save: false` to show a preview before saving
- Preview displays the extracted recipe with an "Save Recipe" / "Edit & Save" / "Discard" action bar

### C.2 — React Query Hooks

Create hooks wrapping the API client methods:

**File:** `src/hooks/useRecipePipeline.ts`

```typescript
export const useIngestRecipe = () => {
  return useMutation({
    mutationFn: (params: { sourceType: 'url' | 'text' | 'video', data: any, autoSave?: boolean }) => {
      // Route to appropriate API method based on sourceType
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
    }
  })
}

export const useExtractRecipePreview = () => {
  return useMutation({
    mutationFn: (params: { sourceType: 'url' | 'text' | 'video', data: any }) => {
      return apiClient.extractRecipeOnly(params.sourceType, params.data)
    }
  })
}
```

### C.3 — Integration Points

- Add "Import Recipe" button/option to the Recipes page header
- Add intake options to the Chat page (e.g., attachment button for URLs/images)
- Wire up the RecipeIntake component as a modal or dedicated page route

### C.4 — Video Frame Extraction (Frontend)

For non-YouTube videos (user uploads), the frontend needs to extract keyframes:

```typescript
// src/utils/videoFrameExtractor.ts
export async function extractFrames(videoFile: File, count = 5): Promise<string[]> {
  // 1. Create a <video> element
  // 2. Seek to evenly-spaced timestamps
  // 3. Draw each frame to <canvas>
  // 4. Export as base64 data URLs
  // Return array of base64 image strings
}
```

These frames get passed to `apiClient.ingestRecipeFromVideo({ frame_urls: [...] })`.

---

## Phase D: Cleanup & Hardening

### D.1 — Remove Migration Backups

Once the squashed migrations are confirmed stable:

```bash
rm -rf supabase/migrations_backup/
```

### D.2 — Remove Old Supabase Project References

- Remove `vcovstjdevclkxxkiwic` from Google OAuth Authorized Domains
- Verify no other config references the old project

### D.3 — Rotate Exposed Secrets

The following were exposed in screenshots during development:
- **Google OAuth Client Secret** — Rotate in Google Cloud Console > Credentials > Reset Secret, then update in Supabase Dashboard > Authentication > Providers > Google

### D.4 — Git Hygiene

- Review `.gitignore` to ensure `.env`, `.env.local`, and `supabase/functions/*/env.local` are excluded
- Commit all working changes on `feature/next-improvements`
- Create PR to merge into `main`

### D.5 — Documentation Update

Run the documentation update procedure (`docs/prompts/DOCUMENTATION_UPDATE_PROCEDURE.md`) after merging to update:
- ARCHITECTURE.md — Add recipe-pipeline edge function, shared modules
- API.md — Add pipeline endpoints (/ingest, /extract-only, /health)
- CHANGELOG.md — Record all changes from this branch
- RUNBOOK.md — Add pipeline-specific troubleshooting entries

---

## Phase E: Future — Discord Bot (Deferred)

**Status:** Deferred per user decision. Design considerations for when it's picked up:

- Discord bot receives recipe messages in a channel
- Bot calls `recipe-pipeline/ingest` with `source_type: "text"` and the message content
- Bot needs a service account JWT (not a user JWT) — requires a dedicated Supabase user or service role key
- Bot should respond with the extracted recipe title and a confirmation/rejection prompt
- Consider: Discord webhook vs. full bot (slash commands)

---

## Execution Order

| Step | Phase | Estimated Effort | Depends On |
|------|-------|-----------------|------------|
| 1 | A.1 — Set secrets | 5 min | Nothing |
| 2 | A.2 — Deploy recipe-pipeline | 5 min | A.1 |
| 3 | A.3 — Deploy chat-api | 5 min | A.1 |
| 4 | B.1–B.4 — API testing | 20 min | A.2, A.3 |
| 5 | B.5 — Chat flow test | 10 min | A.2, A.3 |
| 6 | C.1–C.3 — Frontend UI | 2-3 sessions | B.1–B.5 passing |
| 7 | C.4 — Video frame extraction | 1 session | C.1 |
| 8 | D.1–D.5 — Cleanup | 30 min | B.5 passing |
| 9 | E — Discord bot | Future | All above |

---

## Success Criteria

- [ ] Both edge functions deployed and responding to /health
- [ ] Text intake: recipe saved with embedding
- [ ] URL intake: recipe extracted from real website
- [ ] Duplicate detection working
- [ ] Chat flow: recipe extraction via pipeline delegation
- [ ] Frontend: users can import recipes via URL and text
- [ ] All secrets rotated, old project references removed
- [ ] PR merged to main with documentation updated
