/**
 * Browser script runner: one warm module Worker running QuickJS
 * (DESIGN §A.2, §A.2.2, §A.13).
 *
 * - The worker loads the wasm once and says `{ready}`; the hard wall clock
 *   (`limits.hardMs`) starts only when the request is posted, so a cold start
 *   never counts against the script (a separate `startupMs` bounds the load).
 * - Runs are serialized: one request in flight per worker.
 * - At `hardMs` the worker is `terminate()`d, the run returns E_TIMEOUT_HARD,
 *   and the next run respawns lazily. A worker or wasm failure is E_ENGINE.
 *
 * The worker URL is the Vite pattern proven by code-view
 * (`packages/builder/extensions/code-view/src/index.ts`), so the build emits
 * the worker as its own chunk. This file never imports `node:*`.
 */

import { finalizeScriptRun, rawScriptFailure, type RawScriptRunResult } from './errors';
import { resolveScriptLimits } from './limits';
import type { ScriptRunRequest, ScriptRunResult, ScriptRunner } from './types';

/** What the runner needs from a Worker (a real `Worker` satisfies it; tests pass a fake). */
export interface ScriptWorkerEvent {
  readonly data?: unknown;
  readonly message?: string;
}

export interface ScriptWorkerLike {
  postMessage(message: unknown): void;
  terminate(): void;
  addEventListener(
    type: 'message' | 'error' | 'messageerror',
    listener: (event: ScriptWorkerEvent) => void,
  ): void;
}

export interface BrowserScriptRunnerOptions {
  /** Create the worker (tests pass a fake). Default: the bundled module worker. */
  readonly createWorker?: () => ScriptWorkerLike;
  /** How long a cold worker may take to load the wasm before the run fails with E_ENGINE. */
  readonly startupMs?: number;
}

const DEFAULT_STARTUP_MS = 20_000;

// The global constructor at runtime; declared locally because this headless
// package compiles without the DOM lib.
declare const Worker: new (
  url: URL,
  options: { readonly type: 'module'; readonly name?: string },
) => ScriptWorkerLike;

function createModuleWorker(): ScriptWorkerLike {
  return new Worker(new URL('./sandbox-worker.browser.ts', import.meta.url), {
    type: 'module',
    name: 'craftkit-script',
  });
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface ReadyMessage {
  readonly ready: boolean;
  readonly error?: string;
}

interface ResultMessage {
  readonly id: number;
  readonly result: RawScriptRunResult;
}

function isReady(data: unknown): data is ReadyMessage {
  return (
    typeof data === 'object' && data !== null && typeof (data as ReadyMessage).ready === 'boolean'
  );
}

function isResult(data: unknown): data is ResultMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as ResultMessage).id === 'number' &&
    typeof (data as ResultMessage).result === 'object'
  );
}

interface Pending {
  readonly id: number;
  readonly settle: (raw: RawScriptRunResult) => void;
}

/** One warm sandbox worker with a hard wall clock, a run queue and lazy respawn. */
export function createBrowserScriptRunner(options: BrowserScriptRunnerOptions = {}): ScriptRunner {
  const createWorker = options.createWorker ?? createModuleWorker;
  const startupMs = options.startupMs ?? DEFAULT_STARTUP_MS;
  let worker: ScriptWorkerLike | undefined;
  let ready: Promise<string | undefined> | undefined;
  let pending: Pending | undefined;
  let sequence = 0;
  let chain: Promise<unknown> = Promise.resolve();
  let disposed = false;
  const isDisposed = (): boolean => disposed;

  function kill(): void {
    const current = worker;
    worker = undefined;
    ready = undefined;
    try {
      current?.terminate();
    } catch {
      // already gone
    }
  }

  function settlePending(raw: RawScriptRunResult): void {
    const current = pending;
    pending = undefined;
    current?.settle(raw);
  }

  /** Spawn a worker; resolves undefined when it is ready, or the reason it never was. */
  function spawn(): Promise<string | undefined> {
    let created: ScriptWorkerLike;
    try {
      created = createWorker();
    } catch (error) {
      return Promise.resolve(messageOf(error));
    }
    worker = created;
    return new Promise((resolve) => {
      let started = false;
      const finishStart = (reason: string | undefined): void => {
        if (started) return;
        started = true;
        clearTimeout(timer);
        resolve(reason);
      };
      const timer = setTimeout(() => {
        finishStart(`the sandbox worker did not start within ${String(startupMs)} ms`);
      }, startupMs);
      created.addEventListener('message', (event) => {
        if (worker !== created) return;
        const data = event.data;
        if (isReady(data)) {
          finishStart(data.ready ? undefined : (data.error ?? 'the QuickJS module failed to load'));
          return;
        }
        if (isResult(data) && pending?.id === data.id) settlePending(data.result);
      });
      const crash = (event: ScriptWorkerEvent): void => {
        if (worker !== created) return;
        const reason = event.message ?? 'the sandbox worker crashed';
        finishStart(reason);
        kill();
        settlePending(rawScriptFailure('E_ENGINE', { message: reason }));
      };
      created.addEventListener('error', crash);
      created.addEventListener('messageerror', crash);
    });
  }

  async function execute(request: ScriptRunRequest): Promise<ScriptRunResult> {
    const limits = resolveScriptLimits(request.limits);
    const full: ScriptRunRequest = { ...request, limits };
    if (disposed) {
      return finalizeScriptRun(
        rawScriptFailure('E_ENGINE', { message: 'the script runner was disposed' }),
        limits,
      );
    }
    if (request.code.length > limits.maxSourceChars) {
      return finalizeScriptRun(
        rawScriptFailure('E_TOO_LONG', { chars: request.code.length }),
        limits,
      );
    }
    ready ??= spawn();
    const startError = await ready;
    const current = worker;
    // dispose() may have run while this run waited for the worker.
    if (startError !== undefined || current === undefined || isDisposed()) {
      kill();
      const message = startError ?? 'the script runner was disposed';
      return finalizeScriptRun(rawScriptFailure('E_ENGINE', { message }), limits);
    }
    sequence += 1;
    const id = sequence;
    const raw = await new Promise<RawScriptRunResult>((resolve) => {
      const timer = setTimeout(() => {
        if (pending?.id !== id) return;
        pending = undefined;
        kill();
        resolve(rawScriptFailure('E_TIMEOUT_HARD', {}, { ms: limits.hardMs, calls: 0, found: 0 }));
      }, limits.hardMs);
      pending = {
        id,
        settle: (result) => {
          clearTimeout(timer);
          resolve(result);
        },
      };
      try {
        current.postMessage({ id, request: full });
      } catch (error) {
        settlePending(rawScriptFailure('E_ENGINE', { message: messageOf(error) }));
      }
    });
    return finalizeScriptRun(raw, limits);
  }

  return {
    run(request) {
      const job = chain.then(() => execute(request));
      chain = job.catch(() => undefined);
      return job;
    },
    dispose() {
      disposed = true;
      settlePending(rawScriptFailure('E_ENGINE', { message: 'the script runner was disposed' }));
      kill();
    },
  };
}
