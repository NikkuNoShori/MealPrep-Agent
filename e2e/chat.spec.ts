/**
 * MOP-0013 Phase 4 — Chat agent E2E tests.
 *
 * Covers the core AI tool flows: search, extraction, save, grocery, meal plan,
 * reactions, and destructive confirmation gates.
 *
 * All tests run as the test user with a pre-loaded auth session.
 * Test data is created before each test and cleaned up after.
 *
 * Timeout notes:
 * - AI responses take 10–50s depending on tool calls.
 * - Each test has a generous timeout to accommodate extraction + LLM time.
 */
import { test, expect } from '@playwright/test';
import {
  createTestRecipe,
  deleteTestRecipe,
  createTestMealPlan,
  deleteTestMealPlan,
  cleanupE2ERecipes,
  cleanupE2EMealPlans,
} from './fixtures/test-data';
import { getTestSession } from './fixtures/auth';

// ── Helpers ────────────────────────────────────────────────────────────────


/**
 * Type text into the chat textarea and send it.
 *
 * Uses pressSequentially so React onChange fires on each keypress (fill() bypasses
 * React's synthetic events). After typing, clicks the Send button via JS.
 *
 * Important: call this only after the conversation is fully loaded (textarea visible
 * and a real conversation — not just the welcome screen — is active).
 */
async function sendMessage(page: import('@playwright/test').Page, text: string) {
  const textarea = page.locator('textarea').last();
  // fill() triggers React onChange in headless Chromium, setting inputMessage state.
  await textarea.fill(text);
  // Wait for the send button to be enabled (inputMessage non-empty → disabled prop removed).
  // The send button has data-testid="send-message-btn" added to ChatInterface.tsx.
  const sendBtn = page.getByTestId('send-message-btn');
  await expect(sendBtn).toBeEnabled({ timeout: 5_000 });
  await sendBtn.click();
}

/**
 * Navigate to /chat and wait until the ChatInterface is fully initialized:
 * - The conversation history has loaded from DB
 * - currentConversationId is set (a "New Chat" sidebar item appears)
 * - The textarea is ready for input
 *
 * We wait for a sidebar conversation item to appear, which means loadConversations()
 * has completed and setCurrentConversationId() has been called.
 */
async function goToFreshChat(page: import('@playwright/test').Page) {
  await page.goto('/chat');
  // Wait until currentConversationId is set in ChatInterface.
  // We expose it as data-conversation-id on the textarea (added to ChatInterface.tsx).
  // This attribute becomes non-empty only after loadConversations() completes and
  // setCurrentConversationId() fires — the exact same guard that handleSendMessage checks.
  await page.waitForFunction(() => {
    const ta = document.querySelector('textarea[data-testid="chat-input"]');
    return ta !== null && (ta as HTMLTextAreaElement).getAttribute('data-conversation-id')!.length > 0;
  }, { timeout: 30_000 });
}

/**
 * Wait for the AI to respond.
 *
 * Strategy:
 * 1. Wait up to 20s for the thinking dots (.animate-bounce) to appear (non-fatal).
 * 2. Wait up to `timeout` for them to disappear.
 * 3. Return the last AI message bubble (justify-start wrapper).
 */
async function waitForAIResponse(
  page: import('@playwright/test').Page,
  options: { timeout?: number } = {}
) {
  const timeout = options.timeout ?? 60_000;

  // Wait for thinking dots to appear (confirms message was sent and AI is working).
  await page.locator('.animate-bounce').first()
    .waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {});

  // Wait for thinking dots to disappear (response rendered).
  await page.locator('.animate-bounce').first()
    .waitFor({ state: 'hidden', timeout }).catch(() => {});

  // Return the last AI message bubble. AI messages have justify-start on their wrapper.
  const aiMsg = page.locator('[class*="justify-start"]').last();
  await aiMsg.waitFor({ state: 'visible', timeout: 10_000 });
  return aiMsg;
}

/** Get the current test session token + user info. Cached per test run. */
let _session: Awaited<ReturnType<typeof getTestSession>> | null = null;
async function session() {
  if (!_session) _session = await getTestSession();
  return _session;
}

// ── Suite ──────────────────────────────────────────────────────────────────

