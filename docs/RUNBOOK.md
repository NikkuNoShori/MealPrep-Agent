# Runbook

> Operational debugging checklists for MealPrep Agent. Each entry covers a known failure mode with symptoms, causes, verification, and fix steps.

**Last reviewed:** 2026-06-16
**Last updated:** 2026-06-16 (video intake history, persist-extraction deploy, thumbnail CORS, chat stop/queue troubleshooting)

---

## Auth: Google OAuth sign-in fails with redirect error

### Symptom
- User clicks "Sign in with Google" and gets an error page or is redirected back to sign-in without being authenticated
- Console shows OAuth redirect mismatch or CORS errors

### Likely causes
- Google OAuth redirect URI not configured in Supabase Dashboard
- `VITE_SUPABASE_URL` mismatch between frontend env and Supabase project
- Google Cloud Console OAuth client misconfigured

### Verification steps
```bash
# Check frontend env
grep VITE_SUPABASE_URL .env

# Verify Supabase auth settings via dashboard:
# Authentication → Providers → Google → Redirect URL
```

### Fix steps
1. In Supabase Dashboard: Authentication → URL Configuration → add your frontend URL to "Redirect URLs"
2. In Google Cloud Console: APIs & Services → Credentials → OAuth client → add redirect URI matching Supabase's callback URL
3. Ensure `VITE_SUPABASE_URL` matches the actual Supabase project URL

**Added:** 2026-03-10

---

## Auth: Profile not created after sign-up

### Symptom
- User signs up successfully but has no profile data
- Settings page shows blank fields
- Console errors about missing profile

### Likely causes
- `handle_new_user()` trigger not firing or erroring
- Trigger function dropped during migration

### Verification steps
```sql
-- Check if trigger exists
SELECT tgname, tgrelid::regclass
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';

-- Check if user has a profile
SELECT * FROM profiles WHERE id = '<user-uuid>';

-- Check trigger function
SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user';
```

### Fix steps
1. If trigger is missing, recreate it:
```sql
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```
2. For existing users without profiles, manually insert:
```sql
INSERT INTO profiles (id, email, display_name)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', email)
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles);
```

**Added:** 2026-03-10

---

## Chat: AI responses return empty or error

### Symptom
- Chat messages sent but no AI response received
- Console shows 401, 429, or 500 from OpenRouter
- "Failed to get AI response" error in UI

### Likely causes
- `OPENROUTER_API_KEY` Supabase Edge Function secret expired, invalid, or missing
- OpenRouter rate limit exceeded
- Model ID changed or deprecated
- Network/CORS issues

### Verification steps
```bash
# Verify the Supabase secret is set (server-side, not in .env)
supabase secrets list | grep OPENROUTER_API_KEY

# Test the key directly using the value from your Supabase secrets
# (replace <key> with the value from `supabase secrets list` or your secrets vault)
curl -s https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer <key>" | head -20

# Check if specific model is available
curl -s https://openrouter.ai/api/v1/models | grep "qwen/qwen-2.5-7b-instruct"
```

> **Note:** Do not look for `VITE_OPENROUTER_API_KEY` in `.env` — the frontend has no LLM path. All AI calls go through Supabase Edge Functions using the server-side `OPENROUTER_API_KEY` secret.

### Fix steps
1. Verify API key at https://openrouter.ai/keys
2. Check credit balance at https://openrouter.ai/activity
3. If model deprecated, update model IDs in `src/lib/openrouter.ts` and `supabase/functions/chat-api/index.ts`
4. Restart dev server after env changes

**Added:** 2026-03-10

---

## Search: Semantic search returns no results

### Symptom
- User searches for recipes but gets zero results despite having matching recipes
- Text search works but semantic search doesn't

### Likely causes
- Recipe embeddings not generated (embedding_vector is NULL)
- pgvector extension not enabled
- Embedding dimension mismatch
- Similarity threshold too high

### Verification steps
```sql
-- Check how many recipes have embeddings
SELECT
  COUNT(*) as total_recipes,
  COUNT(embedding_vector) as with_embeddings,
  COUNT(*) - COUNT(embedding_vector) as missing_embeddings
FROM recipes
WHERE user_id = '<user-uuid>';

-- Check pgvector extension
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Check vector dimensions
SELECT id, title, array_length(embedding_vector::text::text[], 1) as dims
FROM recipes
WHERE embedding_vector IS NOT NULL
LIMIT 5;

-- Test search function directly
SELECT * FROM search_recipes_semantic(
  '<embedding-vector>'::vector(1536),
  '<user-uuid>'::uuid,
  0.3,  -- lower threshold for testing
  5
);
```

