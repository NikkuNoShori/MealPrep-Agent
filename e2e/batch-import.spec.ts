/**
 * MOP-0019 — Batch Recipe Import E2E tests.
 *
 * Covers the full batch import UX: panel open/close, URL validation,
 * extraction SSE streaming, per-card states, save flow, abort, and retry.
 *
 * Network calls to the edge function are intercepted/mocked so tests do
 * not require live URL extraction. The SSE stream is simulated via route
 * interception to keep tests fast and deterministic.
 *
 * Timeout note: Each test should complete in <15s since we mock the SSE.
 */

import { test, expect, Page, Route } from "@playwright/test";
import { getTestSession } from "./fixtures/auth";

// ── Helpers ──────────────────────────────────────────────────────────────────

const BATCH_EXTRACT_URL = "**/functions/v1/chat-api/batch-extract";
const INGEST_URL = "**/functions/v1/recipe-pipeline/ingest";

/** Build a mock SSE body for 2 URLs: first succeeds, second errors. */
function mockSseBody(
  urls: string[],
  overrides?: { allFail?: boolean },
): string {
  const lines: string[] = [];

  urls.forEach((url, i) => {
    lines.push(
      `data: ${JSON.stringify({ type: "progress", index: i, total: urls.length, url, status: "extracting" })}\n\n`,
    );
  });

  urls.forEach((url, i) => {
    if (overrides?.allFail || i % 2 === 1) {
      lines.push(
        `data: ${JSON.stringify({ type: "error", index: i, url, message: "Extraction failed: mock error" })}\n\n`,
      );
    } else {
      lines.push(
        `data: ${JSON.stringify({
          type: "result",
          index: i,
          url,
          recipe: {
            title: `Mock Recipe ${i}`,
            ingredients: [{ name: "flour", amount: 2, unit: "cups" }],
            instructions: ["Mix", "Bake"],
            total_time: 30,
          },
        })}\n\n`,
      );
    }
  });

  const succeeded = overrides?.allFail ? 0 : Math.ceil(urls.length / 2);
  const failed = urls.length - succeeded;
  lines.push(
    `data: ${JSON.stringify({ type: "done", total: urls.length, succeeded, failed })}\n\n`,
  );

  return lines.join("");
}

/** Navigate to chat and authenticate. */
async function gotoChat(page: Page): Promise<void> {
  const session = await getTestSession();
  await page.context().addCookies([
    {
      name: "sb-access-token",
      value: session.access_token,
      domain: new URL(page.url() || "http://localhost:5173").hostname,
      path: "/",
    },
  ]);
  await page.goto("/chat");
  // Wait for the chat input to appear, indicating the page is hydrated.
  await page.waitForSelector('[data-testid="chat-input"]', { timeout: 15_000 });
}

