import type { Handle } from './server';

/**
 * CORS for a browser-facing plan server.
 *
 * Why this file exists: the playground at http://localhost:5173 fetched the
 * server and the browser reported "Failed to fetch". Its preflight OPTIONS
 * had been answered 405 with no Access-Control-Allow-Origin, which a browser
 * turns into a network error before any body is sent. The deprecated bridge
 * on the same port (IPv4 only) had CORS; this server (IPv6 too, which the
 * browser tries first) did not — and every gate was green, because none of
 * them was a browser.
 *
 * Two rules beyond the headers themselves:
 * - A browser request from an origin that is NOT allowed is refused with 403
 *   before the handler runs. Processing it would pay for a plan the browser
 *   is going to discard anyway.
 * - A request with no Origin (curl, a server, a test) is left exactly as it
 *   was. CORS is a browser contract, not authentication — the bearer token
 *   in `handler.ts` is.
 */

/** Decides whether a browser origin may call this server. */
export type OriginPolicy = (origin: string) => boolean;

const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const ALLOW_METHODS = 'POST, OPTIONS';
const DEFAULT_ALLOW_HEADERS = 'authorization, content-type, accept, x-craftkit-ai-model';
const PREFLIGHT_MAX_AGE_SECONDS = 600;

function parseOrigin(value: string): URL | undefined {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  // An Origin header is scheme + host + port and nothing else; a path or a
  // trailing slash means this was not an origin.
  if (url.origin !== value) return undefined;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
  return url;
}

/**
 * Any http(s) origin on a loopback host, whatever the port: Vite, Storybook
 * and a preview build each pick their own. The default policy, because a
 * loopback origin can only be a browser on this machine.
 */
export function isLoopbackOrigin(origin: string): boolean {
  const url = parseOrigin(origin);
  return url !== undefined && LOOPBACK_HOSTS.has(url.hostname);
}

/**
 * `CRAFTKIT_AI_ALLOWED_ORIGINS`: comma-separated origins. Unset or blank ⇒
 * loopback only. An explicit list REPLACES the default rather than extending
 * it, so a deployment can be exactly as narrow as it says. A malformed entry
 * is refused at startup: a server that silently allows nothing is the bug
 * this file was written to end.
 */
export function parseAllowedOrigins(value: string | undefined): OriginPolicy {
  const listed = new Set<string>();
  for (const entry of (value ?? '').split(',')) {
    const origin = entry.trim();
    if (origin === '') continue;
    if (parseOrigin(origin) === undefined) {
      throw new Error(
        `CRAFTKIT_AI_ALLOWED_ORIGINS: "${origin}" is not an origin (expected scheme://host[:port]).`,
      );
    }
    listed.add(origin);
  }
  if (listed.size === 0) return isLoopbackOrigin;
  return (origin) => listed.has(origin);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function stampOrigin(headers: Headers, origin: string): void {
  headers.set('access-control-allow-origin', origin);
  headers.append('vary', 'Origin');
}

/** Wraps a handler so browsers on an allowed origin can call it. */
export function withCors(handle: Handle, allowed: OriginPolicy): Handle {
  return async (request) => {
    const origin = request.headers.get('origin');

    if (request.method === 'OPTIONS') {
      if (origin === null) return new Response(null, { status: 204 });
      if (!allowed(origin)) return json({ error: 'Origin not allowed.' }, 403);
      const headers = new Headers({
        'access-control-allow-methods': ALLOW_METHODS,
        'access-control-allow-headers':
          request.headers.get('access-control-request-headers') ?? DEFAULT_ALLOW_HEADERS,
        'access-control-max-age': String(PREFLIGHT_MAX_AGE_SECONDS),
      });
      stampOrigin(headers, origin);
      return new Response(null, { status: 204, headers });
    }

    if (origin === null) return handle(request);
    if (!allowed(origin)) return json({ error: 'Origin not allowed.' }, 403);

    const response = await handle(request);
    const headers = new Headers(response.headers);
    stampOrigin(headers, origin);
    // The body is handed over untouched — a streaming body keeps streaming.
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}
