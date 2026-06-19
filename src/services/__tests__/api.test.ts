import { describe, it, expect, vi, afterEach } from 'vitest';
import { HttpResponse } from 'msw';
import { apiClient } from '../api';
import { supabase } from '../supabase';
import { server } from '@/test/msw/server';
import {
  supabaseRpc,
  supabaseSelect,
  supabasePatch,
  supabaseDelete,
  supabaseInsert,
  supabaseEdgePost,
  supabaseEdgeGet,
} from '@/test/msw/handlers';

// Helper for tests against api.ts methods that call `supabase.auth.getUser()`.
// supabase-js short-circuits to a null user when no session is in storage, so
// MSW can't reach the network. We spy on the auth client directly — this is
// the narrow exception to the "MSW-only" rule called out in MOP-0005.
function mockCurrentUser(user: { id: string; email?: string }) {
  return vi
    .spyOn(supabase.auth, 'getUser')
    .mockResolvedValue({ data: { user: user as any }, error: null } as any);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('apiClient.getMyHousehold', () => {
  it('returns null when the RPC returns null (user has no household yet)', async () => {
    server.use(supabaseRpc('get_my_household', null));

    const result = await apiClient.getMyHousehold();

    expect(result).toBeNull();
  });

  it('converts snake_case RPC payload to camelCase', async () => {
    const snakePayload = {
      household_id: 'h-1',
      household_name: 'Smith Family',
      members: [
        {
          user_id: 'u-1',
          role: 'owner',
          display_name: 'Alice',
          joined_at: '2026-01-01T00:00:00Z',
        },
        {
          user_id: 'u-2',
          role: 'member',
          display_name: 'Bob',
          joined_at: '2026-02-01T00:00:00Z',
        },
      ],
      pending_invites: [
        { invite_code: 'abc123', invitee_email: 'carol@example.com' },
      ],
    };
    server.use(supabaseRpc('get_my_household', snakePayload));

    const result = await apiClient.getMyHousehold();

    expect(result).toEqual({
      householdId: 'h-1',
      householdName: 'Smith Family',
      members: [
        {
          userId: 'u-1',
          role: 'owner',
          displayName: 'Alice',
          joinedAt: '2026-01-01T00:00:00Z',
        },
        {
          userId: 'u-2',
          role: 'member',
          displayName: 'Bob',
          joinedAt: '2026-02-01T00:00:00Z',
        },
      ],
      pendingInvites: [
        { inviteCode: 'abc123', inviteeEmail: 'carol@example.com' },
      ],
    });
  });

  it('throws when the RPC responds with an error status', async () => {
    server.use(
      supabaseRpc(
        'get_my_household',
        () =>
          HttpResponse.json(
            { message: 'permission denied', code: '42501' },
            { status: 403 }
          )
      )
    );

    await expect(apiClient.getMyHousehold()).rejects.toThrow();
  });
});

describe('apiClient.updateMemberRole', () => {
  it('sends a PATCH with the new role and returns the camelCased row', async () => {
    let capturedBody: any = null;
    let capturedUrl = '';
    server.use(
      supabasePatch('household_members', async ({ request }) => {
        capturedUrl = request.url;
        capturedBody = await request.json();
        // .single() sends `Accept: application/vnd.pgrst.object+json`, so
        // PostgREST returns a single object (not an array) on success.
        return HttpResponse.json({
          id: 'm-1',
          household_id: 'h-1',
          user_id: 'u-2',
          role: 'admin',
          joined_at: '2026-02-01T00:00:00Z',
        });
      })
    );

    const result = await apiClient.updateMemberRole('m-1', 'admin');

    expect(capturedBody).toEqual({ role: 'admin' });
    expect(capturedUrl).toContain('id=eq.m-1');
    expect(result).toEqual({
      id: 'm-1',
      householdId: 'h-1',
      userId: 'u-2',
      role: 'admin',
      joinedAt: '2026-02-01T00:00:00Z',
    });
  });

  it('throws when the update returns an error', async () => {
    server.use(
      supabasePatch(
        'household_members',
        () =>
          HttpResponse.json(
            { message: 'permission denied', code: '42501' },
            { status: 403 }
          )
      )
    );

    await expect(apiClient.updateMemberRole('m-1', 'admin')).rejects.toThrow();
  });
});

describe('apiClient.removeHouseholdMember', () => {
  it('sends a DELETE filtered by member id and resolves with no value', async () => {
    let capturedUrl = '';
    server.use(
      supabaseDelete('household_members', ({ request }) => {
        capturedUrl = request.url;
        return new HttpResponse(null, { status: 204 });
      })
    );

    await expect(apiClient.removeHouseholdMember('m-1')).resolves.toBeUndefined();
    expect(capturedUrl).toContain('id=eq.m-1');
  });

  it('throws when the delete fails', async () => {
    server.use(
      supabaseDelete(
        'household_members',
        () =>
          HttpResponse.json(
            { message: 'not allowed', code: '42501' },
            { status: 403 }
          )
      )
    );

    await expect(apiClient.removeHouseholdMember('m-1')).rejects.toThrow();
  });
});

describe('apiClient.transferOwnership', () => {
  // transferOwnership(memberId, householdId) is NOT a single RPC — it does two
  // sequential PATCHes against household_members: promote target → owner,
  // then demote the caller → admin.
  it('promotes the target member then demotes the caller', async () => {
    mockCurrentUser({ id: 'u-current', email: 'owner@example.com' });

    const patchedUrls: string[] = [];
    const patchedBodies: any[] = [];
    server.use(
      supabasePatch('household_members', async ({ request }) => {
        patchedUrls.push(request.url);
        patchedBodies.push(await request.json());
        return new HttpResponse(null, { status: 204 });
      })
    );

    await expect(
      apiClient.transferOwnership('m-target', 'h-1')
    ).resolves.toBeUndefined();

    expect(patchedBodies).toEqual([{ role: 'owner' }, { role: 'admin' }]);
    expect(patchedUrls[0]).toContain('id=eq.m-target');
    expect(patchedUrls[1]).toContain('household_id=eq.h-1');
    expect(patchedUrls[1]).toContain('user_id=eq.u-current');
  });

  it('throws if the promotion step fails (permission denied)', async () => {
    mockCurrentUser({ id: 'u-current', email: 'owner@example.com' });
    server.use(
      supabasePatch(
        'household_members',
        () =>
          HttpResponse.json(
            { message: 'permission denied', code: '42501' },
            { status: 403 }
          )
      )
    );

    await expect(
      apiClient.transferOwnership('m-target', 'h-1')
    ).rejects.toThrow();
  });
});

describe('apiClient.getHouseholdRecipes', () => {
  // Uses RPC `get_household_recipes` (NOT a `.from('recipes').select(...)`).
  // The RPC returns `{ recipes: [...], total: N }` where each recipe may
  // carry a nested `profiles` object that api.ts flattens to `recipe.author`.
  it('returns empty list shape when the RPC returns null', async () => {
    server.use(supabaseRpc('get_household_recipes', null));

    const result = await apiClient.getHouseholdRecipes();

    expect(result).toEqual({ recipes: [], total: 0 });
  });

  it('flattens nested profiles into a camelCase author field', async () => {
    server.use(
      supabaseRpc('get_household_recipes', {
        recipes: [
          {
            id: 'r-1',
            title: 'Stew',
            user_id: 'u-1',
            created_at: '2026-03-01T00:00:00Z',
            profiles: {
              display_name: 'Alice',
              username: 'alice',
              avatar_url: 'https://cdn/a.png',
            },
          },
        ],
        total: 1,
      })
    );

    const result = await apiClient.getHouseholdRecipes();

    expect(result.total).toBe(1);
    expect(result.recipes).toHaveLength(1);
    expect(result.recipes[0].author).toEqual({
      displayName: 'Alice',
      username: 'alice',
      avatarUrl: 'https://cdn/a.png',
    });
  });

  it('camelCases recipe fields returned by the RPC', async () => {
    server.use(
      supabaseRpc('get_household_recipes', {
        recipes: [
          {
            id: 'r-1',
            title: 'Stew',
            user_id: 'u-1',
            created_at: '2026-03-01T00:00:00Z',
          },
        ],
        total: 1,
      })
    );

    const result = await apiClient.getHouseholdRecipes();

    expect(result.recipes[0]).toMatchObject({
      id: 'r-1',
      title: 'Stew',
      userId: 'u-1',
      createdAt: '2026-03-01T00:00:00Z',
    });
  });

  it('throws when the RPC errors', async () => {
    server.use(
      supabaseRpc(
        'get_household_recipes',
        () =>
          HttpResponse.json(
            { message: 'no household', code: 'P0001' },
            { status: 400 }
          )
      )
    );

    await expect(apiClient.getHouseholdRecipes()).rejects.toThrow();
  });
});

describe('apiClient.getPublicRecipes', () => {
  // Uses `.from('recipes').select(...)` with an embedded profiles join, so
  // MSW intercepts GET /rest/v1/recipes. PostgREST returns an array.
  it('returns an empty payload when the table query returns []', async () => {
    server.use(supabaseSelect('recipes', []));

    const result = await apiClient.getPublicRecipes();

    expect(result).toEqual({ recipes: [], total: 0 });
  });

  it('flattens the joined profiles row into recipe.author', async () => {
    server.use(
      supabaseSelect('recipes', [
        {
          id: 'r-1',
          title: 'Public Stew',
          user_id: 'u-1',
          visibility: 'public',
          created_at: '2026-03-01T00:00:00Z',
          profiles: {
            display_name: 'Bob',
            username: 'bob',
            avatar_url: null,
          },
        },
      ])
    );

    const result = await apiClient.getPublicRecipes();

    expect(result.total).toBe(1);
    expect(result.recipes[0].author).toEqual({
      displayName: 'Bob',
      username: 'bob',
      avatarUrl: null,
    });
    expect(result.recipes[0]).toMatchObject({
      id: 'r-1',
      title: 'Public Stew',
      userId: 'u-1',
      visibility: 'public',
    });
  });

  it('throws when the recipes table query errors', async () => {
    server.use(
      supabaseSelect('recipes', () =>
        HttpResponse.json(
          { message: 'boom', code: 'PGRST000' },
          { status: 500 }
        )
      )
    );

    await expect(apiClient.getPublicRecipes()).rejects.toThrow();
  });
});

describe('apiClient.getRecipeReactions', () => {
  // Signature is `getRecipeReactions(recipeIds: string[])` — an array of ids.
  // Routes through RPC `get_recipe_reactions` with `p_recipe_ids` param.
  it('short-circuits to [] when called with an empty array (no network call)', async () => {
    // No handler registered; the default unhandled-request policy is 'error',
    // so a network call would throw. Resolving normally proves no call ran.
    await expect(apiClient.getRecipeReactions([])).resolves.toEqual([]);
  });

  it('maps the RPC rows to the documented camelCase shape', async () => {
    server.use(
      supabaseRpc('get_recipe_reactions', [
        {
          id: 'rx-1',
          recipe_id: 'r-1',
          user_id: 'u-1',
          family_member_id: null,
          reaction: 'thumbs_up',
          name: 'Alice',
        },
        {
          id: 'rx-2',
          recipe_id: 'r-1',
          user_id: 'u-2',
          family_member_id: 'fm-1',
          reaction: 'thumbs_down',
          name: null,
        },
      ])
    );

    const result = await apiClient.getRecipeReactions(['r-1']);

    expect(result).toEqual([
      {
        id: 'rx-1',
        recipeId: 'r-1',
        userId: 'u-1',
        familyMemberId: null,
        reaction: 'thumbs_up',
        name: 'Alice',
      },
      {
        id: 'rx-2',
        recipeId: 'r-1',
        userId: 'u-2',
        familyMemberId: 'fm-1',
        reaction: 'thumbs_down',
        // api.ts returns null when the RPC row has no name; UI consumers
        // (RecipeCard) render "Someone" in that case. Type widened to
        // `string | null` so consumers must handle null explicitly.
        name: null,
      },
    ]);
  });

  it('returns [] when the RPC responds with null', async () => {
    server.use(supabaseRpc('get_recipe_reactions', null));

    const result = await apiClient.getRecipeReactions(['r-1']);

    expect(result).toEqual([]);
  });

  it('throws when the RPC errors', async () => {
    server.use(
      supabaseRpc('get_recipe_reactions', () =>
        HttpResponse.json(
          { message: 'permission denied', code: '42501' },
          { status: 403 }
        )
      )
    );

    await expect(apiClient.getRecipeReactions(['r-1'])).rejects.toThrow();
  });
});

describe('apiClient.toggleRecipeReaction', () => {
  // Signature is `toggleRecipeReaction({ recipeId, reaction, familyMemberId? })`.
  // Routes to RPC `toggle_recipe_reaction`.
  it('forwards the args to the RPC and returns its result verbatim', async () => {
    let capturedBody: any = null;
    server.use(
      supabaseRpc('toggle_recipe_reaction', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          action: 'added',
          reaction: 'thumbs_up',
        });
      })
    );

    const result = await apiClient.toggleRecipeReaction({
      recipeId: 'r-1',
      reaction: 'thumbs_up',
    });

    expect(capturedBody).toEqual({
      p_recipe_id: 'r-1',
      p_reaction: 'thumbs_up',
      p_family_member_id: null,
    });
    expect(result).toEqual({ action: 'added', reaction: 'thumbs_up' });
  });

  it('passes through a familyMemberId when supplied', async () => {
    let capturedBody: any = null;
    server.use(
      supabaseRpc('toggle_recipe_reaction', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ action: 'removed' });
      })
    );

    await apiClient.toggleRecipeReaction({
      recipeId: 'r-1',
      reaction: 'thumbs_down',
      familyMemberId: 'fm-7',
    });

    expect(capturedBody).toEqual({
      p_recipe_id: 'r-1',
      p_reaction: 'thumbs_down',
      p_family_member_id: 'fm-7',
    });
  });

  it('throws when the RPC errors', async () => {
    server.use(
      supabaseRpc('toggle_recipe_reaction', () =>
        HttpResponse.json(
          { message: 'permission denied', code: '42501' },
          { status: 403 }
        )
      )
    );

    await expect(
      apiClient.toggleRecipeReaction({
        recipeId: 'r-1',
        reaction: 'thumbs_up',
      })
    ).rejects.toThrow();
  });
});

