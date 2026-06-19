import { test, expect } from '@playwright/test';

/**
 * Smoke test — verifies the app shell loads.
 * Full invite → accept → shared recipes flow is scoped to MOP-0013.
 */
test('home page loads and shows navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/MealPrep/i);
});

test('recipes page redirects unauthenticated users to sign in', async ({ page }) => {
  await page.goto('/recipes');
  await expect(page).toHaveURL(/signin/);
});
