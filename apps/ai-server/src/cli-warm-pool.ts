/**
 * Warm `claude -p` spares (DESIGN §7, 2026-10-05).
 *
 * Every CLI call pays the process start-up before the model sees a token:
 * 1.9-3.0 s per call when measured, 4-10 s under load. A build's section
 * writers make several calls of the SAME shape (model, effort, thinking,
 * system prompt), so after one starts the client keeps one pre-spawned child
 * of that shape waiting on its stdin; the next call of the shape writes its
 * prompt to the spare instead of starting a process. Measured 2026-10-05 on
 * cli:haiku: first text 1.4-1.7 s after stdin for a warm spare against
 * 2.3-3.5 s cold.
 *
 * The pool knows nothing about how a spare is spawned or driven — that is
 * `cli-client.ts`'s. It only keeps the live spares a key was primed for
 * (`want`, at most `maxPerShape`), at most `maxSpares` in all, each for at
 * most `idleTtlMs`, and kills every one it still
 * holds when the server stops. A spare that exited on its own is discarded,
 * never handed out.
 */

/** The part of a child process the pool touches. */
export interface ChildProcessLike {
  readonly pid?: number | undefined;
  /** Node's own: `null` while running. Absent on fakes; the `close` event covers them. */
  readonly exitCode?: number | null;
  readonly on: {
    (event: 'error', listener: (error: Error) => void): unknown;
    (event: 'close', listener: (code: number | null, signal: string | null) => void): unknown;
  };
  readonly kill: (signal?: string) => unknown;
}

/** The system prompt file a spare reads, removed with the spare. */
export interface WarmSystemPromptFile {
  readonly path: string;
  readonly remove: () => void;
}

export interface WarmCliProcess {
  readonly child: ChildProcessLike;
  readonly systemFile?: WarmSystemPromptFile;
  readonly spawnedAt: number;
}

export interface CliWarmPool {
  /**
   * The OLDEST live spare for this shape (the furthest through its start-up),
   * or none. The caller owns it (and its system file) from here.
   */
  take(key: string): WarmCliProcess | undefined;
  /**
   * Keep `want` spares for key (default 1, at most `maxPerShape`): spawns the
   * missing ones while the pool has room; a no-op when enough are held, the
   * pool is full, or it is disposed.
   */
  prime(key: string, spawn: () => WarmCliProcess, want?: number): void;
  /** Kill every spare and remove their files. Later `prime` calls do nothing. */
  dispose(): void;
}

export interface CliWarmPoolOptions {
  /** At most this many spares in all. Default 8 (a build's writer pool). */
  readonly maxSpares?: number;
  /** At most this many spares of one shape. Default 8. */
  readonly maxPerShape?: number;
  /** A spare older than this is killed. Default 60 s. */
  readonly idleTtlMs?: number;
  /** Injected for tests. */
  readonly now?: () => number;
}

/*
  Fix pass 2026-10-05: one spare per shape, three in all, could not cover a
  build's writer wave — six writers start within a few seconds, the first
  takes the one spare and the rest start cold (or take a spare primed a
  moment before, still in its start-up: "warm" writers took 4.0-4.4 s to
  their first event, sequential ones 1.3-1.8 s). The pool now keeps as many
  spares of a shape as calls of it are running (cli-client.ts asks), up to a
  writer pool's eight.
*/
export const CLI_WARM_MAX_SPARES = 8;
export const CLI_WARM_MAX_PER_SHAPE = 8;
export const CLI_WARM_IDLE_TTL_MS = 60_000;

interface Held {
  readonly key: string;
  readonly spare: WarmCliProcess;
  timer: ReturnType<typeof setTimeout> | undefined;
  exited: boolean;
}

/** Kills a spare's whole process group (spawned detached), or the child itself. */
function stop(child: ChildProcessLike): void {
  if (process.platform !== 'win32' && child.pid !== undefined) {
    try {
      process.kill(-child.pid, 'SIGTERM');
      return;
    } catch {
      // The group may already be gone; fall through to the direct child.
    }
  }
  try {
    child.kill('SIGTERM');
  } catch {
    // Already gone.
  }
}

function removeFile(spare: WarmCliProcess): void {
  try {
    spare.systemFile?.remove();
  } catch {
    // A file already gone is the state wanted.
  }
}

export function createCliWarmPool(options: CliWarmPoolOptions = {}): CliWarmPool {
  const maxSpares = options.maxSpares ?? CLI_WARM_MAX_SPARES;
  const maxPerShape = options.maxPerShape ?? CLI_WARM_MAX_PER_SHAPE;
  const idleTtlMs = options.idleTtlMs ?? CLI_WARM_IDLE_TTL_MS;
  const now = options.now ?? Date.now;
  /** Per key, oldest first. */
  const held = new Map<string, Held[]>();
  let disposed = false;
  const total = (): number => [...held.values()].reduce((sum, list) => sum + list.length, 0);

  /** Forget this spare, killing it and removing its file; a no-op once it left the pool. */
  const discard = (entry: Held): void => {
    const list = held.get(entry.key);
    const at = list?.indexOf(entry) ?? -1;
    if (list === undefined || at === -1) return;
    list.splice(at, 1);
    if (list.length === 0) held.delete(entry.key);
    clearTimeout(entry.timer);
    if (!entry.exited) stop(entry.spare.child);
    removeFile(entry.spare);
  };

  const live = (entry: Held): boolean => {
    const exitCode = entry.spare.child.exitCode;
    if (exitCode !== undefined && exitCode !== null) entry.exited = true;
    return !entry.exited && now() - entry.spare.spawnedAt < idleTtlMs;
  };

  /** Drop every spare of key that is no longer usable. */
  const prune = (key: string): void => {
    for (const entry of [...(held.get(key) ?? [])]) if (!live(entry)) discard(entry);
  };

  return {
    take(key) {
      prune(key);
      const list = held.get(key);
      const entry = list?.[0];
      if (list === undefined || entry === undefined) return undefined;
      list.shift();
      if (list.length === 0) held.delete(key);
      clearTimeout(entry.timer);
      return entry.spare;
    },

    prime(key, spawn, want = 1) {
      if (disposed) return;
      prune(key);
      const wanted = Math.max(1, Math.min(maxPerShape, Math.floor(want)));
      while ((held.get(key)?.length ?? 0) < wanted && total() < maxSpares) {
        let spare: WarmCliProcess;
        try {
          spare = spawn();
        } catch {
          // No spare is no loss: the next call of this shape starts cold, as before.
          return;
        }
        const entry: Held = { key, spare, timer: undefined, exited: false };
        entry.timer = setTimeout(() => {
          discard(entry);
        }, idleTtlMs);
        // A spare must never be what keeps the server's event loop alive.
        (entry.timer as { unref?: () => void }).unref?.();
        const list = held.get(key) ?? [];
        list.push(entry);
        held.set(key, list);
        const gone = (): void => {
          entry.exited = true;
          // Only while the pool still holds it; a spare already taken is its caller's.
          discard(entry);
        };
        spare.child.on('close', gone);
        spare.child.on('error', gone);
      }
    },

    dispose() {
      disposed = true;
      for (const list of [...held.values()]) for (const entry of [...list]) discard(entry);
    },
  };
}
