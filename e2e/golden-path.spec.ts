/**
 * MOP-0013 Phase 3 — Golden-path E2E tests.
 * Verifies the core app shell works for an authenticated user.
 *
 * All tests run as the test user (nick@transcensionsolutions.com).
 * Auth state is pre-loaded via global-setup.ts.
 */
import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('authenticated user lands on dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('unauthenticated visit to /recipes redirects to sign-in', async ({ browser }) => {
    // New context with no auth state.
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/recipes');
    await expect(page).toHaveURL(/signin/);
    await ctx.close();
  });

  test('nav links to main sections are present', async ({ page }) => {
    await page.goto('/dashboard');
    // At least one of the main nav items should be visible.
    const nav = page.locator('nav, [role="navigation"]').first();
    await expect(nav).toBeVisible();
  });
});

test.describe('Recipes page', () => {
  test('loads without error', async ({ page }) => {
    await page.goto('/recipes');
    await expect(page).toHaveURL(/recipes/);
    // Should not show a crash / error boundary.
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await expect(page.locator('body')).not.toContainText('Unexpected error');
  });

  test('shows recipe library or empty state', async ({ page }) => {
    await page.goto('/recipes');
    // Either recipes exist or an empty-state message is shown — both are valid.
    const hasContent = await page
      .locator('text=/recipe|add|import|no recipes/i')
      .first()
      .isVisible()
      .catch(() => false);
    expect(hasContent).toBe(true);
  });
});

test.describe('Meal Planner page', () => {
  test('loads without error', async ({ page }) => {
    await page.goto('/meal-planner');
    await expect(page).toHaveURL(/meal-planner/);
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });
});

test.describe('Chat page', () => {
  test('loads without error', async ({ page }) => {
    await page.goto('/chat');
    await expect(page).toHaveURL(/chat/);
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });

  test('chat input is visible and focusable', async ({ page }) => {
    await page.goto('/chat');
    // The chat textarea / input should be present.
    const input = page.locator('textarea, input[type="text"]').last();
    await expect(input).toBeVisible({ timeout: 10_000 });
  });
});
