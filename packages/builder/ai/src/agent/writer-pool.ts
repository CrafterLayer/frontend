/*
  How many section writers a build runs, and the pool several builds share (T230,
  2026-10-12).

  A site build writes its pages at the same time, one `runAiBuild` per page. The person's
  worker count ("1, 3 or 6 writers") is a promise about the MACHINE — how many model
  calls run at once — so it must hold across every page of the site, not per page: four
  pages at three writers each would be twelve calls in flight. A shared pool is that
  promise kept. Each section write holds one permit for as long as it runs (its attempts,
  its check and its repair), on top of the page's own `fillConcurrency` cap; a build
  without a pool runs exactly as it always did.

  `fillConcurrencyFor` and its ceiling moved here from run-build.ts with the pool: both
  answer "how many writers", and run-build.ts re-exports them unchanged.
*/

/**
 * Automatic builds run one writer per section that needs one, up to this many
 * (2026-10-05, DESIGN D7): never the task count without a ceiling.
 */
export const MAX_AI_BUILD_AUTO_FILL_CONCURRENCY = 8;

/**
 * Sections written at once.
 *
 * Automatic: one writer per section, capped at eight. It was three growing by
 * one per further group of three, capped at six — and measured live
 * (baseline 2026-09-30) six writers in a pool of four cost ≈ 7 s of a 65 s
 * page, while a streamed plan already staggers the writers' starts by about
 * a second each, so the machine never sees them all start at once. A
 * caller-provided number stays exact, including `1` for strictly sequential
 * work.
 */
export function fillConcurrencyFor(taskCount: number, requested: number | undefined): number {
  if (requested !== undefined) return Math.min(taskCount, Math.max(1, requested));
  return Math.min(taskCount, MAX_AI_BUILD_AUTO_FILL_CONCURRENCY);
}

/** One writer's right to run. Releasing twice is releasing once. */
export interface AiWriterPermit {
  release(): void;
}

/**
 * At most `limit` writers at once, across every build that shares the pool. Waiters are
 * admitted first come, first served; a waiter whose signal aborts leaves the line and is
 * never admitted.
 */
export interface AiWriterPool {
  /** How many may write at once now: `ceiling`, or less while the provider is congested. */
  readonly limit: number;
  /** The limit it was made with (the person's worker count): it never admits more. */
  readonly ceiling: number;
  /** Permits held right now. */
  readonly active: number;
  /** Writers waiting for a permit. */
  readonly waiting: number;
  /**
   * A permit, at once when one is free and nobody waits, else in turn. Rejects with an
   * `AbortError` when `signal` aborts first, and the waiter is gone from the line.
   */
  acquire(signal?: AbortSignal): Promise<AiWriterPermit>;
  /**
   * The provider said "too many at once" (a rate limit or an overload): halve the limit, never
   * below one. Reports that arrive together (every writer hits the same limit) count once.
   */
  congested(): void;
  /** A call came back: after `limit` of them in a row, one more may write, up to `ceiling`. */
  succeeded(): void;
}

/** The writer options of `RunAiBuildOptions`: how many write at once, and whose pool they share. */
export interface AiBuildWriterOptions {
  /**
   * How many sections are WRITTEN at once. When omitted, automatic mode runs one writer per section
   * that needs one, capped at 8 (`MAX_AI_BUILD_AUTO_FILL_CONCURRENCY`, 2026-10-05: six writers in a
   * pool of four cost ≈ 7 s live, and a streamed plan staggers their starts anyway). Pass `1` to
   * restore strictly sequential work.
   *
   * Only the writing overlaps, and it is bounded by this number alone: a slow
   * section never holds back the writers behind it. Sections still LAND one
   * after another in page order, so the transaction log reads top to bottom.
   */
  fillConcurrency?: number;
  /**
   * A pool shared with other builds (`createAiWriterPool`, T230): each section write holds
   * one permit while it runs, so builds that share it never run more writers between them
   * than its `limit`. `fillConcurrency` still caps this build alone. Absent, nothing waits.
   */
  writerPool?: AiWriterPool | undefined;
}

function abortError(): Error {
  const error = new Error('The writer stopped waiting for its turn.');
  error.name = 'AbortError';
  return error;
}

interface Waiter {
  readonly admit: () => void;
}

