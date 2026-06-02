import { describe, it, expect } from 'vitest';
import { HttpResponse } from 'msw';
import { apiClient } from '../api';
import { server } from '@/test/msw/server';
import {
  supabaseRpc,
  supabasePatch,
  supabaseDelete,
} from '@/test/msw/handlers';

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
