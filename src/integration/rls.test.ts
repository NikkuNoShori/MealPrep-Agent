/**
 * MOP-0005 Phase 2 — RLS & visibility integration tests (opt-in).
 *
 * No Docker or local Supabase required. Credentials come from `.env`:
 *   SUPABASE_URL (or VITE_SUPABASE_URL)
 *   SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_KEY)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Run only when you intend to hit a real project (prefer staging):
 *   RUN_INTEGRATION_TESTS=1 npx vitest run --project integration
 *
 * Skipped by default in `npm run test:run`.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { resolveIntegrationConfig } from './env';

const RUN = process.env.RUN_INTEGRATION_TESTS === '1';

describe.skipIf(!RUN)('RLS recipe visibility (hosted Supabase)', () => {
  const password = 'TestPass123!';
  let admin!: SupabaseClient;
  let emailA = '';
  let emailB = '';
  let userAId = '';
  let privateRecipeId = '';
  let householdRecipeId = '';

  async function signInAs(email: string) {
    const { url, anonKey } = resolveIntegrationConfig();
    const client = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return client;
  }

  beforeAll(async () => {
    const { url, serviceRoleKey } = resolveIntegrationConfig();
    admin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const ts = Date.now();
    emailA = `rls-a-${ts}@test.local`;
    emailB = `rls-b-${ts}@test.local`;

    const { data: createdA, error: errA } = await admin.auth.admin.createUser({
      email: emailA,
      password,
      email_confirm: true,
    });
    if (errA) throw errA;
    userAId = createdA.user!.id;

    const { error: errB } = await admin.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
    });
    if (errB) throw errB;

    const { data: privateRecipe, error: privErr } = await admin
      .from('recipes')
      .insert({
        user_id: userAId,
        title: `RLS Private ${ts}`,
        slug: `rls-private-${ts}`,
        visibility: 'private',
        ingredients: [],
        instructions: [],
      })
      .select('id')
      .single();
    if (privErr) throw privErr;
    privateRecipeId = privateRecipe.id;

    const { data: householdRecipe, error: hhErr } = await admin
      .from('recipes')
      .insert({
        user_id: userAId,
        title: `RLS Household ${ts}`,
        slug: `rls-household-${ts}`,
        visibility: 'household',
        ingredients: [],
        instructions: [],
      })
      .select('id')
      .single();
    if (hhErr) throw hhErr;
    householdRecipeId = householdRecipe.id;
  }, 60_000);

  it('user B cannot read user A private recipe by id', async () => {
    const clientB = await signInAs(emailB);

    const { data, error } = await clientB
      .from('recipes')
      .select('id')
      .eq('id', privateRecipeId)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it('user B cannot read user A household recipe when not in the same household', async () => {
    const clientB = await signInAs(emailB);

    const { data, error } = await clientB
      .from('recipes')
      .select('id')
      .eq('id', householdRecipeId)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it('user A can read their own private recipe', async () => {
    const clientA = await signInAs(emailA);

    const { data, error } = await clientA
      .from('recipes')
      .select('id, title')
      .eq('id', privateRecipeId)
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBe(privateRecipeId);
  });
});