describe('apiClient.createHouseholdInvite', () => {
  // POSTs to the household-invite/send edge function with
  // { householdId, email, origin } in the body.
  it('forwards household id, email, and origin to the edge function', async () => {
    let capturedBody: any = null;
    server.use(
      supabaseEdgePost('household-invite/send', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          inviteId: 'inv-1',
          inviteCode: 'abc123',
        });
      })
    );

    const result = await apiClient.createHouseholdInvite(
      'h-1',
      'invitee@example.com'
    );

    expect(capturedBody).toMatchObject({
      householdId: 'h-1',
      email: 'invitee@example.com',
    });
    // origin comes from window.location.origin (jsdom default: http://localhost)
    expect(typeof capturedBody.origin).toBe('string');
    expect(result).toEqual({ inviteId: 'inv-1', inviteCode: 'abc123' });
  });

  it('throws when the edge function responds with an error', async () => {
    server.use(
      supabaseEdgePost(
        'household-invite/send',
        { error: 'invite already pending' },
        409
      )
    );

    await expect(
      apiClient.createHouseholdInvite('h-1', 'invitee@example.com')
    ).rejects.toThrow();
  });
});

describe('apiClient.getMyPendingInvites', () => {
  it('returns [] when the RPC returns null', async () => {
    server.use(supabaseRpc('get_my_pending_invites', null));

    const result = await apiClient.getMyPendingInvites();

    expect(result).toEqual([]);
  });

  it('camelCases each invite row from the RPC payload', async () => {
    server.use(
      supabaseRpc('get_my_pending_invites', [
        {
          invite_id: 'inv-1',
          household_id: 'h-1',
          household_name: 'Smith Family',
          inviter_display_name: 'Alice',
          created_at: '2026-04-01T00:00:00Z',
        },
      ])
    );

    const result = await apiClient.getMyPendingInvites();

    expect(result).toEqual([
      {
        inviteId: 'inv-1',
        householdId: 'h-1',
        householdName: 'Smith Family',
        inviterDisplayName: 'Alice',
        createdAt: '2026-04-01T00:00:00Z',
      },
    ]);
  });

  it('throws when the RPC errors', async () => {
    server.use(
      supabaseRpc('get_my_pending_invites', () =>
        HttpResponse.json(
          { message: 'permission denied', code: '42501' },
          { status: 403 }
        )
      )
    );

    await expect(apiClient.getMyPendingInvites()).rejects.toThrow();
  });
});

describe('apiClient.respondToInvite', () => {
  // NOTE: respondToInvite does NOT call an edge function. It PATCHes
  // household_invites with the new status, then (if accepting) INSERTs
  // into household_members. Test the actual behavior.
  it('on accept: patches invite to "accepted" then inserts the membership row', async () => {
    mockCurrentUser({ id: 'u-current', email: 'me@example.com' });

    let invitePatchBody: any = null;
    let membershipInsertBody: any = null;
    server.use(
      supabasePatch('household_invites', async ({ request }) => {
        invitePatchBody = await request.json();
        return HttpResponse.json({
          id: 'inv-1',
          status: 'accepted',
          household_id: 'h-1',
          households: { id: 'h-1', name: 'Smith Family' },
        });
      }),
      supabaseInsert('household_members', async ({ request }) => {
        membershipInsertBody = await request.json();
        return new HttpResponse(null, { status: 201 });
      })
    );

    const result = await apiClient.respondToInvite('inv-1', true);

    expect(invitePatchBody).toEqual({ status: 'accepted' });
    expect(membershipInsertBody).toEqual({
      household_id: 'h-1',
      user_id: 'u-current',
      role: 'member',
    });
    expect(result).toMatchObject({
      id: 'inv-1',
      status: 'accepted',
      householdId: 'h-1',
    });
  });

  it('on decline: patches the invite to "declined" and does NOT insert membership', async () => {
    mockCurrentUser({ id: 'u-current', email: 'me@example.com' });

    let invitePatchBody: any = null;
    let membershipInsertCalled = false;
    server.use(
      supabasePatch('household_invites', async ({ request }) => {
        invitePatchBody = await request.json();
        return HttpResponse.json({
          id: 'inv-1',
          status: 'declined',
          household_id: 'h-1',
        });
      }),
      supabaseInsert('household_members', () => {
        membershipInsertCalled = true;
        return new HttpResponse(null, { status: 201 });
      })
    );

    await apiClient.respondToInvite('inv-1', false);

    expect(invitePatchBody).toEqual({ status: 'declined' });
    expect(membershipInsertCalled).toBe(false);
  });

  it('throws when the invite update fails', async () => {
    mockCurrentUser({ id: 'u-current', email: 'me@example.com' });
    server.use(
      supabasePatch('household_invites', () =>
        HttpResponse.json(
          { message: 'permission denied', code: '42501' },
          { status: 403 }
        )
      )
    );

    await expect(apiClient.respondToInvite('inv-1', true)).rejects.toThrow();
  });
});