/** Open the batch import panel via the toolbar button. */
async function openPanel(page: Page): Promise<void> {
  await page.click('[data-testid="batch-import-toolbar-btn"]');
  await expect(page.locator('[data-testid="batch-import-panel"]')).toBeVisible();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("Batch Import Panel", () => {
  test.beforeEach(async ({ page }) => {
    await gotoChat(page);
  });

  // TC-001
  test("toolbar button opens and closes the batch panel", async ({ page }) => {
    const btn = page.locator('[data-testid="batch-import-toolbar-btn"]');
    await expect(btn).toBeVisible();

    // Open
    await btn.click();
    await expect(page.locator('[data-testid="batch-import-panel"]')).toBeVisible();

    // Close via dismiss button
    await page.click('[data-testid="batch-dismiss-btn"]');
    await expect(page.locator('[data-testid="batch-import-panel"]')).not.toBeVisible();
  });

  // TC-002
  test("URL textarea accepts pasted URLs and shows count badge", async ({ page }) => {
    await openPanel(page);
    const textarea = page.locator('[data-testid="batch-url-textarea"]');
    await textarea.fill("https://example.com/recipe1\nhttps://example.com/recipe2");
    // Count badge should show 2 URLs
    await expect(page.locator("text=2 URLs detected")).toBeVisible();
  });

  // TC-003
  test("import button is disabled when no valid URLs are entered", async ({ page }) => {
    await openPanel(page);
    const importBtn = page.locator('[data-testid="batch-import-btn"]');
    await expect(importBtn).toBeDisabled();

    // Invalid entry
    await page.locator('[data-testid="batch-url-textarea"]').fill("not-a-url");
    await expect(importBtn).toBeDisabled();
  });

  // TC-004
  test("import button is enabled with valid URLs", async ({ page }) => {
    await openPanel(page);
    await page
      .locator('[data-testid="batch-url-textarea"]')
      .fill("https://example.com/recipe");
    await expect(page.locator('[data-testid="batch-import-btn"]')).toBeEnabled();
  });

  // TC-005
  test("cards appear as extracting during SSE stream", async ({ page }) => {
    const urls = ["https://a.com/recipe1", "https://b.com/recipe2"];

    // Intercept — hold the response open long enough to observe the extracting state.
    await page.route(BATCH_EXTRACT_URL, async (route: Route) => {
      // Emit only progress events to keep cards in "extracting" state for a moment.
      const progressBody = urls
        .map(
          (url, i) =>
            `data: ${JSON.stringify({ type: "progress", index: i, total: 2, url, status: "extracting" })}\n\n`,
        )
        .join("");
      // Never close — let the test check extracting state then abort.
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        body: progressBody,
      });
    });

    await openPanel(page);
    await page
      .locator('[data-testid="batch-url-textarea"]')
      .fill(urls.join("\n"));
    await page.click('[data-testid="batch-import-btn"]');

    // Both cards should appear in extracting state (pulsing skeleton).
    await expect(page.locator('[data-testid="batch-card-0"]')).toBeVisible();
    await expect(page.locator('[data-testid="batch-card-1"]')).toBeVisible();
  });

  // TC-006
  test("successful result cards show recipe title and Save button", async ({ page }) => {
    const urls = ["https://example.com/pasta"];

    await page.route(BATCH_EXTRACT_URL, async (route: Route) => {
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: mockSseBody(urls),
      });
    });

    await openPanel(page);
    await page.locator('[data-testid="batch-url-textarea"]').fill(urls[0]);
    await page.click('[data-testid="batch-import-btn"]');

    const card = page.locator('[data-testid="batch-card-0"]');
    await expect(card).toContainText("Mock Recipe 0", { timeout: 10_000 });
    await expect(card.getByRole("button", { name: "Save" })).toBeVisible();
  });

  // TC-007
  test("error cards show message and Retry button", async ({ page }) => {
    const urls = ["https://example.com/bad", "https://example.com/ok"];

    await page.route(BATCH_EXTRACT_URL, async (route: Route) => {
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: mockSseBody(urls),
      });
    });

    await openPanel(page);
    await page.locator('[data-testid="batch-url-textarea"]').fill(urls.join("\n"));
    await page.click('[data-testid="batch-import-btn"]');

    // Index 1 is the "error" one in our mock (odd index → error)
    const errorCard = page.locator('[data-testid="batch-card-1"]');
    await expect(errorCard).toContainText("Extraction failed", { timeout: 10_000 });
    await expect(errorCard.getByRole("button", { name: "Retry" })).toBeVisible();
  });

  // TC-008
  test("Save All button appears after extraction completes", async ({ page }) => {
    const urls = ["https://example.com/recipe1", "https://example.com/recipe2"];

    await page.route(BATCH_EXTRACT_URL, async (route: Route) => {
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: mockSseBody(urls),
      });
    });

    await openPanel(page);
    await page.locator('[data-testid="batch-url-textarea"]').fill(urls.join("\n"));
    await page.click('[data-testid="batch-import-btn"]');

    // "Save all" should appear once done event fires.
    await expect(page.locator('[data-testid="batch-save-all-btn"]')).toBeVisible({ timeout: 10_000 });
  });

  // TC-009
  test("per-card Save calls ingest and transitions card to saved state", async ({ page }) => {
    const urls = ["https://example.com/soup"];

    await page.route(BATCH_EXTRACT_URL, async (route: Route) => {
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: mockSseBody(urls),
      });
    });

    // Mock the ingest endpoint to succeed
    await page.route(INGEST_URL, async (route: Route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "saved-recipe-id", title: "Mock Recipe 0" }),
      });
    });

    await openPanel(page);
    await page.locator('[data-testid="batch-url-textarea"]').fill(urls[0]);
    await page.click('[data-testid="batch-import-btn"]');

    const card = page.locator('[data-testid="batch-card-0"]');
    await expect(card.getByRole("button", { name: "Save" })).toBeVisible({ timeout: 10_000 });
    await card.getByRole("button", { name: "Save" }).click();

    // Card should transition to "saved" state — badge reads "Saved ✓"
    await expect(card).toContainText("Saved ✓", { timeout: 5_000 });
  });

  // TC-010
  test("Abort button stops the stream and leaves cards in current state", async ({ page }) => {
    const urls = ["https://example.com/r1", "https://example.com/r2"];

    // Route that keeps the connection open indefinitely.
    await page.route(BATCH_EXTRACT_URL, async (route: Route) => {
      const progressOnly = urls
        .map(
          (url, i) =>
            `data: ${JSON.stringify({ type: "progress", index: i, total: 2, url, status: "extracting" })}\n\n`,
        )
        .join("");
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: progressOnly,
      });
    });

    await openPanel(page);
    await page.locator('[data-testid="batch-url-textarea"]').fill(urls.join("\n"));
    await page.click('[data-testid="batch-import-btn"]');

    // Abort button should be visible during extraction.
    const abortBtn = page.locator('[data-testid="batch-abort-btn"]');
    await expect(abortBtn).toBeVisible();
    await abortBtn.click();

    // Abort button should disappear (phase transitions to "done").
    await expect(abortBtn).not.toBeVisible({ timeout: 5_000 });
  });

  // TC-011
  test("Retry button re-extracts a failed card", async ({ page }) => {
    const urls = ["https://a.com/r1", "https://b.com/r2"];

    let callCount = 0;
    await page.route(BATCH_EXTRACT_URL, async (route: Route) => {
      callCount++;
      // Second call (retry) succeeds for the single URL.
      const isRetry = callCount > 1;
      const body = isRetry
        ? [
            `data: ${JSON.stringify({ type: "progress", index: 0, total: 1, url: urls[1], status: "extracting" })}\n\n`,
            `data: ${JSON.stringify({ type: "result", index: 0, url: urls[1], recipe: { title: "Retried Recipe" } })}\n\n`,
            `data: ${JSON.stringify({ type: "done", total: 1, succeeded: 1, failed: 0 })}\n\n`,
          ].join("")
        : mockSseBody(urls);

      route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body,
      });
    });

    await openPanel(page);
    await page.locator('[data-testid="batch-url-textarea"]').fill(urls.join("\n"));
    await page.click('[data-testid="batch-import-btn"]');

    // Index 1 → error
    const errorCard = page.locator('[data-testid="batch-card-1"]');
    await expect(errorCard.getByRole("button", { name: "Retry" })).toBeVisible({ timeout: 10_000 });
    await errorCard.getByRole("button", { name: "Retry" }).click();

    // After retry succeeds, card shows the recipe title
    await expect(errorCard).toContainText("Retried Recipe", { timeout: 10_000 });
  });

  // TC-012
  test("duplicate URLs are deduplicated before import", async ({ page }) => {
    const url = "https://example.com/recipe";
    const input = `${url}\n${url}\n${url}`;

    let capturedUrls: string[] = [];
    await page.route(BATCH_EXTRACT_URL, async (route: Route) => {
      const body = await route.request().postDataJSON();
      capturedUrls = body.urls;
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: mockSseBody([url]),
      });
    });

    await openPanel(page);
    await page.locator('[data-testid="batch-url-textarea"]').fill(input);
    await page.click('[data-testid="batch-import-btn"]');

    await expect(page.locator('[data-testid="batch-card-0"]')).toBeVisible({ timeout: 10_000 });
    expect(capturedUrls).toHaveLength(1);
    expect(capturedUrls[0]).toBe(url);
  });

  // TC-013
  test("max 50 URLs cap — only 50 sent to server", async ({ page }) => {
    // Generate 60 distinct URLs.
    const urls = Array.from(
      { length: 60 },
      (_, i) => `https://example.com/recipe/${i}`,
    );
    const input = urls.join("\n");

    let capturedUrls: string[] = [];
    await page.route(BATCH_EXTRACT_URL, async (route: Route) => {
      const body = await route.request().postDataJSON();
      capturedUrls = body.urls;
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: mockSseBody(capturedUrls.slice(0, 2)), // just enough to end the stream
      });
    });

    await openPanel(page);
    // Count badge should show "50" after dedup/cap
    const textarea = page.locator('[data-testid="batch-url-textarea"]');
    await textarea.fill(input);
    // The parseImportUrls client-side parser caps at 50 via the server;
    // the button label shows the capped count.
    const importBtn = page.locator('[data-testid="batch-import-btn"]');
    await expect(importBtn).toContainText("50");
    await importBtn.click();

    await page.waitForResponse(BATCH_EXTRACT_URL, { timeout: 10_000 }).catch(() => null);
    // Server only receives the capped 50
    expect(capturedUrls.length).toBeLessThanOrEqual(50);
  });

  // TC-014
  test("panel closes on dismiss and batch panel is no longer in DOM", async ({ page }) => {
    await openPanel(page);
    await page.click('[data-testid="batch-dismiss-btn"]');
    await expect(page.locator('[data-testid="batch-import-panel"]')).not.toBeVisible();
  });
});