### Fix steps
1. If embeddings are NULL, regenerate them through the chat interface or by calling `embeddingService.generateRecipeEmbedding(recipe)`
2. If pgvector is missing: `CREATE EXTENSION IF NOT EXISTS vector;`
3. Lower the similarity threshold in `src/services/database.js` if results are borderline

**Added:** 2026-03-10

---

## Search: Full-text search returns no results

### Symptom
- Text search returns nothing for terms that should match
- Semantic search works but text search doesn't

### Likely causes
- `searchable_text` column is NULL or empty
- Trigger `update_recipe_searchable_text_trigger` not firing
- GIN index missing

### Verification steps
```sql
-- Check searchable_text values
SELECT id, title, LEFT(searchable_text, 100) as search_text_preview
FROM recipes
WHERE user_id = '<user-uuid>'
LIMIT 10;

-- Check trigger exists
SELECT tgname FROM pg_trigger WHERE tgname = 'update_recipe_searchable_text_trigger';

-- Test text search directly
SELECT * FROM search_recipes_text('chicken', '<user-uuid>', 10);
```

### Fix steps
1. If `searchable_text` is NULL, rebuild it:
```sql
UPDATE recipes SET updated_at = now()
WHERE searchable_text IS NULL;
-- This triggers the update_recipe_searchable_text function
```
2. If trigger is missing, recreate from migration 007/008

**Added:** 2026-03-10

---

## Database: RLS blocking legitimate queries

### Symptom
- Queries return empty results even though data exists
- `permission denied` errors in console
- Works with service role key but not anon key

### Likely causes
- JWT not being sent with request
- RLS policy references wrong column
- User ID mismatch between auth.users and profiles

### Verification steps
```sql
-- Check RLS is enabled on the table
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- Check policies for a specific table
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'recipes';

-- Verify user exists in both auth.users and profiles
SELECT au.id, p.id as profile_id, au.email
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
WHERE au.email = '<user-email>';
```

### Fix steps
1. Ensure Supabase client is initialized with the user's session
2. Check that the JWT contains the correct `sub` (user ID)
3. If policies are wrong, review and fix against migration 013

**Added:** 2026-03-10

---

## Storage: Recipe image upload fails

### Symptom
- Image upload shows error or spinner that never completes
- Console shows 403 or "bucket not found" errors

### Likely causes
- `recipe-images` bucket doesn't exist
- Storage policies not configured
- File too large (>5MB) or wrong MIME type

### Verification steps
```sql
-- Check bucket exists
SELECT * FROM storage.buckets WHERE id = 'recipe-images';

-- Check storage policies
SELECT * FROM storage.objects
WHERE bucket_id = 'recipe-images'
LIMIT 5;
```

### Fix steps
1. If bucket missing, create it:
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('recipe-images', 'recipe-images', false);
```
2. Run storage policy setup: `supabase/setup_storage_policies.sql`
3. Verify file is under 5MB and is an image type

**Added:** 2026-03-10

---

## Measurement: Units not converting

### Symptom
- Changing measurement system in Settings doesn't affect recipe display
- Recipes always show metric/imperial regardless of preference

### Likely causes
- `measurement_system` column missing from `user_preferences`
- `MeasurementSystemContext` not wrapping the component tree
- Preference not synced to database

### Verification steps
```sql
-- Check column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'user_preferences'
AND column_name = 'measurement_system';

-- Check user's preference
SELECT measurement_system
FROM user_preferences
WHERE user_id = '<user-uuid>';
```

### Fix steps
1. If column missing, run migrations 016 and 017
2. Verify `MeasurementSystemContext` wraps app in `src/main.tsx`
3. Check `src/hooks/useMeasurementUnits.ts` and `src/utils/unitConverter.ts` for conversion logic

**Added:** 2026-03-10

---

## Edge Function: chat-api returns 500

### Symptom
- Chat messages fail with server error
- Supabase function logs show errors

### Likely causes
- `OPENROUTER_API_KEY` not set in Supabase Edge Function secrets
- Function code has a runtime error
- Supabase project paused

### Verification steps
```bash
# Check edge function logs
supabase functions logs chat-api --project-ref <project-ref>