describe('apiClient.getMyCollections', () => {
  it('returns an empty array when the table has no rows', async () => {
    mockCurrentUser({ id: 'u-current' });
    server.use(supabaseSelect('recipe_collections', []));

    const result = await apiClient.getMyCollections();

    expect(result).toEqual([]);
  });

  it('camelCases each collection row', async () => {
    mockCurrentUser({ id: 'u-current' });
    server.use(
      supabaseSelect('recipe_collections', [
        {
          id: 'c-1',
          user_id: 'u-current',
          name: 'Weeknight Dinners',
          description: null,
          icon: null,
          sort_order: 0,
          created_at: '2026-04-01T00:00:00Z',
        },
      ])
    );

    const result = await apiClient.getMyCollections();

    expect(result).toEqual([
      {
        id: 'c-1',
        userId: 'u-current',
        name: 'Weeknight Dinners',
        description: null,
        icon: null,
        sortOrder: 0,
        createdAt: '2026-04-01T00:00:00Z',
      },
    ]);
  });

  it('throws when the query errors', async () => {
    mockCurrentUser({ id: 'u-current' });
    server.use(
      supabaseSelect('recipe_collections', () =>
        HttpResponse.json(
          { message: 'permission denied', code: '42501' },
          { status: 403 }
        )
      )
    );

    await expect(apiClient.getMyCollections()).rejects.toThrow();
  });
});

describe('apiClient.createCollection', () => {
  it('POSTs the new row with name, description, and user id', async () => {
    mockCurrentUser({ id: 'u-current' });

    let capturedBody: any = null;
    server.use(
      supabaseInsert('recipe_collections', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          id: 'c-1',
          user_id: 'u-current',
          name: 'Holidays',
          description: 'Festive recipes',
          icon: null,
        });
      })
    );

    const result = await apiClient.createCollection(
      'Holidays',
      'Festive recipes'
    );

    expect(capturedBody).toEqual({
      user_id: 'u-current',
      name: 'Holidays',
      description: 'Festive recipes',
      icon: null,
    });
    expect(result).toMatchObject({
      id: 'c-1',
      userId: 'u-current',
      name: 'Holidays',
      description: 'Festive recipes',
    });
  });

  it('throws when the insert fails', async () => {
    mockCurrentUser({ id: 'u-current' });
    server.use(
      supabaseInsert('recipe_collections', () =>
        HttpResponse.json(
          { message: 'permission denied', code: '42501' },
          { status: 403 }
        )
      )
    );

    await expect(apiClient.createCollection('Holidays')).rejects.toThrow();
  });
});

describe('apiClient.updateCollection', () => {
  // Note: the public method is `updateCollection(id, updates)`, not
  // `renameCollection`. A rename is just `{ name }` in the updates payload.
  it('sends a PATCH with only the supplied fields and id filter', async () => {
    let capturedBody: any = null;
    let capturedUrl = '';
    server.use(
      supabasePatch('recipe_collections', async ({ request }) => {
        capturedUrl = request.url;
        capturedBody = await request.json();
        return HttpResponse.json({
          id: 'c-1',
          name: 'Renamed',
          description: null,
          icon: null,
        });
      })
    );

    const result = await apiClient.updateCollection('c-1', {
      name: 'Renamed',
    });

    expect(capturedBody).toEqual({ name: 'Renamed' });
    expect(capturedUrl).toContain('id=eq.c-1');
    expect(result).toMatchObject({ id: 'c-1', name: 'Renamed' });
  });

  it('throws when the update fails', async () => {
    server.use(
      supabasePatch('recipe_collections', () =>
        HttpResponse.json(
          { message: 'permission denied', code: '42501' },
          { status: 403 }
        )
      )
    );

    await expect(
      apiClient.updateCollection('c-1', { name: 'Renamed' })
    ).rejects.toThrow();
  });
});

describe('apiClient.deleteCollection', () => {
  it('sends a DELETE filtered by collection id', async () => {
    let capturedUrl = '';
    server.use(
      supabaseDelete('recipe_collections', ({ request }) => {
        capturedUrl = request.url;
        return new HttpResponse(null, { status: 204 });
      })
    );

    await expect(apiClient.deleteCollection('c-1')).resolves.toBeUndefined();
    expect(capturedUrl).toContain('id=eq.c-1');
  });

  it('throws when the delete fails', async () => {
    server.use(
      supabaseDelete('recipe_collections', () =>
        HttpResponse.json(
          { message: 'permission denied', code: '42501' },
          { status: 403 }
        )
      )
    );

    await expect(apiClient.deleteCollection('c-1')).rejects.toThrow();
  });
});

describe('apiClient.addRecipeToCollection', () => {
  it('POSTs a join row containing collection_id and recipe_id', async () => {
    let capturedBody: any = null;
    server.use(
      supabaseInsert('collection_recipes', async ({ request }) => {
        capturedBody = await request.json();
        return new HttpResponse(null, { status: 201 });
      })
    );

    await expect(
      apiClient.addRecipeToCollection('c-1', 'r-1')
    ).resolves.toBeUndefined();

    expect(capturedBody).toEqual({
      collection_id: 'c-1',
      recipe_id: 'r-1',
    });
  });

  it('throws when the insert fails', async () => {
    server.use(
      supabaseInsert('collection_recipes', () =>
        HttpResponse.json(
          { message: 'duplicate', code: '23505' },
          { status: 409 }
        )
      )
    );

    await expect(
      apiClient.addRecipeToCollection('c-1', 'r-1')
    ).rejects.toThrow();
  });
});

describe('apiClient.removeRecipeFromCollection', () => {
  it('sends a DELETE filtered by both collection_id and recipe_id', async () => {
    let capturedUrl = '';
    server.use(
      supabaseDelete('collection_recipes', ({ request }) => {
        capturedUrl = request.url;
        return new HttpResponse(null, { status: 204 });
      })
    );

    await expect(
      apiClient.removeRecipeFromCollection('c-1', 'r-1')
    ).resolves.toBeUndefined();

    expect(capturedUrl).toContain('collection_id=eq.c-1');
    expect(capturedUrl).toContain('recipe_id=eq.r-1');
  });

  it('throws when the delete fails', async () => {
    server.use(
      supabaseDelete('collection_recipes', () =>
        HttpResponse.json(
          { message: 'permission denied', code: '42501' },
          { status: 403 }
        )
      )
    );

    await expect(
      apiClient.removeRecipeFromCollection('c-1', 'r-1')
    ).rejects.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────
// Recipe CRUD
// ─────────────────────────────────────────────────────────────────────

describe('apiClient.getRecipes', () => {
  // GET /rest/v1/recipes filtered by user_id, ordered by created_at desc,
  // ranged by limit/offset. Returns { recipes, total } shape.
  it('returns the recipes wrapped in { recipes, total } and camelCases rows', async () => {
    mockCurrentUser({ id: 'u-current' });
    server.use(
      supabaseSelect('recipes', [
        {
          id: 'r-1',
          title: 'Pasta',
          user_id: 'u-current',
          prep_time: 10,
          cook_time: 20,
          created_at: '2026-05-01T00:00:00Z',
        },
      ])
    );

    const result = await apiClient.getRecipes();

    expect(result.total).toBe(1);
    expect(result.recipes).toHaveLength(1);
    expect(result.recipes[0]).toMatchObject({
      id: 'r-1',
      title: 'Pasta',
      userId: 'u-current',
      prepTime: 10,
      cookTime: 20,
      createdAt: '2026-05-01T00:00:00Z',
    });
  });

  it('returns an empty payload when the table query returns []', async () => {
    mockCurrentUser({ id: 'u-current' });
    server.use(supabaseSelect('recipes', []));

    const result = await apiClient.getRecipes();

    expect(result).toEqual({ recipes: [], total: 0 });
  });

  it('throws when the query errors', async () => {
    mockCurrentUser({ id: 'u-current' });
    server.use(
      supabaseSelect('recipes', () =>
        HttpResponse.json(
          { message: 'permission denied', code: '42501' },
          { status: 403 }
        )
      )
    );

    await expect(apiClient.getRecipes()).rejects.toThrow();
  });
});

describe('apiClient.getRecipe', () => {
  // Disambiguates UUID vs slug by regex, then filters on `id` or `slug` and
  // calls `.single()`. PGRST116 → returns null (NOT a throw).
  it('queries by id when given a UUID and returns the camelCased row', async () => {
    mockCurrentUser({ id: 'u-current' });
    const uuid = '11111111-2222-3333-4444-555555555555';
    let capturedUrl = '';
    server.use(
      supabaseSelect('recipes', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          id: uuid,
          title: 'Stew',
          user_id: 'u-current',
          source_url: 'https://example.com/stew',
        });
      })
    );

    const result = await apiClient.getRecipe(uuid);

    expect(capturedUrl).toContain(`id=eq.${uuid}`);
    expect(result).toMatchObject({
      id: uuid,
      title: 'Stew',
      userId: 'u-current',
      sourceUrl: 'https://example.com/stew',
    });
  });

  it('queries by slug when the input is not a UUID', async () => {
    mockCurrentUser({ id: 'u-current' });
    let capturedUrl = '';
    server.use(
      supabaseSelect('recipes', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          id: 'r-1',
          slug: 'grandmas-stew',
          title: 'Stew',
          user_id: 'u-current',
        });
      })
    );

    const result = await apiClient.getRecipe('grandmas-stew');

    expect(capturedUrl).toContain('slug=eq.grandmas-stew');
    expect(result).toMatchObject({ id: 'r-1', title: 'Stew' });
  });

  it('returns null on PGRST116 (row not found) instead of throwing', async () => {
    mockCurrentUser({ id: 'u-current' });
    server.use(
      supabaseSelect('recipes', () =>
        HttpResponse.json(
          { message: 'no rows', code: 'PGRST116' },
          { status: 406 }
        )
      )
    );

    const result = await apiClient.getRecipe('does-not-exist');

    expect(result).toBeNull();
  });

  it('throws when the query errors with a non-PGRST116 code', async () => {
    mockCurrentUser({ id: 'u-current' });
    server.use(
      supabaseSelect('recipes', () =>
        HttpResponse.json(
          { message: 'permission denied', code: '42501' },
          { status: 403 }
        )
      )
    );

    await expect(apiClient.getRecipe('r-1')).rejects.toThrow();
  });
});

