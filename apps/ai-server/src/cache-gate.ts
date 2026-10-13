import { createHash } from 'node:crypto';

/*
  Parallel requests that share a prefix, staggered so they share its cache (2026-10-12).

  A cache entry becomes readable only once the request writing it starts streaming. A page
  build sends its section writers together (three workers by default), each with the same
  rules, catalog and skills, so each paid the write and none read what the others were still
  writing. Now the first request of a shape goes alone; the others wait for its first
  streamed event (by then its prefix is cached) and read it. A shape that streamed recently
  is warm, and its requests go straight through. A wait is bounded and also ends when the
  first request fails or is cancelled, so a stuck writer delays its siblings by seconds at
  most and never fails them.
*/

/** The longest a request waits for its shape's first writer. */
export const CACHE_GATE_MAX_WAIT_MS = 15_000;
/** How long a shape stays warm after it streamed: under the breakpoints' one-hour lifetime. */
export const CACHE_GATE_WARM_MS = 50 * 60_000;

/** Called once the request streams (`true`: its prefix is cached) or ends without streaming. */
export type CacheGateRelease = (streamed: boolean) => void;

export interface CacheGate {
  /** Resolves when a request of this shape may start. */
  enter(shape: string, signal?: AbortSignal): Promise<CacheGateRelease>;
}

export interface CacheGateOptions {
  readonly maxWaitMs?: number;
  readonly warmMs?: number;
  readonly now?: () => number;
}

export function createCacheGate(options: CacheGateOptions = {}): CacheGate {
  const maxWaitMs = options.maxWaitMs ?? CACHE_GATE_MAX_WAIT_MS;
  const warmMs = options.warmMs ?? CACHE_GATE_WARM_MS;
  const now = options.now ?? Date.now;
  // A writer that never released (its caller threw) is stale after `maxWaitMs`: the next takes over.
  const writing = new Map<string, { readonly done: Promise<void>; readonly since: number }>();
  const warmUntil = new Map<string, number>();
  const noop: CacheGateRelease = () => undefined;
  return {
    async enter(shape, signal) {
      if ((warmUntil.get(shape) ?? 0) > now()) return noop;
      const pending = writing.get(shape);
      if (pending !== undefined && now() - pending.since < maxWaitMs) {
        await waitFor(pending.done, Math.max(0, maxWaitMs - (now() - pending.since)), signal);
        return noop;
      }
      let open = (): void => undefined;
      const done = new Promise<void>((resolve) => {
        open = resolve;
      });
      const entry = { done, since: now() };
      writing.set(shape, entry);
      let released = false;
      return (streamed) => {
        if (released) return;
        released = true;
        if (streamed) {
          for (const [key, until] of warmUntil) if (until <= now()) warmUntil.delete(key);
          warmUntil.set(shape, now() + warmMs);
        }
        if (writing.get(shape) === entry) writing.delete(shape);
        open();
      };
    },
  };
}

function waitFor(pending: Promise<void>, maxWaitMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted === true) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, maxWaitMs);
    signal?.addEventListener('abort', finish, { once: true });
    void pending.then(finish);
  });
}

/** A stream opened under the gate: a call that throws before streaming lets its siblings go. */
export function opened<T>(release: CacheGateRelease, open: () => T): T {
  try {
    return open();
  } catch (error) {
    release(false);
    throw error;
  }
}

/** One request's cache shape: everything that decides whether it can read another's prefix. */
export function cacheShape(parts: readonly unknown[]): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

/** The server's one gate: every plan request passes through it. */
export const SHARED_CACHE_GATE: CacheGate = createCacheGate();
