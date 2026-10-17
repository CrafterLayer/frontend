import { fork, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import type {
  CompiledPageArtifact,
  ExportPage,
  PrerenderResult,
  RuntimeSnapshot,
  SourceElement,
} from '@craftkit/builder/code-runtime';

export const DEFAULT_COMPILE_TIMEOUT_MS = 15_000;
export const DEFAULT_PRERENDER_TIMEOUT_MS = 10_000;
export const DEFAULT_WORKER_OUTPUT_BYTES = 12_000_000;

export type RuntimeWorkerPayload =
  | { readonly kind: 'compile'; readonly snapshot: RuntimeSnapshot }
  | {
      readonly kind: 'prerender';
      readonly page: ExportPage;
      readonly artifact: CompiledPageArtifact;
    };

export type RuntimeWorkerResult =
  | {
      readonly kind: 'compile';
      readonly artifact: CompiledPageArtifact;
      readonly sourceElements: readonly SourceElement[];
      readonly cacheHit: boolean;
    }
  | { readonly kind: 'prerender'; readonly result: PrerenderResult };

export type RuntimeWorkerMessage =
  | { readonly type: 'result'; readonly taskId: string; readonly result: RuntimeWorkerResult }
  | { readonly type: 'error'; readonly taskId: string; readonly message: string };

export interface RuntimeWorkerPort {
  send(message: unknown): void;
  onMessage(listener: (message: unknown) => void): void;
  onError(listener: (error: Error) => void): void;
  onExit(listener: (code: number | null, signal: NodeJS.Signals | null) => void): void;
  terminate(): void;
  dispose(): void;
}

export interface RuntimeWorkerSupervisorOptions {
  readonly spawn: () => RuntimeWorkerPort;
  readonly compileTimeoutMs?: number;
  readonly prerenderTimeoutMs?: number;
  readonly maxOutputBytes?: number;
  readonly nowId?: () => string;
}

export interface RuntimeWorkerSupervisor {
  run(payload: RuntimeWorkerPayload, signal?: AbortSignal): Promise<RuntimeWorkerResult>;
}

function byteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function abortError(reason: unknown): DOMException {
  return new DOMException(
    reason instanceof Error ? reason.message : 'The runtime task was cancelled.',
    'AbortError',
  );
}

function isRuntimeMessage(value: unknown, taskId: string): value is RuntimeWorkerMessage {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    record['taskId'] === taskId &&
    (record['type'] === 'result' ||
      (record['type'] === 'error' && typeof record['message'] === 'string'))
  );
}

/** Supervises one disposable process per task so a timeout cannot poison the next build. */
export function createRuntimeWorkerSupervisor(
  options: RuntimeWorkerSupervisorOptions,
): RuntimeWorkerSupervisor {
  const compileTimeoutMs = options.compileTimeoutMs ?? DEFAULT_COMPILE_TIMEOUT_MS;
  const prerenderTimeoutMs = options.prerenderTimeoutMs ?? DEFAULT_PRERENDER_TIMEOUT_MS;
  const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_WORKER_OUTPUT_BYTES;
  const nowId = options.nowId ?? (() => crypto.randomUUID());
  for (const [name, value] of [
    ['compileTimeoutMs', compileTimeoutMs],
    ['prerenderTimeoutMs', prerenderTimeoutMs],
    ['maxOutputBytes', maxOutputBytes],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be positive.`);
  }

  return {
    run: (payload, signal) =>
      new Promise<RuntimeWorkerResult>((resolve, reject) => {
        signal?.throwIfAborted();
        const worker = options.spawn();
        const taskId = nowId();
        const timeoutMs = payload.kind === 'compile' ? compileTimeoutMs : prerenderTimeoutMs;
        let settled = false;

        const finish = (action: () => void): void => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          signal?.removeEventListener('abort', onAbort);
          worker.dispose();
          action();
        };
        const onAbort = (): void => {
          worker.send({ type: 'cancel', taskId });
          worker.terminate();
          finish(() => {
            reject(abortError(signal?.reason));
          });
        };
        const timer = setTimeout(() => {
          worker.send({ type: 'cancel', taskId });
          worker.terminate();
          finish(() => {
            reject(new Error(`Runtime ${payload.kind} exceeded ${String(timeoutMs)}ms.`));
          });
        }, timeoutMs);

        worker.onMessage((message) => {
          if (settled || !isRuntimeMessage(message, taskId)) return;
          if (byteLength(message) > maxOutputBytes) {
            worker.terminate();
            finish(() => {
              reject(new Error('Runtime worker output exceeded its limit.'));
            });
            return;
          }
          if (message.type === 'error') {
            finish(() => {
              reject(new Error(message.message));
            });
            return;
          }
          finish(() => {
            resolve(message.result);
          });
        });
        worker.onError((error) => {
          finish(() => {
            reject(error);
          });
        });
        worker.onExit((code, exitSignal) => {
          finish(() => {
            reject(
              new Error(
                `Runtime worker exited before answering (${String(code ?? exitSignal ?? 'unknown')}).`,
              ),
            );
          });
        });
        signal?.addEventListener('abort', onAbort, { once: true });
        worker.send({ type: 'run', taskId, payload });
      }),
  };
}

function processPort(child: ChildProcess): RuntimeWorkerPort {
  const messageListeners: ((message: unknown) => void)[] = [];
  const errorListeners: ((error: Error) => void)[] = [];
  const exitListeners: ((code: number | null, signal: NodeJS.Signals | null) => void)[] = [];
  child.on('message', (message) => {
    for (const listener of messageListeners) listener(message);
  });
  child.on('error', (error) => {
    for (const listener of errorListeners) listener(error);
  });
  child.on('exit', (code, signal) => {
    for (const listener of exitListeners) listener(code, signal);
  });
  return {
    send: (message) => {
      if (child.connected) child.send(message as object);
    },
    onMessage: (listener) => {
      messageListeners.push(listener);
    },
    onError: (listener) => {
      errorListeners.push(listener);
    },
    onExit: (listener) => {
      exitListeners.push(listener);
    },
    terminate: () => {
      if (!child.killed && child.pid !== undefined && process.platform !== 'win32') {
        try {
          // The worker owns browser descendants; terminating its process group
          // prevents a wedged renderer from surviving cancellation or timeout.
          process.kill(-child.pid, 'SIGTERM');
        } catch {
          // It may already have exited between the state check and the signal.
        }
      }
      if (!child.killed) child.kill('SIGTERM');
    },
    dispose: () => {
      child.removeAllListeners();
      if (child.connected) child.disconnect();
    },
  };
}

export function spawnRuntimeWorker(): RuntimeWorkerPort {
  const entry = fileURLToPath(new URL('./runtime-worker-entry.js', import.meta.url));
  return processPort(
    fork(entry, [], {
      detached: process.platform !== 'win32',
      execArgv: ['--max-old-space-size=256'],
      serialization: 'advanced',
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    }),
  );
}

export function createProcessRuntimeSupervisor(
  options: Omit<RuntimeWorkerSupervisorOptions, 'spawn'> = {},
): RuntimeWorkerSupervisor {
  return createRuntimeWorkerSupervisor({ ...options, spawn: spawnRuntimeWorker });
}