# Test locally
supabase functions serve chat-api --env-file .env.local
```

### Fix steps
1. Set secrets: `supabase secrets set OPENROUTER_API_KEY=<key>`
2. Deploy latest: `supabase functions deploy chat-api`
3. Check Supabase dashboard for project status

**Added:** 2026-03-10

---

## Layout: Whitespace or overflow on pages

### Symptom
- Whitespace at the bottom or sides of pages
- Double scrollbars
- Content overflows instead of fitting the viewport
- Chat page has dead space below the input

### Likely causes
- CSS height chain broken: `html`, `body`, or `#root` missing `height: 100%`
- Page component uses `min-h-screen` (creates content taller than viewport)
- Page content wrapped in unnecessary `h-full overflow-y-auto` div (double scroll container)
- Chat page not using `absolute inset-0` (resolves height against scroll content instead of viewport)

### Verification steps
```bash
# Check index.css for height chain
grep -A3 'html, body, #root' src/index.css

# Check Layout.tsx main element
grep 'overflow-y-auto' src/components/common/Layout.tsx

# Check for min-h-screen on page roots
grep -rn 'min-h-screen' src/pages/
```

### Fix steps
1. Ensure `src/index.css` has: `html, body, #root { height: 100%; margin: 0; padding: 0; overflow: hidden; }`
2. Ensure Layout's `<main>` has `flex-1 min-h-0 overflow-y-auto`
3. Remove any `h-full overflow-y-auto` wrapper divs from page components — pages should render content directly
4. Remove `min-h-screen` from page root elements
5. Chat.tsx must use `absolute inset-0 overflow-hidden` to opt out of main's scroll

**Added:** 2026-03-11

---

## Recipes: Connection refused (localhost:3000)

### Symptom
- Recipes page fails to load with `net::ERR_CONNECTION_REFUSED` to `localhost:3000`
- Console shows `GET http://localhost:3000/api/recipes/...` errors

### Likely causes
- Code is using `recipeService.ts` which hits a non-existent local API server instead of Supabase directly

### Verification steps
```bash
# Check which service the component imports
grep -n 'recipeService\|apiClient' src/pages/Recipes.tsx

# Verify recipeService targets localhost
grep -n 'localhost:3000\|LOCAL_API' src/services/recipeService.ts
```

### Fix steps
1. Replace `recipeService` imports with `apiClient` from `src/services/api.ts`
2. `apiClient` queries Supabase directly via the JS SDK — no local server needed
3. `apiClient.getRecipe(idOrSlug)` supports both UUID and slug-based lookups

**Added:** 2026-03-11

---

## Household: Infinite recursion in RLS policies

### Symptom
- 500 errors on `household_members`, `recipes`, or `family_members` queries
- PostgreSQL error: `infinite recursion detected in policy for relation "household_members"`
- Recipes page fails to load

### Likely causes
- `household_members` RLS policies reference `household_members` in subqueries, causing circular evaluation
- Any table policy that subqueries `household_members` triggers its RLS, which subqueries itself

### Verification steps
```sql
-- Check if helper functions exist
SELECT proname FROM pg_proc WHERE proname IN ('is_household_member', 'get_household_role');

-- Check if functions are SECURITY DEFINER (bypasses RLS)
SELECT proname, prosecdef FROM pg_proc WHERE proname IN ('is_household_member', 'get_household_role');

-- Check policies on household_members
SELECT policyname, qual FROM pg_policies WHERE tablename = 'household_members';
```

### Fix steps
1. Ensure `is_household_member()` and `get_household_role()` helper functions exist as `SECURITY DEFINER`
2. All policies on `household_members` must use these helpers instead of direct subqueries
3. All policies on other tables that reference `household_members` should also use these helpers
4. Re-run migration 009 or apply the helper functions + updated policies manually

**Added:** 2026-03-12

---

## Household: Profile not created with household on signup

### Symptom
- New user signs up but has no household
- `authStore.household` is null after login
- Household features don't work for new accounts

### Likely causes
- `handle_new_user()` trigger not updated to create household
- Migration 009 not applied

### Verification steps
```sql
-- Check if user has a household membership
SELECT * FROM household_members WHERE user_id = '<user-uuid>';

-- Check trigger function includes household creation
SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user';
```

### Fix steps
1. If migration 009 hasn't run, apply it
2. For existing users without households, run the backfill block from migration 009 section 4
3. Verify the trigger function creates both `households` and `household_members` rows

**Added:** 2026-03-12

---

## Development: Local dev server won't start

### Symptom
- `npm run dev` fails with errors
- Port conflicts or missing env vars

### Likely causes
- Missing `.env` file or required variables
- Node modules not installed
- Port 5173 in use

### Verification steps
```bash
# Check env file exists
ls -la .env

# Check required vars
grep VITE_SUPABASE_URL .env
grep VITE_SUPABASE_ANON_KEY .env

# OpenRouter key is a Supabase Edge Function secret, NOT a frontend env var
supabase secrets list | grep OPENROUTER_API_KEY

# Check node_modules
ls node_modules/.package-lock.json 2>/dev/null
```

