/**
 * Node script runner: one warm `worker_threads` worker running QuickJS
 * (DESIGN §A.2, §A.13). Shipped on the subpath `@craftkit/builder-ai/script-node`
 * so browser bundles never see `node:worker_threads`.
 *
 * Same semantics as the browser runner:
 * - the worker says `{ready}` once the wasm is loaded; the hard wall clock
 *   (`limits.hardMs`) starts when the request is posted;
 * - runs are serialized through a queue;
 * - at `hardMs` the worker is terminated, the run returns E_TIMEOUT_HARD and the
 *   next run respawns lazily.
 * `resourceLimits` is a second memory fence around QuickJS's own 16 MB limit;
 * a worker killed by it returns E_MEMORY.
 *
 * Bundling hosts (the mcp-server's vite SSR build) emit `sandbox-worker.node.mjs`
 * as their own entry and pass its URL as `workerUrl`.
 */

import { Worker, type ResourceLimits } from 'node:worker_threads';

import { finalizeScriptRun, rawScriptFailure, type RawScriptRunResult } from './errors';
import { resolveScriptLimits } from './limits';
import type { ScriptRunRequest, ScriptRunResult, ScriptRunner } from './types';

export interface NodeScriptRunnerOptions {
  /** The worker entry. Default: `./sandbox-worker.node.mjs` next to this file. */
  readonly workerUrl?: URL | string;
  /** Default `{maxOldGenerationSizeMb: 64, stackSizeMb: 4}`. */
  readonly resourceLimits?: ResourceLimits;
  /** How long a cold worker may take to load the wasm before the run fails with E_ENGINE. */
  readonly startupMs?: number;
  /** Node flags for the worker. Default `[]`: the worker is plain JS and needs no loader. */
  readonly execArgv?: readonly string[];
}

export const DEFAULT_WORKER_RESOURCE_LIMITS: ResourceLimits = Object.freeze({
  maxOldGenerationSizeMb: 64,
  stackSizeMb: 4,
});

const DEFAULT_STARTUP_MS = 20_000;

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isReady(data: unknown): data is { readonly ready: boolean; readonly error?: string } {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as { ready?: unknown }).ready === 'boolean'
  );
}

function isResult(
  data: unknown,
): data is { readonly id: number; readonly result: RawScriptRunResult } {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as { id?: unknown }).id === 'number' &&
    typeof (data as { result?: unknown }).result === 'object'
  );
}

interface Pending {
  readonly id: number;
  readonly settle: (raw: RawScriptRunResult) => void;
}

/** One warm sandbox worker thread with a hard wall clock, a run queue and lazy respawn. */
export function createNodeScriptRunner(options: NodeScriptRunnerOptions = {}): ScriptRunner {
  const workerUrl = options.workerUrl ?? new URL('./sandbox-worker.node.mjs', import.meta.url);
  const resourceLimits = options.resourceLimits ?? DEFAULT_WORKER_RESOURCE_LIMITS;
  const startupMs = options.startupMs ?? DEFAULT_STARTUP_MS;
  const execArgv = [...(options.execArgv ?? [])];
  let worker: Worker | undefined;
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
    if (current !== undefined) void current.terminate().catch(() => undefined);
  }

  function settlePending(raw: RawScriptRunResult): void {
    const current = pending;
    pending = undefined;
    current?.settle(raw);
  }

  function spawn(): Promise<string | undefined> {
    let created: Worker;
    try {
      created = new Worker(workerUrl, { resourceLimits, execArgv });
    } catch (error) {
      return Promise.resolve(messageOf(error));
    }
    // An idle warm worker must not keep a CLI process alive; a run's timer does.
    created.unref();
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
      created.on('message', (data: unknown) => {
        if (worker !== created) return;
        if (isReady(data)) {
          finishStart(data.ready ? undefined : (data.error ?? 'the QuickJS module failed to load'));
          return;
        }
        if (isResult(data) && pending?.id === data.id) settlePending(data.result);
      });
      created.on('error', (error: Error & { code?: string }) => {
        if (worker !== created) return;
        const outOfMemory = error.code === 'ERR_WORKER_OUT_OF_MEMORY';
        finishStart(messageOf(error));
        kill();
        settlePending(
          outOfMemory
            ? rawScriptFailure('E_MEMORY', {})
            : rawScriptFailure('E_ENGINE', { message: messageOf(error) }),
        );
      });
      created.on('exit', (exitCode: number) => {
        if (worker !== created) return;
        const reason = `the sandbox worker exited (code ${String(exitCode)})`;
        finishStart(reason);
        worker = undefined;
        ready = undefined;
        settlePending(rawScriptFailure('E_ENGINE', { message: reason }));
      });
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