describe('apiClient.createRecipe', () => {
  // Flow: checkDuplicateRecipe (GET .maybeSingle on recipes) → INSERT recipes.
  // camelCase fields like prepTime get converted to snake_case for the body.
  // user_id is set from the authed user, NOT from the input payload.
  it('round-trips camelCase input to snake_case body and back', async () => {
    mockCurrentUser({ id: 'u-current' });

    let insertBody: any = null;
    server.use(
      // duplicate-check returns null (no existing row)
      supabaseSelect('recipes', null),
      supabaseInsert('recipes', async ({ request }) => {
        insertBody = await request.json();
        return HttpResponse.json({
          id: 'r-new',
          user_id: 'u-current',
          title: 'New Pasta',
          prep_time: 15,
          cook_time: 25,
          source_url: 'https://example.com/p',
          created_at: '2026-05-10T00:00:00Z',
        });
      })
    );

    const result = await apiClient.createRecipe({
      title: 'New Pasta',
      prepTime: 15,
      cookTime: 25,
      sourceUrl: 'https://example.com/p',
    });

    expect(insertBody).toMatchObject({
      title: 'New Pasta',
      prep_time: 15,
      cook_time: 25,
      source_url: 'https://example.com/p',
      user_id: 'u-current',
    });
    expect(result).toMatchObject({
      id: 'r-new',
      userId: 'u-current',
      title: 'New Pasta',
      prepTime: 15,
      cookTime: 25,
      sourceUrl: 'https://example.com/p',
    });
  });

  it('throws a friendly message when checkDuplicateRecipe finds an existing recipe', async () => {
    mockCurrentUser({ id: 'u-current' });
    server.use(
      // duplicate-check returns an existing row
      supabaseSelect('recipes', { id: 'r-existing' })
    );

    await expect(
      apiClient.createRecipe({ title: 'Pasta' })
    ).rejects.toThrow(/already exists/);
  });

  it('skips the duplicate check when options.skipDuplicateCheck is true', async () => {
    mockCurrentUser({ id: 'u-current' });

    let insertCalled = false;
    server.use(
      supabaseInsert('recipes', async () => {
        insertCalled = true;
        return HttpResponse.json({
          id: 'r-new',
          user_id: 'u-current',
          title: 'Pasta',
        });
      })
    );

    const result = await apiClient.createRecipe(
      { title: 'Pasta' },
      { skipDuplicateCheck: true }
    );

    expect(insertCalled).toBe(true);
    expect(result).toMatchObject({ id: 'r-new' });
  });

  it('translates a 23505 unique-constraint error into a friendly message', async () => {
    mockCurrentUser({ id: 'u-current' });
    server.use(
      supabaseSelect('recipes', null),
      supabaseInsert('recipes', () =>
        HttpResponse.json(
          { message: 'duplicate key', code: '23505' },
          { status: 409 }
        )
      )
    );

    await expect(
      apiClient.createRecipe({ title: 'Pasta' })
    ).rejects.toThrow(/already exists/);
  });
});

describe('apiClient.updateRecipe', () => {
  // Flow: if data.title — checkDuplicateRecipe → PATCH recipes filtered by
  // (id, user_id), `.select().single()` returns the updated row.
  it('PATCHes the recipe filtered by id + user_id and camelCases the response', async () => {
    mockCurrentUser({ id: 'u-current' });

    let patchBody: any = null;
    let patchUrl = '';
    server.use(
      supabaseSelect('recipes', null), // dup check finds nothing
      supabasePatch('recipes', async ({ request }) => {
        patchUrl = request.url;
        patchBody = await request.json();
        return HttpResponse.json({
          id: 'r-1',
          user_id: 'u-current',
          title: 'Updated Pasta',
          prep_time: 5,
          updated_at: '2026-05-10T00:00:00Z',
        });
      })
    );

    const result = await apiClient.updateRecipe('r-1', {
      title: 'Updated Pasta',
      prepTime: 5,
    });

    expect(patchUrl).toContain('id=eq.r-1');
    expect(patchUrl).toContain('user_id=eq.u-current');
    expect(patchBody).toEqual({
      title: 'Updated Pasta',
      prep_time: 5,
    });
    expect(result).toMatchObject({
      id: 'r-1',
      userId: 'u-current',
      title: 'Updated Pasta',
      prepTime: 5,
      updatedAt: '2026-05-10T00:00:00Z',
    });
  });

  it('skips the duplicate check when no title is provided in updates', async () => {
    mockCurrentUser({ id: 'u-current' });

    let patchCalled = false;
    server.use(
      supabasePatch('recipes', async () => {
        patchCalled = true;
        return HttpResponse.json({
          id: 'r-1',
          user_id: 'u-current',
          prep_time: 30,
        });
      })
    );

    await apiClient.updateRecipe('r-1', { prepTime: 30 });

    expect(patchCalled).toBe(true);
  });

  it('throws a friendly message when the title duplicates an existing recipe', async () => {
    mockCurrentUser({ id: 'u-current' });
    server.use(
      // dup check finds a row → caller throws before issuing the PATCH
      supabaseSelect('recipes', { id: 'r-other' })
    );

    await expect(
      apiClient.updateRecipe('r-1', { title: 'Pasta' })
    ).rejects.toThrow(/already exists/);
  });

  it('throws when the update errors with a non-unique error code', async () => {
    mockCurrentUser({ id: 'u-current' });
    server.use(
      supabasePatch('recipes', () =>
        HttpResponse.json(
          { message: 'permission denied', code: '42501' },
          { status: 403 }
        )
      )
    );

    await expect(
      apiClient.updateRecipe('r-1', { prepTime: 5 })
    ).rejects.toThrow();
  });
});

describe('apiClient.deleteRecipe', () => {
  // DELETE filtered by (id, user_id). Returns { success: true } on no error.
  it('sends a DELETE filtered by both id and user_id and resolves to { success: true }', async () => {
    mockCurrentUser({ id: 'u-current' });

    let capturedUrl = '';
    server.use(
      supabaseDelete('recipes', ({ request }) => {
        capturedUrl = request.url;
        return new HttpResponse(null, { status: 204 });
      })
    );

    const result = await apiClient.deleteRecipe('r-1');

    expect(capturedUrl).toContain('id=eq.r-1');
    expect(capturedUrl).toContain('user_id=eq.u-current');
    expect(result).toEqual({ success: true });
  });

  it('throws when the delete fails', async () => {
    mockCurrentUser({ id: 'u-current' });
    server.use(
      supabaseDelete('recipes', () =>
        HttpResponse.json(
          { message: 'permission denied', code: '42501' },
          { status: 403 }
        )
      )
    );

    await expect(apiClient.deleteRecipe('r-1')).rejects.toThrow();
  });
});

