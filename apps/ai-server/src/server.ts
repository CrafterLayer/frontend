import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

/**
 * The Node adapter: `http.IncomingMessage` in, platform `Request` to the
 * handler, platform `Response` back out over `ServerResponse`.
 *
 * Separated from `main.ts` for one reason: this is the layer where the
 * server failed to start while every gate was green. The handler was tested
 * through platform objects and never through a socket, so nothing exercised
 * header flattening, body assembly, abort-on-disconnect, or the streaming
 * write loop. A factory that does not `listen()` is what lets a test bind
 * port 0, make real requests, and close — the adapter under test, no key
 * needed.
 */

export type Handle = (request: Request) => Promise<Response>;

/**
 * Node's header bag allows `string[]` (repeated headers) and `undefined`; the
 * platform `Headers` takes neither. Flattened rather than cast, so a repeated
 * header arrives as one comma-joined value the way every HTTP intermediary
 * would send it.
 */
export function flattenHeaders(headers: IncomingMessage['headers']): [string, string][] {
  return Object.entries(headers).flatMap(([name, value]) =>
    value === undefined ? [] : [[name, Array.isArray(value) ? value.join(', ') : value]],
  );
}

function readBody(incoming: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    incoming.on('data', (chunk: Buffer) => chunks.push(chunk));
    incoming.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    incoming.on('error', reject);
  });
}

async function pipe(response: Response, outgoing: ServerResponse): Promise<void> {
  outgoing.writeHead(response.status, Object.fromEntries(response.headers));
  const body: ReadableStream<Uint8Array> | null = response.body;
  if (body === null) {
    outgoing.end();
    return;
  }
  const reader = body.getReader();
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    outgoing.write(chunk.value);
  }
  outgoing.end();
}

/** An `http.Server` that has NOT been told to listen; the caller decides where. */
export function createNodeServer(handle: Handle): Server {
  return createServer((incoming, outgoing) => {
    const controller = new AbortController();
    /*
      A closed socket before the response finished means the user navigated
      away or pressed stop. Aborting here is what stops Claude generating a
      plan nobody will read — and what stops paying for it.
    */
    outgoing.on('close', () => {
      if (!outgoing.writableEnded) controller.abort();
    });

    void readBody(incoming)
      .then((body) => {
        const url = `http://${incoming.headers.host ?? 'localhost'}${incoming.url ?? '/'}`;
        const method = incoming.method ?? 'GET';
        return handle(
          new Request(url, {
            method,
            headers: flattenHeaders(incoming.headers),
            ...(method === 'GET' || method === 'HEAD' || body.byteLength === 0 ? {} : { body }),
            signal: controller.signal,
          }),
        );
      })
      .then((response) => pipe(response, outgoing))
      .catch(() => {
        if (!outgoing.headersSent) {
          outgoing.writeHead(500, { 'content-type': 'application/json' });
        }
        outgoing.end(JSON.stringify({ error: 'The assistant server failed unexpectedly.' }));
      });
  });
}
