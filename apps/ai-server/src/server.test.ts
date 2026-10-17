import { request as httpRequest, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';

import { createNodeServer, flattenHeaders, type Handle } from './server';

/**
 * The Node adapter, driven over a real socket.
 *
 * This layer is where the first version of the server failed to start while
 * lint, typecheck, and every handler test were green: nothing had ever put a
 * request through `http.createServer` and read the answer back. So these
 * tests bind port 0, speak HTTP, and assert on what came out of the socket —
 * no key, no network beyond loopback, and nothing faked between the client
 * and the handler.
 */

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => {
            resolve();
          });
        }),
    ),
  );
});

async function boot(handle: Handle): Promise<string> {
  const server = createNodeServer(handle);
  servers.push(server);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve();
    });
  });
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  return `http://127.0.0.1:${String(address.port)}`;
}

describe('flattenHeaders', () => {
  it('joins a repeated header the way an intermediary would, and drops undefined', () => {
    // `set-cookie` is the header Node itself types as `string[]`.
    expect(
      flattenHeaders({ 'set-cookie': ['a=1', 'b=2'], accept: 'text/plain', 'x-none': undefined }),
    ).toEqual([
      ['set-cookie', 'a=1, b=2'],
      ['accept', 'text/plain'],
    ]);
  });
});

describe('createNodeServer', () => {
  it('delivers method, path, query, headers, and body to the handler', async () => {
    let seen: { method: string; url: string; auth: string | null; body: unknown } | undefined;
    const base = await boot(async (request) => {
      seen = {
        method: request.method,
        url: new URL(request.url).pathname + new URL(request.url).search,
        auth: request.headers.get('authorization'),
        body: await request.json(),
      };
      return new Response('ok');
    });

    const response = await fetch(`${base}/plan?trace=1`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer t' },
      body: JSON.stringify({ hello: 'world' }),
    });

    expect(response.status).toBe(200);
    expect(seen).toEqual({
      method: 'POST',
      url: '/plan?trace=1',
      auth: 'Bearer t',
      body: { hello: 'world' },
    });
  });

  it('passes status, headers, and body back out unchanged', async () => {
    const base = await boot(async () =>
      Promise.resolve(
        new Response(JSON.stringify({ error: 'Use POST.' }), {
          status: 405,
          headers: { 'content-type': 'application/json', 'x-custom': 'kept' },
        }),
      ),
    );

    const response = await fetch(base);

    expect(response.status).toBe(405);
    expect(response.headers.get('x-custom')).toBe('kept');
    expect(await response.json()).toEqual({ error: 'Use POST.' });
  });

  it('builds a GET without a body rather than an empty one', async () => {
    let hadBody: boolean | undefined;
    const base = await boot(async (request) => {
      hadBody = request.body !== null;
      return Promise.resolve(new Response(null, { status: 204 }));
    });

    const response = await fetch(base);

    expect(response.status).toBe(204);
    expect(hadBody).toBe(false);
  });

  it('pipes a streaming response frame by frame, in order', async () => {
    const encoder = new TextEncoder();
    const base = await boot(async () =>
      Promise.resolve(
        new Response(
          new ReadableStream<Uint8Array>({
            async start(controller) {
              controller.enqueue(encoder.encode('event: status\ndata: {"text":"one"}\n\n'));
              await new Promise((resolve) => setTimeout(resolve, 10));
              controller.enqueue(encoder.encode('event: result\ndata: {"ok":true}\n\n'));
              controller.close();
            },
          }),
          { headers: { 'content-type': 'text/event-stream' } },
        ),
      ),
    );

    const text = await (await fetch(base, { method: 'POST', body: '{}' })).text();

    expect(text.indexOf('event: status')).toBeLessThan(text.indexOf('event: result'));
    expect(text).toContain('{"ok":true}');
  });

  it('aborts the handler when the client hangs up mid-request', async () => {
    /*
      The behaviour that turns "user pressed stop" into "Claude stops
      generating": the socket closing must reach the handler as an aborted
      signal, or the plan keeps being produced and paid for.
    */
    let received!: () => void;
    const requestArrived = new Promise<void>((resolve) => {
      received = resolve;
    });
    let aborted!: () => void;
    const handlerSawAbort = new Promise<void>((resolve) => {
      aborted = resolve;
    });

    const base = await boot(
      (request) =>
        new Promise<Response>((resolve) => {
          received();
          request.signal.addEventListener('abort', () => {
            aborted();
            resolve(new Response(null, { status: 499 }));
          });
        }),
    );

    const url = new URL(base);
    const client = httpRequest({
      host: url.hostname,
      port: url.port,
      method: 'POST',
      path: '/',
      headers: { 'content-type': 'application/json' },
    });
    client.on('error', () => undefined);
    client.end('{}');

    await requestArrived;
    client.destroy();

    await expect(
      Promise.race([
        handlerSawAbort.then(() => 'aborted'),
        new Promise((resolve) => {
          setTimeout(() => {
            resolve('timed out');
          }, 2_000);
        }),
      ]),
    ).resolves.toBe('aborted');
  });

  it('answers 500 with a plain sentence when the handler itself throws', async () => {
    const base = await boot(() => Promise.reject(new Error('internal detail at /x.ts:1')));

    const response = await fetch(base, { method: 'POST', body: '{}' });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(body.error).not.toContain('internal detail');
    expect(body.error).not.toContain('.ts:');
  });

  it('refuses a chunked body at the adapter limit before calling the handler', async () => {
    let calls = 0;
    const server = createNodeServer(
      () => {
        calls += 1;
        return Promise.resolve(new Response('unexpected'));
      },
      { maxRequestBytes: 5 },
    );
    servers.push(server);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        resolve();
      });
    });
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('no port');

    const response = await new Promise<{ status: number | undefined; body: string }>(
      (resolve, reject) => {
        const client = httpRequest(
          {
            host: '127.0.0.1',
            port: address.port,
            path: '/',
            method: 'POST',
            headers: { 'transfer-encoding': 'chunked' },
          },
          (incoming) => {
            let body = '';
            incoming.setEncoding('utf8');
            incoming.on('data', (chunk: string) => {
              body += chunk;
            });
            incoming.on('end', () => {
              resolve({ status: incoming.statusCode, body });
            });
          },
        );
        client.on('error', reject);
        client.write('123');
        client.end('456');
      },
    );

    expect(response.status).toBe(413);
    expect(JSON.parse(response.body)).toEqual({ error: 'Request too large.' });
    expect(calls).toBe(0);
  });
});
