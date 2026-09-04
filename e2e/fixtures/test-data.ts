/**
 * Test data helpers — create and clean up test records via Supabase REST API.
 * All records are created under the test user's account and deleted after each test.
 *
 * Rules:
 * - Never hardcode IDs — always use the IDs returned from inserts.
 * - Always clean up in afterEach/afterAll, even on failure (try/finally).
 * - Never touch the remote DB outside of these helpers.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;

async function supabaseRequest(
  path: string,
  method: string,
  token: string,
  body?: unknown
): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: method === 'POST' ? 'return=representation' : '',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    throw new Error(`Supabase ${method} ${path} failed (${res.status}): ${text}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export interface TestRecipe {
  id: string;
  title: string;
}

export interface TestMealPlan {
  id: string;
  title: string;
}

/** Create a minimal recipe for the test user. Returns the created recipe. */
export async function createTestRecipe(
  token: string,
  userId: string,
  overrides: Partial<{
    title: string;
    description: string;
    ingredients: unknown[];
    instructions: string[];
    servings: number;
    difficulty: string;
  }> = {}
): Promise<TestRecipe> {
  const data = await supabaseRequest('recipes', 'POST', token, {
    user_id: userId,
    title: overrides.title ?? `E2E Test Recipe ${Date.now()}`,
    description: overrides.description ?? 'A test recipe created by Playwright',
    ingredients: overrides.ingredients ?? [
      { name: 'flour', amount: 2, unit: 'cups', category: 'pantry', notes: '' },
      { name: 'eggs', amount: 3, unit: '', category: 'protein', notes: '' },
    ],
    instructions: overrides.instructions ?? ['Mix ingredients.', 'Cook for 30 minutes.'],
    servings: overrides.servings ?? 4,
    difficulty: overrides.difficulty ?? 'easy',
    tags: ['e2e-test'],
    visibility: 'private',
    needs_reembed: false,
  }) as { id: string; title: string }[];

  const row = Array.isArray(data) ? data[0] : data as { id: string; title: string };
  return { id: row.id, title: row.title };
}

/** Create a minimal meal plan for the test user. */
export async function createTestMealPlan(
  token: string,
  userId: string,
  overrides: Partial<{
    title: string;
    start_date: string;
    end_date: string;
    status: string;
  }> = {}
): Promise<TestMealPlan> {
  const today = new Date().toISOString().split('T')[0];
  const weekOut = new Date(Date.now() + 6 * 86_400_000).toISOString().split('T')[0];

  const data = await supabaseRequest('meal_plans', 'POST', token, {
    user_id: userId,
    created_by: userId,
    last_edited_by: userId,
    title: overrides.title ?? `E2E Test Plan ${Date.now()}`,
    start_date: overrides.start_date ?? today,
    end_date: overrides.end_date ?? weekOut,
    meals: {},
    grocery_list: [],
    status: overrides.status ?? 'active',
  }) as { id: string; title: string }[];

  const row = Array.isArray(data) ? data[0] : data as { id: string; title: string };
  return { id: row.id, title: row.title };
}

/** Delete a recipe by ID. */
export async function deleteTestRecipe(token: string, id: string): Promise<void> {
  await supabaseRequest(`recipes?id=eq.${id}`, 'DELETE', token);
}

/** Delete a meal plan by ID. */
export async function deleteTestMealPlan(token: string, id: string): Promise<void> {
  await supabaseRequest(`meal_plans?id=eq.${id}`, 'DELETE', token);
}

/** Delete all recipes tagged e2e-test for the user (safety net cleanup). */
export async function cleanupE2ERecipes(token: string): Promise<void> {
  await supabaseRequest(`recipes?tags=cs.{e2e-test}`, 'DELETE', token);
}

/** Delete all meal plans with title containing E2E Test Plan. */
export async function cleanupE2EMealPlans(token: string): Promise<void> {
  await supabaseRequest(`meal_plans?title=like.*E2E Test Plan*`, 'DELETE', token);
}
