import { describe, expect, it, vi } from 'vitest';

import type { AssembledAiContext } from '../types';
import { MAX_REMOTE_ERROR_MESSAGE_LENGTH } from './remote-errors';
import { createRemoteAiPlanProvider } from './remote-provider';

const ENDPOINT = 'https://assistant.example.test/plan';
const CONTEXT = {} as AssembledAiContext;

function json(payload: unknown, status = 500): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function provider(response: Response, maxResponseBytes?: number) {
  return createRemoteAiPlanProvider({
    endpoint: ENDPOINT,
    fetch: () => Promise.resolve(response),
    ...(maxResponseBytes === undefined ? {} : { maxResponseBytes }),
  });
}

describe('bounded HTTP failure explanations', () => {
  it('keeps an actionable terminal refusal before streaming', async () => {
    await expect(
      provider(json({ error: 'Model "unavailable" is not one this server allows.' }, 400)).propose(
        'Make a game',
        CONTEXT,
      ),
    ).rejects.toMatchObject({
      code: 'http-status',
      status: 400,
      retryable: false,
      message: 'Model "unavailable" is not one this server allows.',
    });
  });

  it.each(['json', 'sse'])(
    'preserves terminal metadata over %s without changing status',
    async (format) => {
      const response =
        format === 'json'
          ? json({ error: 'The provider key is invalid.', retryable: false })
          : new Response(
              'event: error\ndata: {"status":500,"message":"The provider key is invalid.","retryable":false}\n\n',
              { headers: { 'content-type': 'text/event-stream' } },
            );
      await expect(provider(response).propose('Make a game', CONTEXT)).rejects.toMatchObject({
        message: 'The provider key is invalid.',
        status: 500,
        retryable: false,
      });
    },
  );

  it.each([408, 429, 502, 503])('keeps legacy status %i retryable', async (status) => {
    await expect(
      provider(json({ error: 'Temporarily unavailable.' }, status)).propose('Make a game', CONTEXT),
    ).rejects.toMatchObject({ status, retryable: true });
  });

  it.each([true, 'false', 0, null])(
    'does not use malformed or permissive retry metadata %s',
    async (retryable) => {
      await expect(
        provider(json({ error: 'Malformed request.', retryable }, 400)).propose(
          'Make a game',
          CONTEXT,
        ),
      ).rejects.toMatchObject({ status: 400, retryable: false });
      await expect(
        provider(json({ error: 'Unavailable.', retryable }, 503)).propose('Make a game', CONTEXT),
      ).rejects.toMatchObject({ status: 503, retryable: true });
    },
  );

  it.each([
    { error: { message: 'Nested upstream detail.' } },
    { error: 42 },
    ['error', 'Arbitrary response'],
    { error: '<script>unsafe()</script>' },
    { error: '   ' },
  ])('falls back to status for an invalid or HTML envelope: %j', async (body) => {
    await expect(provider(json(body, 503)).propose('Make a game', CONTEXT)).rejects.toMatchObject({
      status: 503,
      message: 'The assistant server answered with status 503.',
      retryable: true,
    });
  });

  it('bounds even a correctly shaped explanation', async () => {
    await expect(
      provider(json({ error: 'x'.repeat(2_000) })).propose('Make a game', CONTEXT),
    ).rejects.toMatchObject({ message: 'x'.repeat(MAX_REMOTE_ERROR_MESSAGE_LENGTH) });
  });

  it.each([
    { body: '<html>upstream proxy stack</html>', contentType: 'text/html' },
    { body: 'not JSON', contentType: 'application/json' },
    { body: JSON.stringify({ error: 'x'.repeat(9_000) }), contentType: 'application/json' },
  ])(
    'preserves status when an error body is unsafe or too large',
    async ({ body, contentType }) => {
      await expect(
        provider(
          new Response(body, { status: 502, headers: { 'content-type': contentType } }),
        ).propose('Make a game', CONTEXT),
      ).rejects.toMatchObject({
        status: 502,
        message: 'The assistant server answered with status 502.',
      });
    },
  );

  it('honors a smaller configured response limit on error bodies', async () => {
    await expect(
      provider(json({ error: 'x'.repeat(200) }), 100).propose('Make a game', CONTEXT),
    ).rejects.toMatchObject({
      status: 500,
      message: 'The assistant server answered with status 500.',
    });
  });

  it('cancels oversized declared JSON and HTML without waiting for their body', async () => {
    for (const contentType of ['application/json', 'text/html']) {
      const cancel = vi.fn();
      const response = new Response(new ReadableStream({ cancel }), {
        status: 503,
        headers: { 'content-type': contentType, 'content-length': '999999' },
      });
      await expect(provider(response).propose('Make a game', CONTEXT)).rejects.toMatchObject({
        status: 503,
      });
      expect(cancel).toHaveBeenCalledOnce();
    }
  });

  it.each(['caller', 'deadline'])(
    'settles a stalled error reader on %s cancellation',
    async (reason) => {
      const reading = Promise.withResolvers<undefined>();
      const cancel = vi.fn(() => Promise.resolve());
      const releaseLock = vi.fn();
      const response = json({ error: 'Never arrives.' });
      Object.defineProperty(response, 'body', {
        value: {
          getReader: () => ({
            read: () => {
              reading.resolve(undefined);
              return new Promise(() => undefined);
            },
            cancel,
            releaseLock,
          }),
        },
      });
      const controller = new AbortController();
      const remote = createRemoteAiPlanProvider({
        endpoint: ENDPOINT,
        timeoutMs: reason === 'deadline' ? 20 : 1_000,
        fetch: () => Promise.resolve(response),
      });
      const pending = remote.propose('Make a game', CONTEXT, { signal: controller.signal });
      const assertion = expect(pending).rejects.toMatchObject(
        reason === 'caller' ? { name: 'AbortError' } : { code: 'timeout', retryable: true },
      );
      await reading.promise;
      if (reason === 'caller') controller.abort();
      await assertion;
      expect(cancel).toHaveBeenCalledOnce();
      expect(releaseLock).toHaveBeenCalledOnce();
    },
  );
});