/** A first-come, first-served pool of `limit` writer permits (a positive whole number). */
/**
 * Smarter live workers (2026-10-12): the pool is the one place every writer of a build (or a
 * site) passes, so it is where a rate limit is answered. Each writer's provider retries its own
 * call with jittered backoff, but six writers that all hit the same limit retry into it six
 * times over. The pool answers as congestion control does: halve the writers at once on
 * "too many" (one halving per burst), then add one back per `limit` calls that come back, up
 * to the person's number. A build that is never refused runs at its ceiling throughout.
 */
const CONGESTION_WINDOW_MS = 2_000;

export interface AiWriterPoolOptions {
  /** The clock bursts of congestion are grouped by (tests pin it). */
  readonly now?: () => number;
}

export function createAiWriterPool(
  ceiling: number,
  options: AiWriterPoolOptions = {},
): AiWriterPool {
  if (!Number.isSafeInteger(ceiling) || ceiling < 1) {
    throw new RangeError('A writers pool needs a whole limit of at least 1.');
  }
  const now = options.now ?? Date.now;
  let limit = ceiling;
  let active = 0;
  let streak = 0;
  let halvedAt = Number.NEGATIVE_INFINITY;
  const line: Waiter[] = [];

  const admitNext = (): void => {
    while (active < limit) {
      const waiter = line.shift();
      if (waiter === undefined) return;
      waiter.admit();
    }
  };

  // Counted the moment it is granted, so `admitNext` can never admit past the limit.
  const grant = (): AiWriterPermit => {
    active += 1;
    let released = false;
    return {
      release() {
        if (released) return;
        released = true;
        active -= 1;
        admitNext();
      },
    };
  };

  return {
    get limit() {
      return limit;
    },
    ceiling,
    get active() {
      return active;
    },
    get waiting() {
      return line.length;
    },
    acquire(signal?: AbortSignal): Promise<AiWriterPermit> {
      if (signal?.aborted === true) return Promise.reject(abortError());
      if (active < limit && line.length === 0) return Promise.resolve(grant());
      return new Promise<AiWriterPermit>((resolve, reject) => {
        const leave = (): void => {
          const at = line.indexOf(waiter);
          if (at !== -1) line.splice(at, 1);
          reject(abortError());
        };
        const waiter: Waiter = {
          admit: () => {
            signal?.removeEventListener('abort', leave);
            resolve(grant());
          },
        };
        signal?.addEventListener('abort', leave, { once: true });
        line.push(waiter);
      });
    },
    congested() {
      streak = 0;
      if (now() - halvedAt < CONGESTION_WINDOW_MS) return;
      halvedAt = now();
      limit = Math.max(1, Math.floor(limit / 2));
    },
    succeeded() {
      if (limit >= ceiling) return;
      streak += 1;
      if (streak < limit) return;
      streak = 0;
      limit += 1;
      admitNext();
    },
  };
}

/** One signal that aborts when either does, and the listeners to take back after. */
function eitherSignal(
  first: AbortSignal,
  second: AbortSignal | undefined,
): { readonly signal: AbortSignal; readonly dispose: () => void } {
  if (second === undefined) return { signal: first, dispose: () => undefined };
  const both = new AbortController();
  const abort = (): void => {
    both.abort();
  };
  if (first.aborted || second.aborted) abort();
  first.addEventListener('abort', abort, { once: true });
  second.addEventListener('abort', abort, { once: true });
  return {
    signal: both.signal,
    dispose: () => {
      first.removeEventListener('abort', abort);
      second.removeEventListener('abort', abort);
    },
  };
}

async function permitted<T>(
  pool: AiWriterPool,
  waits: { readonly signal: AbortSignal; readonly dispose: () => void },
  work: () => Promise<T>,
): Promise<T | undefined> {
  let permit: AiWriterPermit;
  try {
    permit = await pool.acquire(waits.signal);
  } catch {
    return undefined;
  } finally {
    waits.dispose();
  }
  try {
    return await work();
  } finally {
    permit.release();
  }
}

/**
 * One section write, holding a permit of the build's shared pool when it has one
 * (`writerPool`). Without a pool `work` starts at once, exactly as before. A write whose
 * section (`signal`) or build (`options.signal`) stops while it waits in line never
 * starts: it answers `undefined`, which the fill reads as a write thrown away.
 */
export function withWriterPermit<T>(
  options: {
    readonly writerPool?: AiWriterPool | undefined;
    readonly signal?: AbortSignal | undefined;
  },
  signal: AbortSignal,
  work: () => Promise<T>,
): Promise<T | undefined> {
  const pool = options.writerPool;
  if (pool === undefined) return work();
  return permitted(pool, eitherSignal(signal, options.signal), work);
}