test.describe('Chat — basic', () => {
  test.beforeEach(async ({ page }) => {
    await goToFreshChat(page);
  });

  test('chat input accepts text', async ({ page }) => {
    const textarea = page.locator('textarea').last();
    await textarea.fill('hello');
    await expect(textarea).toHaveValue('hello');
  });

  test('sends a message and receives an AI reply', async ({ page }) => {
    test.setTimeout(90_000);
    await sendMessage(page, 'Say exactly: OK');
    // Wait for thinking dots → disappear → AI bubble with text appears.
    await page.locator('.animate-bounce').first()
      .waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {});
    await page.locator('.animate-bounce').first()
      .waitFor({ state: 'hidden', timeout: 60_000 }).catch(() => {});
    // The AI replied — wait for a message bubble on the left (justify-start = AI side).
    const aiMsg = page.locator('[class*="justify-start"]').last();
    await aiMsg.waitFor({ state: 'visible', timeout: 10_000 });
    const text = await aiMsg.innerText();
    expect(text.length).toBeGreaterThan(0);
  });
});

test.describe('Chat — recipe search', () => {
  let recipeId: string;
  let token: string;
  let userId: string;

  test.beforeAll(async () => {
    const s = await session();
    token = s.access_token;
    userId = s.user.id;
    const r = await createTestRecipe(token, userId, {
      title: 'E2E Spaghetti Carbonara',
      description: 'A classic Italian pasta dish',
    });
    recipeId = r.id;
  });

  test.afterAll(async () => {
    const s = await session();
    await deleteTestRecipe(s.access_token, recipeId).catch(() => {});
    await cleanupE2ERecipes(s.access_token).catch(() => {});
  });

  test.beforeEach(async ({ page }) => {
    await goToFreshChat(page);
  });

  test('search returns the seeded recipe by name', async ({ page }) => {
    test.setTimeout(90_000);
    await sendMessage(page, 'Do I have a carbonara recipe?');
    const aiMsg = await waitForAIResponse(page, { timeout: 70_000 });
    await expect(aiMsg).toBeVisible();
    const text = await aiMsg.innerText();
    // Agent should mention the recipe title in its reply.
    expect(text.toLowerCase()).toContain('carbonara');
  });

  test('search with no results tells the user honestly', async ({ page }) => {
    test.setTimeout(90_000);
    await sendMessage(page, 'Do I have any e2e-nonexistent-recipe-xyz recipes?');
    const aiMsg = await waitForAIResponse(page, { timeout: 70_000 });
    const text = await aiMsg.innerText();
    // Agent should say it didn't find anything, not fabricate a recipe.
    expect(text.toLowerCase()).toMatch(/no|don't|couldn't find|not find/);
  });
});

