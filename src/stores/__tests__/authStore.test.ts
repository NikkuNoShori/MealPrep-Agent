import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HttpResponse } from 'msw';
import { authService, supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores/authStore';
import { server } from '@/test/msw/server';
import { supabaseSelect } from '@/test/msw/handlers';

// The auth store leans on `authService.getUser()` / `getLinkedAccounts()`
// (which themselves wrap supabase-js auth) plus direct PostgREST reads for
// household + role. supabase-js short-circuits when no session is in storage,
// so we mock `authService` directly and let MSW intercept the table reads.

beforeEach(() => {
  // Reset Zustand state between tests so each starts from the documented
  // defaults. authStore exports a single store instance (singleton), so
  // state leaks across tests unless we reset it explicitly.
  useAuthStore.setState({
    user: null,
    isLoading: true,
    error: null,
    linkedAccounts: [],
    household: null,
    appRole: null,
    isAdmin: false,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useAuthStore.initialize', () => {
  it('sets user to null and isLoading=false when there is no session', async () => {
    vi.spyOn(authService, 'getUser').mockResolvedValue(null);

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.household).toBeNull();
    expect(state.linkedAccounts).toEqual([]);
  });

  it('populates user, linked accounts, household, and admin role when signed in', async () => {
    vi.spyOn(authService, 'getUser').mockResolvedValue({
      id: 'u-1',
      email: 'alice@example.com',
      display_name: 'Alice',
    } as any);
    vi.spyOn(authService, 'getLinkedAccounts').mockResolvedValue([
      { provider: 'google', id: 'i-1', created_at: '2026-01-01T00:00:00Z' },
    ]);

    // .maybeSingle() with the `application/vnd.pgrst.object+json` Accept
    // header expects a single object on success, not an array.
    server.use(
      supabaseSelect('household_members', {
        household_id: 'h-1',
        role: 'owner',
        households: { name: 'Smith Family' },
      }),
      supabaseSelect('user_roles', {
        roles: { name: 'admin' },
      })
    );

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.user).toMatchObject({ id: 'u-1', email: 'alice@example.com' });
    expect(state.isLoading).toBe(false);
    expect(state.linkedAccounts).toHaveLength(1);
    expect(state.household).toEqual({
      householdId: 'h-1',
      householdName: 'Smith Family',
      role: 'owner',
    });
    expect(state.appRole).toBe('admin');
    expect(state.isAdmin).toBe(true);
  });

  it('falls back to appRole="user" when no role row is found', async () => {
    vi.spyOn(authService, 'getUser').mockResolvedValue({
      id: 'u-1',
      email: 'bob@example.com',
    } as any);
    vi.spyOn(authService, 'getLinkedAccounts').mockResolvedValue([]);

    server.use(
      supabaseSelect('household_members', null),
      // PostgREST returns 406 if maybeSingle() sees zero rows in some
      // setups; an empty 200 body is the safer cross-version stub.
      supabaseSelect('user_roles', null)
    );

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.appRole).toBe('user');
    expect(state.isAdmin).toBe(false);
  });

  it('does not block initialization when the household query fails', async () => {
    vi.spyOn(authService, 'getUser').mockResolvedValue({
      id: 'u-1',
      email: 'alice@example.com',
    } as any);
    vi.spyOn(authService, 'getLinkedAccounts').mockResolvedValue([]);

    server.use(
      supabaseSelect('household_members', () =>
        HttpResponse.json(
          { message: 'permission denied', code: '42501' },
          { status: 403 }
        )
      ),
      supabaseSelect('user_roles', null)
    );

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    // Initialization still completes even when household load fails — the
    // catch block in initialize() swallows it (table may not exist yet).
    expect(state.isLoading).toBe(false);
    expect(state.user).toMatchObject({ id: 'u-1' });
    expect(state.household).toBeNull();
  });
});

describe('useAuthStore.loadHousehold', () => {
  it('sets household state when the membership query returns a row', async () => {
    vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: { id: 'u-1' } as any },
      error: null,
    } as any);

    server.use(
      supabaseSelect('household_members', {
        household_id: 'h-1',
        role: 'member',
        households: { name: 'My House' },
      })
    );

    await useAuthStore.getState().loadHousehold();

    expect(useAuthStore.getState().household).toEqual({
      householdId: 'h-1',
      householdName: 'My House',
      role: 'member',
    });
  });

  it('clears household state when the user has no membership', async () => {
    vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: { id: 'u-1' } as any },
      error: null,
    } as any);

    // Seed an existing household so we can prove it gets cleared.
    useAuthStore.setState({
      household: { householdId: 'h-old', householdName: 'Old', role: 'owner' },
    });

    server.use(supabaseSelect('household_members', null));

    await useAuthStore.getState().loadHousehold();

    expect(useAuthStore.getState().household).toBeNull();
  });
});

describe('useAuthStore.signOut', () => {
  it('clears user, linked accounts, household, and admin flags', async () => {
    vi.spyOn(authService, 'signOut').mockResolvedValue({ success: true } as any);

    // Pre-load some signed-in state so we can prove it gets cleared.
    useAuthStore.setState({
      user: { id: 'u-1', email: 'alice@example.com' } as any,
      linkedAccounts: [
        { provider: 'google', id: 'i-1', created_at: '2026-01-01T00:00:00Z' },
      ],
      household: {
        householdId: 'h-1',
        householdName: 'Smith Family',
        role: 'owner',
      },
      appRole: 'admin',
      isAdmin: true,
    });

    await useAuthStore.getState().signOut();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.linkedAccounts).toEqual([]);
    expect(state.household).toBeNull();
    expect(state.appRole).toBeNull();
    expect(state.isAdmin).toBe(false);
    expect(state.isLoading).toBe(false);
  });

  it('propagates sign-out errors and sets the error message', async () => {
    vi.spyOn(authService, 'signOut').mockRejectedValue(
      new Error('network down')
    );

    useAuthStore.setState({
      user: { id: 'u-1' } as any,
    });

    await expect(useAuthStore.getState().signOut()).rejects.toThrow(
      'network down'
    );

    expect(useAuthStore.getState().error).toBe('network down');
  });
});