describe('apiClient.updateRecipeVisibility', () => {
  // PATCH recipes with { visibility } filtered by id only. No .select() is
  // chained, so MSW just returns 204. The method returns { id, visibility }.
  it('PATCHes the new visibility value and returns the local echo', async () => {
    let capturedBody: any = null;
    let capturedUrl = '';
    server.use(
      supabasePatch('recipes', async ({ request }) => {
        capturedUrl = request.url;
        capturedBody = await request.json();
        return new HttpResponse(null, { status: 204 });
      })
    );

    const result = await apiClient.updateRecipeVisibility('r-1', 'household');

    expect(capturedUrl).toContain('id=eq.r-1');
    expect(capturedBody).toEqual({ visibility: 'household' });
    expect(result).toEqual({ id: 'r-1', visibility: 'household' });
  });

  it('throws when the visibility update fails', async () => {
    server.use(
      supabasePatch('recipes', () =>
        HttpResponse.json(
          { message: 'permission denied', code: '42501' },
          { status: 403 }
        )
      )
    );

    await expect(
      apiClient.updateRecipeVisibility('r-1', 'public')
    ).rejects.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────
// Meal Plans
// ─────────────────────────────────────────────────────────────────────

describe('apiClient.getMealPlans', () => {
  // GET /rest/v1/meal_plans filtered by user_id, ordered by start_date desc.
  // Optional status filter + limit. JSONB columns `meals` and `grocery_list`
  // come through as nested objects, NOT separate joined rows.
  it('returns camelCased rows including JSONB meals/grocery_list as-is', async () => {
    mockCurrentUser({ id: 'u-current' });
    server.use(
      supabaseSelect('meal_plans', [
        {
          id: 'mp-1',
          user_id: 'u-current',
          title: 'Week 1',
          start_date: '2026-06-01',
          end_date: '2026-06-07',
          meals: {
            '2026-06-01': { breakfast: 'r-1' },
            '2026-06-02': { dinner: 'r-2' },
          },
          grocery_list: { items: [{ name: 'eggs', qty: 12 }] },
          status: 'draft',
          created_at: '2026-05-25T00:00:00Z',
        },
      ])
    );

    const result = await apiClient.getMealPlans();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'mp-1',
      userId: 'u-current',
      title: 'Week 1',
      startDate: '2026-06-01',
      endDate: '2026-06-07',
      status: 'draft',
      // JSONB column → object remains intact (keys with dashes/dates
      // aren't transformed since snakeToCamel only operates on
      // identifier-like keys via _([a-z]) pattern). Verify the inner
      // structure round-trips.
      meals: {
        '2026-06-01': { breakfast: 'r-1' },
        '2026-06-02': { dinner: 'r-2' },
      },
      // grocery_list → groceryList
      groceryList: { items: [{ name: 'eggs', qty: 12 }] },
    });
  });

  it('appends a status filter to the query when status is supplied', async () => {
    mockCurrentUser({ id: 'u-current' });
    let capturedUrl = '';
    server.use(
      supabaseSelect('meal_plans', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json([]);
      })
    );

    await apiClient.getMealPlans({ status: 'active' });

    expect(capturedUrl).toContain('status=eq.active');
  });

  it('returns [] when the table has no rows', async () => {
    mockCurrentUser({ id: 'u-current' });
    server.use(supabaseSelect('meal_plans', []));

    const result = await apiClient.getMealPlans();

    expect(result).toEqual([]);
  });

  it('throws when the query errors', async () => {
    mockCurrentUser({ id: 'u-current' });
    server.use(
      supabaseSelect('meal_plans', () =>
        HttpResponse.json(
          { message: 'permission denied', code: '42501' },
          { status: 403 }
        )
      )
    );

    await expect(apiClient.getMealPlans()).rejects.toThrow();
  });
});

describe('apiClient.getMealPlan', () => {
  // Note: this method does NOT call supabase.auth.getUser(). It hits
  // /rest/v1/meal_plans?id=eq.{id} with .single() and returns a camelCased
  // single row.
  it('returns the camelCased single row by id', async () => {
    let capturedUrl = '';
    server.use(
      supabaseSelect('meal_plans', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          id: 'mp-1',
          user_id: 'u-1',
          title: 'Week 1',
          start_date: '2026-06-01',
          end_date: '2026-06-07',
          meals: { '2026-06-01': { breakfast: 'r-1' } },
          grocery_list: null,
        });
      })
    );

    const result = await apiClient.getMealPlan('mp-1');

    expect(capturedUrl).toContain('id=eq.mp-1');
    expect(result).toMatchObject({
      id: 'mp-1',
      userId: 'u-1',
      title: 'Week 1',
      startDate: '2026-06-01',
      endDate: '2026-06-07',
      meals: { '2026-06-01': { breakfast: 'r-1' } },
      groceryList: null,
    });
  });

  it('throws when the query errors', async () => {
    server.use(
      supabaseSelect('meal_plans', () =>
        HttpResponse.json(
          { message: 'not found', code: 'PGRST116' },
          { status: 406 }
        )
      )
    );

    await expect(apiClient.getMealPlan('mp-missing')).rejects.toThrow();
  });
});

describe('apiClient.createMealPlan', () => {
  // POST /rest/v1/meal_plans. The implementation hard-codes user_id /
  // created_by / last_edited_by from the authed user, and supplies sensible
  // defaults: meals={}, status='draft'.
  it('POSTs the new plan with auth-derived user fields and JSONB defaults', async () => {
    mockCurrentUser({ id: 'u-current' });

    let insertBody: any = null;
    server.use(
      supabaseInsert('meal_plans', async ({ request }) => {
        insertBody = await request.json();
        return HttpResponse.json({
          id: 'mp-new',
          user_id: 'u-current',
          created_by: 'u-current',
          last_edited_by: 'u-current',
          title: 'Week 2',
          start_date: '2026-06-08',
          end_date: '2026-06-14',
          meals: {},
          status: 'draft',
        });
      })
    );

    const result = await apiClient.createMealPlan({
      title: 'Week 2',
      startDate: '2026-06-08',
      endDate: '2026-06-14',
    });

    expect(insertBody).toMatchObject({
      user_id: 'u-current',
      created_by: 'u-current',
      last_edited_by: 'u-current',
      title: 'Week 2',
      start_date: '2026-06-08',
      end_date: '2026-06-14',
      meals: {},
      notes: null,
      status: 'draft',
    });
    expect(result).toMatchObject({
      id: 'mp-new',
      userId: 'u-current',
      startDate: '2026-06-08',
      endDate: '2026-06-14',
    });
  });

  it('passes the supplied meals JSONB through unchanged', async () => {
    mockCurrentUser({ id: 'u-current' });

    let insertBody: any = null;
    const meals = {
      '2026-06-08': { breakfast: 'r-1', dinner: 'r-2' },
      '2026-06-09': { lunch: 'r-3' },
    };
    server.use(
      supabaseInsert('meal_plans', async ({ request }) => {
        insertBody = await request.json();
        return HttpResponse.json({
          id: 'mp-new',
          user_id: 'u-current',
          meals,
        });
      })
    );

    await apiClient.createMealPlan({
      startDate: '2026-06-08',
      endDate: '2026-06-14',
      meals,
    });

    expect(insertBody.meals).toEqual(meals);
  });

  it('throws when the insert errors', async () => {
    mockCurrentUser({ id: 'u-current' });
    server.use(
      supabaseInsert('meal_plans', () =>
        HttpResponse.json(
          { message: 'permission denied', code: '42501' },
          { status: 403 }
        )
      )
    );

    await expect(
      apiClient.createMealPlan({
        startDate: '2026-06-08',
        endDate: '2026-06-14',
      })
    ).rejects.toThrow();
  });
});

describe('apiClient.updateMealPlan', () => {
  // PATCH filtered by id. Only fields explicitly provided are forwarded.
  // last_edited_by is always set from the authed user. groceryList →
  // grocery_list, startDate → start_date, etc.
  it('only forwards the fields that were supplied + last_edited_by', async () => {
    mockCurrentUser({ id: 'u-current' });

    let patchBody: any = null;
    let patchUrl = '';
    server.use(
      supabasePatch('meal_plans', async ({ request }) => {
        patchUrl = request.url;
        patchBody = await request.json();
        return HttpResponse.json({
          id: 'mp-1',
          status: 'active',
          last_edited_by: 'u-current',
        });
      })
    );

    await apiClient.updateMealPlan('mp-1', { status: 'active' });

    expect(patchUrl).toContain('id=eq.mp-1');
    expect(patchBody).toEqual({
      last_edited_by: 'u-current',
      status: 'active',
    });
  });

  it('maps groceryList → grocery_list in the PATCH body', async () => {
    mockCurrentUser({ id: 'u-current' });

    let patchBody: any = null;
    const groceryList = { items: [{ name: 'milk', qty: 1 }] };
    server.use(
      supabasePatch('meal_plans', async ({ request }) => {
        patchBody = await request.json();
        return HttpResponse.json({
          id: 'mp-1',
          grocery_list: groceryList,
        });
      })
    );

    const result = await apiClient.updateMealPlan('mp-1', { groceryList });

    expect(patchBody).toMatchObject({
      grocery_list: groceryList,
      last_edited_by: 'u-current',
    });
    expect(result).toMatchObject({
      id: 'mp-1',
      groceryList,
    });
  });

  it('throws when the update errors', async () => {
    mockCurrentUser({ id: 'u-current' });
    server.use(
      supabasePatch('meal_plans', () =>
        HttpResponse.json(
          { message: 'permission denied', code: '42501' },
          { status: 403 }
        )
      )
    );

    await expect(
      apiClient.updateMealPlan('mp-1', { status: 'active' })
    ).rejects.toThrow();
  });
});

