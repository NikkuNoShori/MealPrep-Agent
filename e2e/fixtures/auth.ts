/**
 * Auth fixture — signs in the test user programmatically via Supabase Auth API.
 * Stores session state in e2e/.auth/user.json so each test reuses the session
 * without re-logging in (Playwright storageState).
 *
 * Usage:
 *   import { test } from './auth';   // already authenticated page
 *   test('my test', async ({ page }) => { ... });
 */
import { test as base, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_FILE = path.join(__dirname, '../.auth/user.json');
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const TEST_EMAIL = process.env.PLAYWRIGHT_TEST_EMAIL!;
const TEST_PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD!;

/** Sign in via Supabase Auth REST API and return the access token. */
export async function getTestSession(): Promise<{
  access_token: string;
  refresh_token: string;
  user: { id: string; email: string };
}> {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Test user sign-in failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Global setup helper — call from e2e/global-setup.ts to cache the auth state
 * once before the entire test suite runs.
 */
export async function globalSignIn(page: import('@playwright/test').Page) {
  await page.goto('/signin');
  await page.locator('#email').fill(TEST_EMAIL);
  await page.locator('#password').fill(TEST_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 15_000 });
  await page.context().storageState({ path: AUTH_FILE });
}

/** Extended test fixture that automatically loads the saved auth state. */
export const test = base.extend<{ authFile: string }>({
  // eslint-disable-next-line no-empty-pattern
  authFile: [AUTH_FILE, { option: true }],

  page: async ({ browser, authFile }, use) => {
    const storageStateExists = fs.existsSync(authFile);
    const context = await browser.newContext(
      storageStateExists ? { storageState: authFile } : {}
    );
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect };
