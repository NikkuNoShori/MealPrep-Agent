# Runbook

> Operational debugging checklists for MealPrep Agent. Each entry covers a known failure mode with symptoms, causes, verification, and fix steps.

**Last reviewed:** 2026-03-11
**Last updated:** 2026-03-11 (added layout whitespace and recipe service entries)

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
- `VITE_OPENROUTER_API_KEY` expired, invalid, or missing
- OpenRouter rate limit exceeded
- Model ID changed or deprecated
- Network/CORS issues

### Verification steps
```bash
# Check env var is set
grep OPENROUTER_API_KEY .env

# Test API key directly
curl -s https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer $VITE_OPENROUTER_API_KEY" | head -20

# Check if specific model is available
curl -s https://openrouter.ai/api/v1/models | grep "qwen/qwen-3-8b"
```

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
grep VITE_OPENROUTER_API_KEY .env

# Check node_modules
ls node_modules/.package-lock.json 2>/dev/null
```

### Fix steps
1. Copy `.env.example` to `.env` and fill in values
2. Run `npm install`
3. Kill process on port 5173: `npx kill-port 5173`
4. Run `npm run dev`

**Added:** 2026-03-10