### Fix steps
1. Copy `.env.example` to `.env` and fill in values
2. Run `npm install`
3. Kill process on port 5173: `npx kill-port 5173`
4. Run `npm run dev`

**Added:** 2026-03-10

---

## Migration: DROP COLUMN fails with "other objects depend on it"

### Symptom
- `supabase db push` fails with `SQLSTATE 2BP01`
- Error: `cannot drop column X of table Y because other objects depend on it`
- Lists RLS policies that reference the column being dropped

### Likely causes
- RLS policies reference the column in their USING/WITH CHECK expressions
- The migration attempts to drop the column before dropping the dependent policies

### Verification steps
```sql
-- Find all policies on a table
SELECT policyname, qual, with_check FROM pg_policies WHERE tablename = 'recipes';
```

### Fix steps
1. In the migration, DROP all RLS policies that reference the column **before** the ALTER TABLE DROP COLUMN
2. Recreate the policies without the dropped column reference after the column is removed
3. If the migration already partially ran, repair it first: `supabase migration repair --status reverted <version>`
4. Then push again: `supabase db push`

**Added:** 2026-03-12

---

## Household: Members show as "Unknown"

### Symptom
- Household page shows member names as "Unknown" instead of actual display names
- Member avatars don't load
- Own profile shows correctly, other members do not

### Likely causes
- Profiles RLS policy only allows viewing own profile — cross-household profile reads are blocked
- Migration 024 (`household_member_profile_visibility`) not applied

### Verification steps
```sql
-- Check if the cross-household profile visibility policy exists
SELECT policyname FROM pg_policies
WHERE tablename = 'profiles'
  AND policyname LIKE '%household%';

-- Should return: "Household members can view each other's profiles"
```

### Fix steps
1. Apply migration 024 which adds the household member profile visibility policy
2. Alternatively, RPC functions using `SECURITY DEFINER` (migration 025) bypass RLS entirely for profile reads

**Added:** 2026-03-14

---

## Household: Invite email not received

### Symptom
- Owner sends invite but invitee never receives email
- Invite row exists in `household_invites` with status `pending`
- No error shown in the UI

### Likely causes
- Supabase email sending limits reached (free tier: ~4 emails/hour)
- Email provider blocking Supabase transactional emails
- `household-invite` edge function not deployed
- `SUPABASE_SERVICE_ROLE_KEY` not set in edge function secrets (needed for `auth.admin.inviteUserByEmail()`)

### Verification steps
```sql
-- Check invite was created
SELECT id, invited_email, status, created_at
FROM household_invites
WHERE household_id = '<household-uuid>'
ORDER BY created_at DESC;
```
```bash
# Check edge function logs
supabase functions logs household-invite --project-ref <project-ref>
```

### Fix steps
1. Verify edge function is deployed: `supabase functions deploy household-invite`
2. Set service role key: `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<key>`
3. Check Supabase Dashboard → Authentication → Email Templates for invite template
4. For testing, check spam folder; Supabase default sender may be flagged

**Added:** 2026-03-14

---

## Auth: User stuck on Complete Setup page

### Symptom
- User completes the setup form but is redirected back to `/complete-setup`
- User cannot access the app after signing up
- `setup_completed` remains `false` in profiles

### Likely causes
- Profile upsert in CompleteSetup failed silently
- `setup_completed` column missing (migration 020 not applied)
- `ProtectedRoute` redirect loop when `setup_completed = false`

### Verification steps
```sql
-- Check user's setup status
SELECT id, email, display_name, username, setup_completed
FROM profiles
WHERE email = '<user-email>';
```

### Fix steps
1. If `setup_completed` column missing, apply migration 020
2. Manually fix for a specific user:
```sql
UPDATE profiles SET setup_completed = true WHERE email = '<user-email>';
```
3. Check browser console for errors during the setup form submission

**Added:** 2026-03-14

---

## Household: RPC functions return errors after migration

### Symptom
- Household page, recipe reactions, or invite pages fail with "function does not exist" error
- Console shows `42883` PostgreSQL error code
- App worked before with multi-query approach

### Likely causes
- Migration 025 (RPC functions) not applied to the database
- Frontend code updated but database not yet migrated

### Verification steps
```sql
-- Check if RPC functions exist
SELECT proname FROM pg_proc
WHERE proname IN (
  'get_my_household',
  'toggle_recipe_reaction',
  'get_household_recipes',
  'get_recipe_reactions',
  'get_my_pending_invites'
);
-- Should return 5 rows
```

### Fix steps
1. Apply migration 025: `supabase db push` or run the SQL in Supabase SQL Editor
2. Verify all 5 functions exist with the query above
3. Verify grants: `SELECT * FROM information_schema.routine_privileges WHERE routine_name = 'get_my_household';`

**Added:** 2026-03-14

---

## Chat: Video extraction missing from history after refresh

### Symptom
- User uploaded a video in chat, saw a recipe preview card, but after switching chats or refreshing the page the conversation is empty or lacks the recipe card

### Likely causes
- `chat-api` not deployed with `POST /chat-api/persist-extraction` (older function version)
- `persist-extraction` failed silently (check browser console for `Failed to persist video extraction`)
- Conversation never received a DB `conversationId` (temp numeric id only)
- User is viewing a conversation loaded before persist completed (stale sidebar cache)

### Verification steps
```sql
-- Replace with your user id
SELECT c.id, c.title, m.sender, m.message_type, m.content,
       m.metadata->>'source' AS source,
       m.metadata->'recipe'->>'title' AS recipe_title
FROM chat_conversations c
JOIN chat_messages m ON m.conversation_id = c.id
WHERE c.user_id = '<user-uuid>'
ORDER BY m.created_at DESC
LIMIT 20;
```

```bash
# Confirm persist-extraction route exists in deployed function
curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$SUPABASE_URL/functions/v1/chat-api/persist-extraction" \
  -H "Authorization: Bearer $JWT" -H "apikey: $ANON" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test","assistantContent":"hi"}'
# Expect 400 (missing fields) — NOT 404
```

### Fix steps
1. Deploy latest: `npx supabase functions deploy chat-api`
2. Re-run video extraction (pre-deploy sessions are not backfilled)
3. Click the conversation in the sidebar (triggers `GET /chat-api/history?conversationId=…` refetch)

**Added:** 2026-06-16

---

## Chat: Agent returns 404 or "tool use" errors (OpenRouter)

### Symptom
- Chat replies with "Sorry, I encountered an error"
- Edge logs show OpenRouter 404 or no tool-capable endpoint for the model

### Likely causes
- Agent model set to `qwen/qwen-2.5-7b-instruct` (no tool-use endpoints on OpenRouter)
- `OPENROUTER_AGENT_MODEL` secret points at a non-tool model
- Missing `require_parameters` on OpenRouter provider routing

### Verification steps
```bash
supabase functions logs chat-api --project-ref <project-ref>
# Look for OpenRouter 404 or "No endpoints found"
```

Check `supabase/functions/chat-api/agent-loop.ts` — default should be `qwen/qwen3-8b`.

### Fix steps
1. Deploy latest `chat-api`
2. Optional override: `npx supabase secrets set OPENROUTER_AGENT_MODEL=qwen/qwen3-8b`
3. Confirm `_shared/openrouter-client.ts` `chatWithTools` sends `provider: { require_parameters: true }`

**Added:** 2026-06-16

---

## Recipe save: Thumbnail image missing or external URL only

### Symptom
- Saved recipe has no image, or `image_url` points to TikTok/YouTube CDN instead of Supabase Storage

### Likely causes
- Client-side fetch of platform thumbnail blocked by CORS (TikTok)
- User refreshed before save (in-memory keyframe `previewImageDataUrl` lost)
- Only `thumbnail_url` in metadata — fetch/upload failed on save

### Verification steps
- Browser Network tab during Save: look for failed `fetch` to `*.tiktokcdn.com` or similar
- Check `recipes.image_url` — should contain `/storage/v1/object/` and `recipe-images` when upload succeeded

### Fix steps
1. Expected fallback: external platform URL stored when CORS blocks client fetch
2. For reliable hosted images: ensure video upload path ran (client keyframe upload on save)
3. Future: server-side thumbnail mirror in `recipe-pipeline` (not yet shipped)

**Added:** 2026-06-16

---

## Chat: Cannot type or stop during long extraction

### Symptom
- Composer disabled while "Transcribing video…" or "Thinking…"
- No way to cancel a long-running request

### Likely causes
- Running an older `ChatInterface` build (pre-2026-06-16 UX)

### Expected behavior (current)
- Textarea stays enabled for drafting; Enter queues one text message while loading
- Stop button on loading bubble and red square replaces Send — aborts in-flight `fetch` via `AbortSignal`

### Fix steps
1. Hard-refresh the SPA after merging latest frontend
2. If Stop does not abort video pipeline, deploy latest `chat-api` + `recipe-pipeline` and confirm `extractRecipeOnly` receives client abort signal

**Added:** 2026-06-16