describe('apiClient.deleteMealPlan', () => {
  it('sends a DELETE filtered by id and resolves with no value', async () => {
    let capturedUrl = '';
    server.use(
      supabaseDelete('meal_plans', ({ request }) => {
        capturedUrl = request.url;
        return new HttpResponse(null, { status: 204 });
      })
    );

    await expect(apiClient.deleteMealPlan('mp-1')).resolves.toBeUndefined();
    expect(capturedUrl).toContain('id=eq.mp-1');
  });

  it('throws when the delete fails', async () => {
    server.use(
      supabaseDelete('meal_plans', () =>
        HttpResponse.json(
          { message: 'permission denied', code: '42501' },
          { status: 403 }
        )
      )
    );

    await expect(apiClient.deleteMealPlan('mp-1')).rejects.toThrow();
  });
});

describe('apiClient.copyMealPlan', () => {
  // Flow: GET source plan → compute shifted meals → POST new plan.
  // The source's meals JSONB is shifted by the day offset between
  // newStart and sourceStart and deep-copied (not referenced) into the
  // new row. Title becomes "<source title> (copy)" and status='draft'.
  it('deep-copies and date-shifts the source meals JSONB into the new plan', async () => {
    mockCurrentUser({ id: 'u-current' });

    const sourceMeals = {
      '2026-06-01': { breakfast: 'r-1', dinner: 'r-2' },
      '2026-06-02': { breakfast: 'r-3' },
    };
    let insertBody: any = null;

    server.use(
      // First call: GET source plan
      supabaseSelect('meal_plans', {
        id: 'mp-source',
        user_id: 'u-current',
        title: 'Original Week',
        start_date: '2026-06-01',
        end_date: '2026-06-07',
        meals: sourceMeals,
        notes: 'eat well',
      }),
      // Second call: INSERT the copy
      supabaseInsert('meal_plans', async ({ request }) => {
        insertBody = await request.json();
        return HttpResponse.json({
          id: 'mp-copy',
          ...insertBody,
        });
      })
    );

    const result = await apiClient.copyMealPlan('mp-source', {
      startDate: '2026-06-08',
      endDate: '2026-06-14',
    });

    expect(insertBody).toMatchObject({
      user_id: 'u-current',
      created_by: 'u-current',
      last_edited_by: 'u-current',
      copied_from: 'mp-source',
      title: 'Original Week (copy)',
      start_date: '2026-06-08',
      end_date: '2026-06-14',
      notes: 'eat well',
      status: 'draft',
    });

    // Meals are date-shifted by +7 days, with identical inner content.
    expect(insertBody.meals).toEqual({
      '2026-06-08': { breakfast: 'r-1', dinner: 'r-2' },
      '2026-06-09': { breakfast: 'r-3' },
    });

    // The shifted object is NOT the same reference as the source. Mutating
    // the response object should not retroactively change the source.
    expect(insertBody.meals).not.toBe(sourceMeals);
    expect(result).toMatchObject({ id: 'mp-copy', copiedFrom: 'mp-source' });
  });

  it('uses null title when the source has no title', async () => {
    mockCurrentUser({ id: 'u-current' });
    let insertBody: any = null;
    server.use(
      supabaseSelect('meal_plans', {
        id: 'mp-source',
        user_id: 'u-current',
        title: null,
        start_date: '2026-06-01',
        end_date: '2026-06-07',
        meals: {},
        notes: null,
      }),
      supabaseInsert('meal_plans', async ({ request }) => {
        insertBody = await request.json();
        return HttpResponse.json({ id: 'mp-copy', ...insertBody });
      })
    );

    await apiClient.copyMealPlan('mp-source', {
      startDate: '2026-06-08',
      endDate: '2026-06-14',
    });

    expect(insertBody.title).toBeNull();
  });

  it('throws when the source plan fetch fails', async () => {
    mockCurrentUser({ id: 'u-current' });
    server.use(
      supabaseSelect('meal_plans', () =>
        HttpResponse.json(
          { message: 'not found', code: 'PGRST116' },
          { status: 406 }
        )
      )
    );

    await expect(
      apiClient.copyMealPlan('mp-missing', {
        startDate: '2026-06-08',
        endDate: '2026-06-14',
      })
    ).rejects.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────
// Family Members
// ─────────────────────────────────────────────────────────────────────

describe('apiClient.createFamilyMember', () => {
  // POST /rest/v1/family_members. household_id and managed_by are set
  // explicitly. allergies/dietary_restrictions are array columns that
  // round-trip through snake_case ↔ camelCase boundary cleanly.
  it('POSTs the snake_cased row with allergies + dietary_restrictions arrays', async () => {
    mockCurrentUser({ id: 'u-current' });

    let insertBody: any = null;
    server.use(
      supabaseInsert('family_members', async ({ request }) => {
        insertBody = await request.json();
        return HttpResponse.json({
          id: 'fm-1',
          household_id: 'h-1',
          managed_by: 'u-current',
          name: 'Charlie',
          relationship: 'child',
          age: 8,
          dietary_restrictions: ['vegetarian'],
          allergies: ['peanuts', 'shellfish'],
          preferences: { likes: ['pasta'] },
        });
      })
    );

    const result = await apiClient.createFamilyMember({
      householdId: 'h-1',
      name: 'Charlie',
      relationship: 'child',
      age: 8,
      dietaryRestrictions: ['vegetarian'],
      allergies: ['peanuts', 'shellfish'],
      preferences: { likes: ['pasta'] },
    });

    expect(insertBody).toEqual({
      household_id: 'h-1',
      managed_by: 'u-current',
      name: 'Charlie',
      relationship: 'child',
      age: 8,
      dietary_restrictions: ['vegetarian'],
      allergies: ['peanuts', 'shellfish'],
      preferences: { likes: ['pasta'] },
    });
    expect(result).toMatchObject({
      id: 'fm-1',
      householdId: 'h-1',
      managedBy: 'u-current',
      name: 'Charlie',
      relationship: 'child',
      age: 8,
      dietaryRestrictions: ['vegetarian'],
      allergies: ['peanuts', 'shellfish'],
      preferences: { likes: ['pasta'] },
    });
  });

  it('defaults allergies and dietary_restrictions to empty arrays when omitted', async () => {
    mockCurrentUser({ id: 'u-current' });

    let insertBody: any = null;
    server.use(
      supabaseInsert('family_members', async ({ request }) => {
        insertBody = await request.json();
        return HttpResponse.json({
          id: 'fm-2',
          household_id: 'h-1',
          managed_by: 'u-current',
          name: 'Dana',
          relationship: 'spouse',
          age: null,
          dietary_restrictions: [],
          allergies: [],
          preferences: {},
        });
      })
    );

    await apiClient.createFamilyMember({
      householdId: 'h-1',
      name: 'Dana',
      relationship: 'spouse',
    });

    expect(insertBody).toMatchObject({
      dietary_restrictions: [],
      allergies: [],
      preferences: {},
      age: null,
    });
  });

  it('throws when the insert errors', async () => {
    mockCurrentUser({ id: 'u-current' });
    server.use(
      supabaseInsert('family_members', () =>
        HttpResponse.json(
          { message: 'permission denied', code: '42501' },
          { status: 403 }
        )
      )
    );

    await expect(
      apiClient.createFamilyMember({
        householdId: 'h-1',
        name: 'Test',
        relationship: 'child',
      })
    ).rejects.toThrow();
  });
});

describe('apiClient.updateFamilyMember', () => {
  // PATCH /rest/v1/family_members. Only the explicitly-supplied fields
  // are forwarded; allergies/dietaryRestrictions go through the
  // snake_case boundary.
  it('PATCHes only the supplied fields with snake_case keys', async () => {
    let patchBody: any = null;
    let patchUrl = '';
    server.use(
      supabasePatch('family_members', async ({ request }) => {
        patchUrl = request.url;
        patchBody = await request.json();
        return HttpResponse.json({
          id: 'fm-1',
          allergies: ['eggs', 'dairy'],
          dietary_restrictions: ['vegan'],
        });
      })
    );

    const result = await apiClient.updateFamilyMember('fm-1', {
      allergies: ['eggs', 'dairy'],
      dietaryRestrictions: ['vegan'],
    });

    expect(patchUrl).toContain('id=eq.fm-1');
    expect(patchBody).toEqual({
      allergies: ['eggs', 'dairy'],
      dietary_restrictions: ['vegan'],
    });
    expect(result).toMatchObject({
      id: 'fm-1',
      allergies: ['eggs', 'dairy'],
      dietaryRestrictions: ['vegan'],
    });
  });

  it('does not include unspecified fields in the PATCH body', async () => {
    let patchBody: any = null;
    server.use(
      supabasePatch('family_members', async ({ request }) => {
        patchBody = await request.json();
        return HttpResponse.json({ id: 'fm-1', name: 'New Name' });
      })
    );

    await apiClient.updateFamilyMember('fm-1', { name: 'New Name' });

    expect(patchBody).toEqual({ name: 'New Name' });
    expect(patchBody.allergies).toBeUndefined();
    expect(patchBody.dietary_restrictions).toBeUndefined();
  });

  it('allows explicit null for age to clear the value', async () => {
    let patchBody: any = null;
    server.use(
      supabasePatch('family_members', async ({ request }) => {
        patchBody = await request.json();
        return HttpResponse.json({ id: 'fm-1', age: null });
      })
    );

    await apiClient.updateFamilyMember('fm-1', { age: null });

    expect(patchBody).toEqual({ age: null });
  });

  it('throws when the update errors', async () => {
    server.use(
      supabasePatch('family_members', () =>
        HttpResponse.json(
          { message: 'permission denied', code: '42501' },
          { status: 403 }
        )
      )
    );

    await expect(
      apiClient.updateFamilyMember('fm-1', { name: 'X' })
    ).rejects.toThrow();
  });
});

describe('apiClient.deleteFamilyMember', () => {
  // NOTE: This is a SOFT delete — implementation PATCHes `is_active: false`,
  // it does NOT issue a DELETE request. Tests must reflect actual behavior.
  it('PATCHes is_active to false rather than issuing a DELETE', async () => {
    let patchBody: any = null;
    let patchUrl = '';
    server.use(
      supabasePatch('family_members', async ({ request }) => {
        patchUrl = request.url;
        patchBody = await request.json();
        return new HttpResponse(null, { status: 204 });
      })
    );

    await expect(
      apiClient.deleteFamilyMember('fm-1')
    ).resolves.toBeUndefined();

    expect(patchUrl).toContain('id=eq.fm-1');
    expect(patchBody).toEqual({ is_active: false });
  });

  it('throws when the soft-delete PATCH fails', async () => {
    server.use(
      supabasePatch('family_members', () =>
        HttpResponse.json(
          { message: 'permission denied', code: '42501' },
          { status: 403 }
        )
      )
    );

    await expect(apiClient.deleteFamilyMember('fm-1')).rejects.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────
// Recipe duplicate-detection helpers
// ─────────────────────────────────────────────────────────────────────

describe('apiClient.checkDuplicateRecipe', () => {
  // Boolean wrapper used internally by create/updateRecipe.
  // GET /rest/v1/recipes filtered by user_id + ilike(title), .maybeSingle().
  it('returns true when a row matches the (lowercased + trimmed) title', async () => {
    mockCurrentUser({ id: 'u-current' });
    let capturedUrl = '';
    server.use(
      supabaseSelect('recipes', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ id: 'r-existing' });
      })
    );

    const result = await apiClient.checkDuplicateRecipe('  Stew  ');

    expect(result).toBe(true);
    // Title is lowercased + trimmed before being sent in the ilike filter.
    expect(capturedUrl).toContain('title=ilike.stew');
    expect(capturedUrl).toContain('user_id=eq.u-current');
  });

  it('returns false when maybeSingle responds with null', async () => {
    mockCurrentUser({ id: 'u-current' });
    server.use(supabaseSelect('recipes', null));

    const result = await apiClient.checkDuplicateRecipe('Brand New');

    expect(result).toBe(false);
  });

  it('adds an id!=excludeId filter when excludeId is supplied', async () => {
    mockCurrentUser({ id: 'u-current' });
    let capturedUrl = '';
    server.use(
      supabaseSelect('recipes', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json(null);
      })
    );

    await apiClient.checkDuplicateRecipe('Pasta', 'r-1');

    expect(capturedUrl).toContain('id=neq.r-1');
  });

  it('swallows PGRST116 ("no rows") and treats it as no duplicate', async () => {
    mockCurrentUser({ id: 'u-current' });
    server.use(
      supabaseSelect('recipes', () =>
        HttpResponse.json(
          { message: 'no rows', code: 'PGRST116' },
          { status: 406 }
        )
      )
    );

    const result = await apiClient.checkDuplicateRecipe('Anything');

    expect(result).toBe(false);
  });

  it('throws when the query errors with a non-PGRST116 code', async () => {
    mockCurrentUser({ id: 'u-current' });
    server.use(
      supabaseSelect('recipes', () =>
        HttpResponse.json(
          { message: 'permission denied', code: '42501' },
          { status: 403 }
        )
      )
    );

    await expect(apiClient.checkDuplicateRecipe('X')).rejects.toThrow();
  });
});

describe('apiClient.checkDuplicateTitle', () => {
  // Richer-shape sibling of checkDuplicateRecipe — returns the existing row's
  // id + title (not just a boolean) so callers can offer "open existing" UX.
  it('returns the existing id and title when a duplicate exists', async () => {
    mockCurrentUser({ id: 'u-current' });
    server.use(
      supabaseSelect('recipes', {
        id: 'r-existing',
        title: 'Original Pasta',
      })
    );

    const result = await apiClient.checkDuplicateTitle('original pasta');

    expect(result).toEqual({
      isDuplicate: true,
      existingId: 'r-existing',
      existingTitle: 'Original Pasta',
    });
  });

  it('returns isDuplicate=false with undefined id/title when nothing matches', async () => {
    mockCurrentUser({ id: 'u-current' });
    server.use(supabaseSelect('recipes', null));

    const result = await apiClient.checkDuplicateTitle('Brand New Recipe');

    expect(result).toEqual({
      isDuplicate: false,
      existingId: undefined,
      existingTitle: undefined,
    });
  });

  it('throws when the query errors with a non-PGRST116 code', async () => {
    mockCurrentUser({ id: 'u-current' });
    server.use(
      supabaseSelect('recipes', () =>
        HttpResponse.json(
          { message: 'permission denied', code: '42501' },
          { status: 403 }
        )
      )
    );

    await expect(apiClient.checkDuplicateTitle('X')).rejects.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────
// Households (P1)
// ─────────────────────────────────────────────────────────────────────

describe('apiClient.updateHousehold', () => {
  // PATCH /rest/v1/households with { name } filtered by id, .select().single().
  it('PATCHes the new name and returns the camelCased row', async () => {
    let capturedBody: any = null;
    let capturedUrl = '';
    server.use(
      supabasePatch('households', async ({ request }) => {
        capturedUrl = request.url;
        capturedBody = await request.json();
        return HttpResponse.json({
          id: 'h-1',
          name: 'Smith-Jones Family',
          created_at: '2026-01-01T00:00:00Z',
        });
      })
    );

    const result = await apiClient.updateHousehold('h-1', {
      name: 'Smith-Jones Family',
    });

    expect(capturedUrl).toContain('id=eq.h-1');
    expect(capturedBody).toEqual({ name: 'Smith-Jones Family' });
    expect(result).toMatchObject({
      id: 'h-1',
      name: 'Smith-Jones Family',
      createdAt: '2026-01-01T00:00:00Z',
    });
  });

  it('throws when the update fails', async () => {
    server.use(
      supabasePatch('households', () =>
        HttpResponse.json(
          { message: 'permission denied', code: '42501' },
          { status: 403 }
        )
      )
    );

    await expect(
      apiClient.updateHousehold('h-1', { name: 'X' })
    ).rejects.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────
// Household invites (edge function GETs/POSTs)
// ─────────────────────────────────────────────────────────────────────

describe('apiClient.getInviteDetails', () => {
  // GETs the household-invite/details edge function with an inviteId query
  // param. URL-encodes the id before appending.
  it('GETs the edge function and returns its JSON body verbatim', async () => {
    let capturedUrl = '';
    server.use(
      supabaseEdgeGet('household-invite/details', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          inviteId: 'inv-1',
          householdName: 'Smith Family',
          inviterDisplayName: 'Alice',
        });
      })
    );

    const result = await apiClient.getInviteDetails('inv-1');

    expect(capturedUrl).toContain('id=inv-1');
    expect(result).toEqual({
      inviteId: 'inv-1',
      householdName: 'Smith Family',
      inviterDisplayName: 'Alice',
    });
  });

  it('URL-encodes the invite id', async () => {
    let capturedUrl = '';
    server.use(
      supabaseEdgeGet('household-invite/details', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ inviteId: 'a/b c' });
      })
    );

    await apiClient.getInviteDetails('a/b c');

    // '/' encodes to %2F and ' ' encodes to %20
    expect(capturedUrl).toContain('id=a%2Fb%20c');
  });

  it('throws when the edge function responds with an error', async () => {
    server.use(
      supabaseEdgeGet(
        'household-invite/details',
        { error: 'not found' },
        404
      )
    );

    await expect(apiClient.getInviteDetails('missing')).rejects.toThrow();
  });
});

describe('apiClient.acceptInviteById', () => {
  // POSTs to household-invite/accept with { inviteId } in the body.
  it('forwards the inviteId in the request body', async () => {
    let capturedBody: any = null;
    server.use(
      supabaseEdgePost('household-invite/accept', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          householdId: 'h-1',
          householdName: 'Smith Family',
        });
      })
    );

    const result = await apiClient.acceptInviteById('inv-1');

    expect(capturedBody).toEqual({ inviteId: 'inv-1' });
    expect(result).toEqual({
      householdId: 'h-1',
      householdName: 'Smith Family',
    });
  });

  it('throws when the edge function responds with an error', async () => {
    server.use(
      supabaseEdgePost(
        'household-invite/accept',
        { error: 'invite expired' },
        410
      )
    );

    await expect(apiClient.acceptInviteById('inv-1')).rejects.toThrow();
  });
});

describe('apiClient.resendHouseholdInvite', () => {
  // POSTs to household-invite/resend with { inviteId, origin } in the body.
  it('forwards inviteId and origin in the request body', async () => {
    let capturedBody: any = null;
    server.use(
      supabaseEdgePost('household-invite/resend', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ resent: true });
      })
    );

    await apiClient.resendHouseholdInvite('inv-1');

    expect(capturedBody).toMatchObject({ inviteId: 'inv-1' });
    // origin is sourced from window.location.origin (jsdom default).
    expect(typeof capturedBody.origin).toBe('string');
  });

  it('throws when the edge function responds with an error', async () => {
    server.use(
      supabaseEdgePost(
        'household-invite/resend',
        { error: 'rate limited' },
        429
      )
    );

    await expect(apiClient.resendHouseholdInvite('inv-1')).rejects.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────
// Collection reads (single + recipes within)
// ─────────────────────────────────────────────────────────────────────

describe('apiClient.getCollection', () => {
  // GET /rest/v1/recipe_collections?id=eq.{id} with .single().
  it('returns the camelCased single collection row by id', async () => {
    let capturedUrl = '';
    server.use(
      supabaseSelect('recipe_collections', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          id: 'c-1',
          user_id: 'u-1',
          name: 'Weeknight Dinners',
          description: 'Fast meals',
          sort_order: 0,
          created_at: '2026-04-01T00:00:00Z',
        });
      })
    );

    const result = await apiClient.getCollection('c-1');

    expect(capturedUrl).toContain('id=eq.c-1');
    expect(result).toMatchObject({
      id: 'c-1',
      userId: 'u-1',
      name: 'Weeknight Dinners',
      description: 'Fast meals',
      sortOrder: 0,
      createdAt: '2026-04-01T00:00:00Z',
    });
  });

  it('throws when the query errors', async () => {
    server.use(
      supabaseSelect('recipe_collections', () =>
        HttpResponse.json(
          { message: 'not found', code: 'PGRST116' },
          { status: 406 }
        )
      )
    );

    await expect(apiClient.getCollection('c-missing')).rejects.toThrow();
  });
});

describe('apiClient.getCollectionRecipes', () => {
  // GET /rest/v1/collection_recipes filtered by collection_id, ordered by
  // sort_order asc. Each row carries a nested `recipes` object (PostgREST
  // embedded resource). snakeToCamel walks the whole tree.
  it('returns each join row with the embedded recipe camelCased', async () => {
    let capturedUrl = '';
    server.use(
      supabaseSelect('collection_recipes', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json([
          {
            recipe_id: 'r-1',
            sort_order: 0,
            added_at: '2026-04-02T00:00:00Z',
            recipes: {
              id: 'r-1',
              title: 'Pasta',
              user_id: 'u-1',
              prep_time: 10,
            },
          },
          {
            recipe_id: 'r-2',
            sort_order: 1,
            added_at: '2026-04-03T00:00:00Z',
            recipes: {
              id: 'r-2',
              title: 'Stew',
              user_id: 'u-1',
              prep_time: 30,
            },
          },
        ]);
      })
    );

    const result = await apiClient.getCollectionRecipes('c-1');

    expect(capturedUrl).toContain('collection_id=eq.c-1');
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      recipeId: 'r-1',
      sortOrder: 0,
      addedAt: '2026-04-02T00:00:00Z',
      recipes: {
        id: 'r-1',
        title: 'Pasta',
        userId: 'u-1',
        prepTime: 10,
      },
    });
  });

  it('returns [] when the join table query returns []', async () => {
    server.use(supabaseSelect('collection_recipes', []));

    const result = await apiClient.getCollectionRecipes('c-1');

    expect(result).toEqual([]);
  });

  it('throws when the query errors', async () => {
    server.use(
      supabaseSelect('collection_recipes', () =>
        HttpResponse.json(
          { message: 'permission denied', code: '42501' },
          { status: 403 }
        )
      )
    );

    await expect(apiClient.getCollectionRecipes('c-1')).rejects.toThrow();
  });
});

