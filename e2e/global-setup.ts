/**
 * Playwright global setup — runs once before all tests.
 * Signs in the test user via the UI and saves the auth state to
 * e2e/.auth/user.json so individual tests can reuse it without signing in.
 */
import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const AUTH_DIR = path.join(__dirname, '.auth');
const AUTH_FILE = path.join(AUTH_DIR, 'user.json');

export default async function globalSetup() {
  // Ensure the .auth directory exists.
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();

  const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
  const email = process.env.PLAYWRIGHT_TEST_EMAIL!;
  const password = process.env.PLAYWRIGHT_TEST_PASSWORD!;

  if (!email || !password) {
    throw new Error(
      'PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD must be set in .env.test'
    );
  }

  console.log(`[global-setup] Signing in as ${email}…`);

  await page.goto(`${baseURL}/signin`);
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('button[type="submit"]').click();

  // Wait for dashboard — gives up to 20s for the auth round-trip.
  await page.waitForURL('**/dashboard', { timeout: 20_000 });

  // Save auth state for all tests.
  await page.context().storageState({ path: AUTH_FILE });
  console.log(`[global-setup] Auth state saved to ${AUTH_FILE}`);

  await browser.close();
}
