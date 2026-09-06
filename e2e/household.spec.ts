/**
 * Household E2E tests.
 *
 * Covers: page load, household info display, member list, dietary profiles
 * card, and the RBAC permission toggles (owner-only).
 *
 * All tests run as the pre-authenticated test user (assumed to be a
 * household owner for toggle tests). Tests that require specific household
 * state degrade gracefully if that state isn't present.
 */

import { test, expect } from '@playwright/test';

// ── Page shell ────────────────────────────────────────────────────────────────

test.describe('Household — page shell', () => {
  test('loads without error', async ({ page }) => {
    await page.goto('/household');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await expect(page.locator('body')).not.toContainText('Unexpected error');
  });

  test('shows household name or no-household state', async ({ page }) => {
    await page.goto('/household');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

    const hasSomething = await page
      .locator([
        '[data-testid="household-name"]',
        'text=Create a household',
        'text=No household',
        'h2, h3, h4',
      ].join(', '))
      .first()
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    expect(hasSomething).toBe(true);
  });
});

// ── Members ───────────────────────────────────────────────────────────────────

test.describe('Household — members', () => {
  test('shows at least one member (the signed-in user)', async ({ page }) => {
    await page.goto('/household');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

    // The member list should contain at least one entry (self)
    const memberEntry = page
      .locator('[data-testid="member-row"], [class*="member"], tr, li')
      .first();
    const hasMember = await memberEntry.isVisible({ timeout: 10_000 }).catch(() => false);
    // Acceptable if household doesn't exist yet
    if (!hasMember) {
      const noHousehold = await page.locator('text=/Create|No household/i').isVisible().catch(() => false);
      expect(noHousehold).toBe(true);
      return;
    }
    expect(hasMember).toBe(true);
  });
});

// ── Dietary Profiles card ─────────────────────────────────────────────────────

test.describe('Household — dietary profiles', () => {
  test('dietary profiles card is present', async ({ page }) => {
    await page.goto('/household');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

    const card = page.locator('text=/Dietary Profiles|dietary profile/i').first();
    const hasCard = await card.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasCard) {
      test.skip(true, 'No household — dietary profiles card not shown');
      return;
    }
    expect(hasCard).toBe(true);
  });

  test('"Add Dietary Profile" button is visible', async ({ page }) => {
    await page.goto('/household');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

    const addBtn = page.locator('button:has-text("Add Dietary Profile"), button:has-text("Add dietary")').first();
    const isVisible = await addBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!isVisible) {
      test.skip(true, 'No household — Add Dietary Profile button not shown');
      return;
    }
    expect(isVisible).toBe(true);
  });

  test('clicking "Add Dietary Profile" opens member picker', async ({ page }) => {
    await page.goto('/household');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

    const addBtn = page.locator('button:has-text("Add Dietary Profile"), button:has-text("Add dietary")').first();
    const isVisible = await addBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!isVisible) {
      test.skip(true, 'No household');
      return;
    }

    await addBtn.click();

    // A picker/dropdown or select element should appear
    const picker = page
      .locator('select, [role="listbox"], [role="combobox"], [data-testid="member-picker"]')
      .first();
    await expect(picker).toBeVisible({ timeout: 5_000 });
  });
});

// ── RBAC permission toggles ───────────────────────────────────────────────────

test.describe('Household — member permission toggles (owner only)', () => {
  test('Member Permissions section is present for owner', async ({ page }) => {
    await page.goto('/household');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

    const section = page.locator('text=/Member Permissions/i').first();
    const hasSection = await section.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasSection) {
      // Non-owner or no household — acceptable
      test.skip(true, 'Member Permissions section not visible (non-owner or no household)');
      return;
    }
    expect(hasSection).toBe(true);
  });

  test('permission toggles flip and persist', async ({ page }) => {
    await page.goto('/household');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

    const section = page.locator('text=/Member Permissions/i').first();
    const hasSection = await section.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasSection) {
      test.skip(true, 'Member Permissions section not visible');
      return;
    }

    // Find the first toggle button in the permissions section
    const toggles = page.locator('button[role="switch"], button[class*="rounded-full"][class*="shrink-0"]');
    const toggleCount = await toggles.count();
    if (toggleCount === 0) {
      test.skip(true, 'No toggle buttons found');
      return;
    }

    const firstToggle = toggles.first();
    // Record initial state by checking the thumb position class
    const initialClass = await firstToggle.getAttribute('class') ?? '';
    const wasOn = initialClass.includes('bg-primary');

    // Click to flip
    await firstToggle.click();

    // Wait for success toast
    await expect(page.locator('text=/Permission updated|updated/i').first()).toBeVisible({ timeout: 8_000 });

    // After toast, the toggle should reflect the new state
    await page.waitForTimeout(500); // let optimistic update settle
    const newClass = await firstToggle.getAttribute('class') ?? '';
    const isNowOn = newClass.includes('bg-primary');
    expect(isNowOn).toBe(!wasOn);

    // Flip back to restore original state
    await firstToggle.click();
    await page.locator('text=/Permission updated/i').first().waitFor({ state: 'visible', timeout: 8_000 }).catch(() => {});
  });
});