describe('apiClient.searchRecipesText', () => {
  // MOP-0007 Phase 1 — server-side full-text search over the user's recipes.

  it('returns [] when query is empty (no network call)', async () => {
    const result = await apiClient.searchRecipesText('');
    expect(result).toEqual([]);
  });

  it('returns [] when query is whitespace-only (no network call)', async () => {
    const result = await apiClient.searchRecipesText('   ');
    expect(result).toEqual([]);
  });

  it('returns [] when unauthenticated', async () => {
    mockCurrentUser({ id: '' });
    // The helper above mocks `auth.getUser()` to return a user with no id —
    // the implementation treats falsy user as unauthenticated and short-circuits.
    // To exercise the truly-no-user path, spy on getUser to return { user: null }.
    vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: null },
      error: null,
    } as any);

    const result = await apiClient.searchRecipesText('chicken');
    expect(result).toEqual([]);
  });

  it('converts snake_case RPC payload to camelCase', async () => {
    mockCurrentUser({ id: 'u-current' });
    const snakePayload = [
      {
        recipe_id: 'r-1',
        title: 'Chicken Tikka Masala',
        description: 'Creamy and rich',
        ingredients: [{ name: 'chicken', amount: 500, unit: 'g' }],
        instructions: ['Marinate', 'Cook'],
        rank_score: 0.84,
      },
      {
        recipe_id: 'r-2',
        title: 'Chicken Soup',
        description: null,
        ingredients: [],
        instructions: [],
        rank_score: 0.42,
      },
    ];
    server.use(supabaseRpc('search_recipes_text', snakePayload));

    const result = await apiClient.searchRecipesText('chicken');

    expect(result).toEqual([
      {
        recipeId: 'r-1',
        title: 'Chicken Tikka Masala',
        description: 'Creamy and rich',
        ingredients: [{ name: 'chicken', amount: 500, unit: 'g' }],
        instructions: ['Marinate', 'Cook'],
        rankScore: 0.84,
      },
      {
        recipeId: 'r-2',
        title: 'Chicken Soup',
        description: null,
        ingredients: [],
        instructions: [],
        rankScore: 0.42,
      },
    ]);
  });

  it('returns [] when the RPC returns null (no matches)', async () => {
    mockCurrentUser({ id: 'u-current' });
    server.use(supabaseRpc('search_recipes_text', null));

    const result = await apiClient.searchRecipesText('zzz');
    expect(result).toEqual([]);
  });

  it('throws when the RPC errors', async () => {
    mockCurrentUser({ id: 'u-current' });
    server.use(
      supabaseRpc('search_recipes_text', () =>
        HttpResponse.json(
          { message: 'not authenticated', code: '42501' },
          { status: 401 }
        )
      )
    );

    await expect(apiClient.searchRecipesText('chicken')).rejects.toThrow();
  });
});

