import { describe, expect, it, vi } from 'vitest';

import { isLoopbackOrigin, parseAllowedOrigins, withCors } from './cors';
import { createNodeServer } from './server';

/**
 * The bug this file pins: the playground at http://localhost:5173 fetched the
 * server and the browser said "Failed to fetch". The preflight OPTIONS got a
 * 405 with no Access-Control-Allow-Origin, which a browser turns into a
 * network error before any body is sent. Every gate was green — none of them
 * was a browser.
 */
const OK = new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } });

function request(method: string, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost:8787/plan', {
    method,
    headers,
    ...(method === 'POST' ? { body: '{}' } : {}),
  });
}

describe('isLoopbackOrigin', () => {
  it.each([
    'http://localhost:5173',
    'http://localhost:4173',
    'http://127.0.0.1:5173',
    'http://[::1]:5173',
    'https://localhost:5173',
    'http://localhost',
  ])('admits %s — any port, because Vite picks its own', (origin) => {
    expect(isLoopbackOrigin(origin)).toBe(true);
  });

  it.each([
    'http://localhost:5173/',
    'http://localhost.evil.com',
    'http://evil.com',
    'ftp://localhost',
    'localhost:5173',
    'null',
    '',
  ])('refuses %s', (origin) => {
    expect(isLoopbackOrigin(origin)).toBe(false);
  });
});

describe('parseAllowedOrigins', () => {
  it('defaults to loopback origins when the variable is unset or blank', () => {
    for (const value of [undefined, '', '  ', ' , ']) {
      const allowed = parseAllowedOrigins(value);
      expect(allowed('http://localhost:5173')).toBe(true);
      expect(allowed('https://app.example.com')).toBe(false);
    }
  });

  it('an explicit list replaces the default rather than extending it', () => {
    const allowed = parseAllowedOrigins(' https://app.example.com, https://studio.example.com ,');

    expect(allowed('https://app.example.com')).toBe(true);
    expect(allowed('https://studio.example.com')).toBe(true);
    expect(allowed('http://localhost:5173')).toBe(false);
    expect(allowed('https://app.example.com/')).toBe(false);
  });

  it.each(['app.example.com', 'https://app.example.com/plan', 'ftp://x.example', 'https://a b'])(
    'refuses the entry %s at startup instead of silently allowing nothing',
    (entry) => {
      expect(() => parseAllowedOrigins(entry)).toThrow(/CRAFTKIT_AI_ALLOWED_ORIGINS/u);
    },
  );
});

describe('withCors', () => {
  const allowed = (origin: string): boolean => origin === 'http://localhost:5173';

  it('answers an allowed preflight itself: 204, the origin echoed, the asked-for headers granted', async () => {
    const handle = vi.fn(() => Promise.resolve(OK.clone()));
    const response = await withCors(handle, allowed)(
      request('OPTIONS', {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization,content-type',
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect(response.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS');
    expect(response.headers.get('access-control-allow-headers')).toBe('authorization,content-type');
    expect(response.headers.get('access-control-max-age')).toBe('600');
    expect(response.headers.get('vary')).toBe('Origin');
    expect(handle).not.toHaveBeenCalled();
  });

  it('grants the standard headers when the preflight names none', async () => {
    const response = await withCors(
      () => Promise.resolve(OK.clone()),
      allowed,
    )(request('OPTIONS', { origin: 'http://localhost:5173' }));

    expect(response.headers.get('access-control-allow-headers')).toBe(
      'authorization, content-type, accept',
    );
  });

  it('refuses a preflight from another origin without reaching the handler', async () => {
    const handle = vi.fn(() => Promise.resolve(OK.clone()));
    const response = await withCors(handle, allowed)(
      request('OPTIONS', { origin: 'https://evil.example' }),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect(handle).not.toHaveBeenCalled();
  });

  it('stamps the origin on a real response and keeps status, headers and body', async () => {
    const response = await withCors(
      () =>
        Promise.resolve(
          new Response('{"error":"Unauthorized."}', {
            status: 401,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      allowed,
    )(request('POST', { origin: 'http://localhost:5173' }));

    expect(response.status).toBe(401);
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect(response.headers.get('vary')).toBe('Origin');
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized.' });
  });

  it('keeps a streaming body streaming — the SSE path is the one the panel uses', async () => {
    const chunks = ['event: progress\n\n', 'event: done\n\n'];
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
        controller.close();
      },
    });
    const response = await withCors(
      () => Promise.resolve(new Response(stream, { headers: { 'content-type': 'text/event-stream' } })),
      allowed,
    )(request('POST', { origin: 'http://localhost:5173', accept: 'text/event-stream' }));

    expect(response.headers.get('content-type')).toBe('text/event-stream');
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    await expect(response.text()).resolves.toBe(chunks.join(''));
  });

  it('refuses a browser request from another origin BEFORE the model is called — no plan is paid for that the browser would discard', async () => {
    const handle = vi.fn(() => Promise.resolve(OK.clone()));
    const response = await withCors(handle, allowed)(
      request('POST', { origin: 'https://evil.example' }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Origin not allowed.' });
    expect(handle).not.toHaveBeenCalled();
  });

  it('leaves a request with no Origin (curl, a server, a test) exactly as it was', async () => {
    const handle = vi.fn(() => Promise.resolve(OK.clone()));
    const response = await withCors(handle, allowed)(request('POST'));

    expect(handle).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect(response.headers.get('vary')).toBeNull();
  });
});

describe('through the Node adapter', () => {
  it('a browser-shaped preflight over a real socket gets 204 and the CORS headers', async () => {
    const server = createNodeServer(
      withCors(
        () => Promise.resolve(OK.clone()),
        isLoopbackOrigin,
      ),
    );
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('no port');

    try {
      const response = await fetch(`http://127.0.0.1:${String(address.port)}/plan`, {
        method: 'OPTIONS',
        headers: {
          origin: 'http://localhost:5173',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'authorization,content-type',
        },
      });

      expect(response.status).toBe(204);
      expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
      expect(response.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS');
      expect(await response.text()).toBe('');
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error === undefined) resolve();
          else reject(error);
        });
      });
    }
  });
});
