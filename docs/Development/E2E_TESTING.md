# E2E Testing Guide

**Runner:** Playwright (Chromium)  
**Test user:** `nick@transcensionsolutions.com` (dedicated test account, not a real user)  
**Auth state:** Cached in `e2e/.auth/user.json` — regenerated on first run via `global-setup.ts`

---

## Quick Start

```bash
# 1. Ensure the dev server is running (separate terminal)
npm run dev

# 2. Run all E2E tests
npm run test:e2e

# 3. Interactive UI mode (best for debugging)
npm run test:e2e:ui

# 4. Run headed (see the browser)
npm run test:e2e:headed

# 5. Run a single spec file
npx playwright test e2e/chat.spec.ts

# 6. Run a single test by name
npx playwright test -g "sends a message and receives an AI reply"

# 7. Debug a specific test (step through in browser)
npm run test:e2e:debug
```

---

## File Layout

```
e2e/
  global-setup.ts          # Signs in once, saves auth state to .auth/user.json
  .auth/
    user.json              # Cached session — gitignored, auto-generated
  fixtures/
    auth.ts                # getTestSession() + authenticated test fixture
    test-data.ts           # createTestRecipe(), deleteTestRecipe(), etc.
  smoke.spec.ts            # Unauthenticated smoke tests (app shell loads)
  golden-path.spec.ts      # Authenticated navigation + page-load tests
  chat.spec.ts             # AI chat tool tests (search, extract, save, etc.)
```

---

## Test Credentials

Stored in `.env.test` (gitignored — never committed):

```
PLAYWRIGHT_TEST_EMAIL=nick@transcensionsolutions.com
PLAYWRIGHT_TEST_PASSWORD=TestUser123!
```

Do **not** use your personal `nickneal17@gmail.com` account for tests. The test account is a dedicated throwaway.

---

## How Auth Works

1. `global-setup.ts` runs once before all tests — signs in via the UI and saves `storageState` to `e2e/.auth/user.json`.
2. `playwright.config.ts` passes `storageState` to every test context — so every test starts already logged in.
3. Individual tests that need an API token call `getTestSession()` from `fixtures/auth.ts` — this hits the Supabase Auth REST endpoint directly (no browser).

If auth breaks (expired session, password change), delete `e2e/.auth/user.json` and re-run — it regenerates automatically.

---

## How Test Data Works

Tests create isolated data **before** they run and delete it **after**, even on failure:

```ts
test.beforeAll(async () => {
  const s = await session();
  recipe = await createTestRecipe(s.access_token, s.user.id, { title: 'My Test Recipe' });
});

test.afterAll(async () => {
  await deleteTestRecipe(s.access_token, recipe.id).catch(() => {});
  await cleanupE2ERecipes(s.access_token).catch(() => {}); // safety net
});
```

All test recipes are tagged `['e2e-test']`. `cleanupE2ERecipes()` bulk-deletes all of them — useful as a safety net when a test crashes mid-cleanup.

---

## Writing New Tests

### Adding a chat tool test

```ts
import { test, expect } from '@playwright/test';
import { sendMessage, waitForAIResponse } from './helpers'; // (or inline)

test('agent does X when asked', async ({ page }) => {
  test.setTimeout(90_000); // AI responses can take 10–60s
  await page.goto('/chat');
  await page.locator('textarea').last().waitFor({ state: 'visible' });

  await sendMessage(page, 'Do X for me');
  const aiMsg = await waitForAIResponse(page, { timeout: 70_000 });
  const text = await aiMsg.innerText();
  expect(text).toContain('expected output');
});
```

### Timeouts

| Scenario | Recommended timeout |
|----------|-------------------|
| Simple chat (no tools) | 30s |
| Search tool | 60s |
| Extraction from text | 90s |
| Extraction from URL | 120s |
| Multi-tool chain | 120s |

---

## CI Notes (MOP-0013 Phase 5 — not yet set up)

When CI exists, add to the workflow:

```yaml
- name: Install Playwright browsers
  run: npx playwright install chromium

- name: Run E2E tests
  run: npm run test:e2e
  env:
    PLAYWRIGHT_TEST_EMAIL: ${{ secrets.E2E_TEST_EMAIL }}
    PLAYWRIGHT_TEST_PASSWORD: ${{ secrets.E2E_TEST_PASSWORD }}
    VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
    VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
    PLAYWRIGHT_SKIP_WEBSERVER: 1  # CI spins up its own server

- name: Upload Playwright report on failure
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: playwright-report
    path: playwright-report/
```

---

## Troubleshooting

**Auth state expired / test starts on sign-in page**  
→ Delete `e2e/.auth/user.json` and re-run. Global setup will regenerate it.

**AI response timeout**  
→ Increase `test.setTimeout()`. Edge function cold starts can add 10–15s.

**"No active meal plan found" from grocery tests**  
→ The test's `beforeAll` creates a plan with `status: 'active'`. If it fails to create, check the test user's RLS — the Supabase project must have the test user's `user_id` in `meal_plans`.

**Test data left behind after a crash**  
→ Run `cleanupE2ERecipes` and `cleanupE2EMealPlans` manually from a script, or delete via Supabase dashboard filtering by the `e2e-test` tag.