describe('apiClient.getMyProfile', () => {
  it('throws when user is not authenticated', async () => {
    vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: null },
      error: null,
    } as any);

    await expect(apiClient.getMyProfile()).rejects.toThrow('User not authenticated');
  });

  it('returns camelCase profile for the current user', async () => {
    mockCurrentUser({ id: 'u-1', email: 'alice@example.com' });
    server.use(
      supabaseSelect('profiles', {
        id: 'u-1',
        username: 'alice_cooks',
        display_name: 'Alice',
        setup_completed: true,
      })
    );

    const result = await apiClient.getMyProfile();

    expect(result).toMatchObject({
      id: 'u-1',
      username: 'alice_cooks',
      displayName: 'Alice',
      setupCompleted: true,
    });
  });
});

describe('apiClient.updateUsername', () => {
  it('rejects invalid username format before hitting the database', async () => {
    mockCurrentUser({ id: 'u-1' });

    await expect(apiClient.updateUsername('Bad Username!')).rejects.toThrow(
      'Username must be 3-30 characters'
    );
  });

  it('maps duplicate username errors to a friendly message', async () => {
    mockCurrentUser({ id: 'u-1' });
    server.use(
      supabasePatch('profiles', () =>
        HttpResponse.json(
          { code: '23505', message: 'duplicate key value' },
          { status: 409 }
        )
      )
    );

    await expect(apiClient.updateUsername('taken_name')).rejects.toThrow(
      'Username already taken'
    );
  });

  it('updates and returns the profile on success', async () => {
    mockCurrentUser({ id: 'u-1' });
    server.use(
      supabasePatch('profiles', {
        id: 'u-1',
        username: 'new_handle',
        display_name: 'Alice',
      })
    );

    const result = await apiClient.updateUsername('new_handle');

    expect(result.username).toBe('new_handle');
  });
});

describe('apiClient.sendMessage', () => {
  it('posts to chat-api and returns the agent response envelope', async () => {
    const payload = {
      message: 'Find my chicken recipes',
      sessionId: 'sess-1',
      context: { conversationId: 'conv-1' },
    };

    server.use(
      supabaseEdgePost('chat-api/message', {
        message: 'Here are your chicken recipes.',
        response: {
          id: 'msg-1',
          content: 'Here are your chicken recipes.',
          sender: 'ai',
          timestamp: '2026-06-14T12:00:00Z',
        },
        intentMetadata: { source: 'tool_agent', toolCalls: [{ name: 'search_recipes', args: {}, ok: true }] },
        conversationId: 'conv-1',
        sessionId: 'sess-1',
      })
    );

    const result = await apiClient.sendMessage(payload);

    expect(result.response.content).toContain('chicken recipes');
    expect(result.intentMetadata?.source).toBe('tool_agent');
  });

  it('propagates edge function errors', async () => {
    server.use(
      supabaseEdgePost('chat-api/message', () =>
        HttpResponse.json({ error: 'upstream failure' }, { status: 502 })
      )
    );

    await expect(
      apiClient.sendMessage({ message: 'hello', sessionId: 's-1' })
    ).rejects.toThrow();
  });
});
