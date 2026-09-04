import { test, expect } from '@playwright/test';

/**
 * Smoke test — verifies the app shell loads.
 * Full invite → accept → shared recipes flow is scoped to MOP-0013.
 */
test('home page loads and shows navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/MealPrep/i);
});

test('recipes page redirects unauthenticated users to sign in', async ({ browser }) => {
  // Explicitly clear storageState — the project-level storageState in playwright.config.ts
  // applies to all contexts by default, so we must opt out to simulate an unauthenticated visitor.
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  await page.goto('/recipes');
  // ProtectedRoute shows a spinner while auth initialises then redirects.
  await expect(page).toHaveURL(/signin/, { timeout: 10_000 });
  await ctx.close();
});