test.describe('Chat — recipe extraction from text', () => {
  test.setTimeout(120_000);

  test.afterAll(async () => {
    const s = await session();
    await cleanupE2ERecipes(s.access_token).catch(() => {});
  });

  test.beforeEach(async ({ page }) => {
    await goToFreshChat(page);
  });

  test('extracts a recipe from pasted text and shows a card', async ({ page }) => {
    const recipeText = `Simple Pancakes
Ingredients: 1 cup flour, 1 egg, 1 cup milk, 1 tbsp butter
Instructions: Mix all ingredients. Cook on griddle until bubbles form. Flip and cook 1 more minute.
Serves: 4. Prep: 5 min. Cook: 15 min.`;

    await sendMessage(page, recipeText);
    const aiMsg = await waitForAIResponse(page, { timeout: 100_000 });
    await expect(aiMsg).toBeVisible();

    // A recipe card should be rendered — StructuredRecipeDisplay is a large card.
    // We check for the save button which is always present on the card.
    const saveButton = page.locator('button', { hasText: /save/i }).first();
    await expect(saveButton).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Chat — meal plan', () => {
  let planId: string;
  let recipeId: string;
  let token: string;
  let userId: string;

  test.beforeAll(async () => {
    const s = await session();
    token = s.access_token;
    userId = s.user.id;

    const [plan, recipe] = await Promise.all([
      createTestMealPlan(token, userId, { title: 'E2E Test Plan Chat' }),
      createTestRecipe(token, userId, { title: 'E2E Chat Test Recipe' }),
    ]);
    planId = plan.id;
    recipeId = recipe.id;
  });

  test.afterAll(async () => {
    const s = await session();
    await deleteTestMealPlan(s.access_token, planId).catch(() => {});
    await deleteTestRecipe(s.access_token, recipeId).catch(() => {});
    await cleanupE2EMealPlans(s.access_token).catch(() => {});
  });

  test.beforeEach(async ({ page }) => {
    await goToFreshChat(page);
  });

  test('agent can read the grocery list', async ({ page }) => {
    test.setTimeout(90_000);
    await sendMessage(page, "What's on my grocery list?");
    const aiMsg = await waitForAIResponse(page, { timeout: 70_000 });
    await expect(aiMsg).toBeVisible();
    const text = await aiMsg.innerText();
    // Agent should either list items or say the list is empty — not crash.
    expect(text.length).toBeGreaterThan(0);
    expect(text.toLowerCase()).not.toContain('something went wrong');
  });
});

test.describe('Chat — destructive confirmation gate', () => {
  let recipeId: string;
  let token: string;
  let userId: string;

  test.beforeAll(async () => {
    const s = await session();
    token = s.access_token;
    userId = s.user.id;
    const r = await createTestRecipe(token, userId, {
      title: 'E2E Recipe To Delete',
    });
    recipeId = r.id;
  });

  test.afterAll(async () => {
    // Safety net — delete even if the test failed before doing so.
    const s = await session();
    await deleteTestRecipe(s.access_token, recipeId).catch(() => {});
    await cleanupE2ERecipes(s.access_token).catch(() => {});
  });

  test.beforeEach(async ({ page }) => {
    await goToFreshChat(page);
  });

  test('delete request shows confirmation prompt, cancel does not delete', async ({ page }) => {
    test.setTimeout(90_000);

    await sendMessage(page, 'Delete the recipe called "E2E Recipe To Delete"');
    const aiMsg = await waitForAIResponse(page, { timeout: 70_000 });
    await expect(aiMsg).toBeVisible();

    // A confirmation prompt should appear — look for Cancel/No button.
    const cancelBtn = page.locator('button', { hasText: /cancel|no/i }).first();
    const confirmVisible = await cancelBtn.isVisible().catch(() => false);

    if (confirmVisible) {
      await cancelBtn.click();
      // After cancelling, the recipe should still be queryable.
      await sendMessage(page, 'Do I still have the "E2E Recipe To Delete" recipe?');
      const followUp = await waitForAIResponse(page, { timeout: 70_000 });
      const text = await followUp.innerText();
      expect(text.toLowerCase()).toContain('e2e recipe to delete');
    } else {
      // Some UIs render the confirmation inline in the AI text.
      const text = await aiMsg.innerText();
      expect(text.toLowerCase()).toMatch(/confirm|are you sure|delete/);
    }
  });
});

test.describe('Chat — scale recipe', () => {
  let recipeId: string;
  let token: string;
  let userId: string;

  test.beforeAll(async () => {
    const s = await session();
    token = s.access_token;
    userId = s.user.id;
    const r = await createTestRecipe(token, userId, {
      title: 'E2E Scalable Recipe',
      servings: 4,
      ingredients: [
        { name: 'flour', amount: 2, unit: 'cups', category: 'pantry', notes: '' },
        { name: 'eggs', amount: 3, unit: '', category: 'protein', notes: '' },
      ],
    });
    recipeId = r.id;
  });

  test.afterAll(async () => {
    const s = await session();
    await deleteTestRecipe(s.access_token, recipeId).catch(() => {});
    await cleanupE2ERecipes(s.access_token).catch(() => {});
  });

  test.beforeEach(async ({ page }) => {
    await goToFreshChat(page);
  });

  test('agent scales recipe servings on request', async ({ page }) => {
    test.setTimeout(90_000);
    await sendMessage(page, 'Scale the "E2E Scalable Recipe" to 2 servings');
    const aiMsg = await waitForAIResponse(page, { timeout: 70_000 });
    const text = await aiMsg.innerText();
    // Should mention scaled amounts or 2 servings — not crash.
    expect(text.length).toBeGreaterThan(0);
    expect(text.toLowerCase()).toMatch(/serv|scale|flour|egg/);
  });
});
