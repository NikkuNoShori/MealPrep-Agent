/**
 * MOP-0008 — Frontend chat-agent contract tests.
 *
 * Mocks the chat-api edge function via MSW and asserts:
 *   - sendMessage returns a typed ChatMessageResponse
 *   - pendingConfirmation envelopes round-trip cleanly
 *   - context.confirmAction is forwarded on follow-up turns
 *   - the response type tolerates absent pendingConfirmation
 *
 * Note: we do NOT exercise UI components here — UI work is Phase 2 of
 * MOP-0008. This is the api.ts contract test.
 */

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { apiClient } from '../api';
import type {
  ChatMessageResponse,
  PendingConfirmation,
} from '../api';
import { server } from '@/test/msw/server';
import { SUPABASE_URL } from '@/test/msw/handlers';

const CHAT_ENDPOINT = `${SUPABASE_URL}/functions/v1/chat-api/message`;

describe('apiClient.sendMessage — MOP-0008 contract', () => {
  it('returns content + conversation metadata when no tools were called', async () => {
    server.use(
      http.post(CHAT_ENDPOINT, () =>
        HttpResponse.json({
          message: 'ok',
          response: {
            id: 'msg-1',
            content: 'Hi there!',
            sender: 'ai',
            timestamp: '2026-06-01T00:00:00Z',
          },
          conversationId: 'conv-1',
          sessionId: 'session-1',
          intentMetadata: { source: 'agent', toolCalls: [], iterations: 1 },
        } satisfies ChatMessageResponse)
      )
    );

    const result = await apiClient.sendMessage({
      message: 'hello',
      sessionId: 'session-1',
    });

    expect(result.response.content).toBe('Hi there!');
    expect(result.conversationId).toBe('conv-1');
    expect(result.pendingConfirmation).toBeUndefined();
    expect(result.intentMetadata?.toolCalls).toEqual([]);
  });

  it('surfaces a pendingConfirmation envelope for destructive tool calls', async () => {
    const pending: PendingConfirmation = {
      tool: 'delete_recipe',
      args: { recipe_id: 'aaaa-bbbb' },
      summary: 'Delete recipe aaaa-bbbb?',
      idempotencyKey: 'delete_recipe:xyz',
    };

    server.use(
      http.post(CHAT_ENDPOINT, () =>
        HttpResponse.json({
          message: 'ok',
          response: {
            id: 'msg-2',
            content: 'I need your confirmation before I can do that.',
            sender: 'ai',
            timestamp: '2026-06-01T00:00:01Z',
          },
          pendingConfirmation: pending,
          conversationId: 'conv-1',
          sessionId: 'session-1',
          intentMetadata: {
            source: 'agent',
            toolCalls: [
              {
                name: 'delete_recipe',
                args: { recipe_id: 'aaaa-bbbb' },
                ok: true,
              },
            ],
            iterations: 1,
          },
        } satisfies ChatMessageResponse)
      )
    );

    const result = await apiClient.sendMessage({
      message: 'delete the carbonara',
      sessionId: 'session-1',
    });

    expect(result.pendingConfirmation).toBeDefined();
    expect(result.pendingConfirmation?.tool).toBe('delete_recipe');
    expect(result.pendingConfirmation?.idempotencyKey).toBe('delete_recipe:xyz');
    expect(result.intentMetadata?.toolCalls?.[0].name).toBe('delete_recipe');
  });

  it('forwards context.confirmAction in the request body on the follow-up turn', async () => {
    let capturedBody: any = null;
    server.use(
      http.post(CHAT_ENDPOINT, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          message: 'ok',
          response: {
            id: 'msg-3',
            content: 'Done — I applied that change.',
            sender: 'ai',
            timestamp: '2026-06-01T00:00:02Z',
          },
          conversationId: 'conv-1',
          sessionId: 'session-1',
          intentMetadata: {
            source: 'agent',
            confirmAction: true,
            toolCalls: [
              {
                name: 'delete_recipe',
                args: { recipe_id: 'aaaa-bbbb' },
                ok: true,
                confirmed: true,
              },
            ],
          },
        } satisfies ChatMessageResponse);
      })
    );

    const result = await apiClient.sendMessage({
      message: '',
      sessionId: 'session-1',
      context: {
        confirmAction: {
          tool: 'delete_recipe',
          args: { recipe_id: 'aaaa-bbbb' },
          idempotencyKey: 'delete_recipe:xyz',
        },
      },
    });

    expect(capturedBody).toBeTruthy();
    expect(capturedBody.context?.confirmAction?.tool).toBe('delete_recipe');
    expect(capturedBody.context?.confirmAction?.args?.recipe_id).toBe(
      'aaaa-bbbb'
    );
    expect(result.intentMetadata?.confirmAction).toBe(true);
  });

  it('throws when the chat endpoint returns an error', async () => {
    server.use(
      http.post(CHAT_ENDPOINT, () =>
        HttpResponse.json(
          { error: 'OpenRouter API key not configured' },
          { status: 500 }
        )
      )
    );

    await expect(
      apiClient.sendMessage({ message: 'hi', sessionId: 'session-1' })
    ).rejects.toThrow();
  });
});
