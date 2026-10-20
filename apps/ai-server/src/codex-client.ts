import { spawn } from 'node:child_process';

import type Anthropic from '@anthropic-ai/sdk';

import type { CliChildProcess } from './cli-client';
import {
  CODEX_DEFAULT_TIMEOUT_MS,
  CODEX_DEFAULT_MODEL,
  CODEX_MAX_CONCURRENT,
  CodexBackendError,
  codexArgs,
  codexEffort,
  codexSubscriptionEnv,
  type CodexEffort,
  type SpawnCodex,
} from './codex-config';
import { prepareCodexFiles, type CodexFiles, type CodexParams } from './codex-prompt';
import { codexAbortError, killCodexChild, runCodex } from './codex-process';
import { CRAFTKIT_REASONING_EFFORT_HEADER } from './openrouter-client';

export interface CodexClientOptions {
  readonly model?: string;
  readonly allowedModels?: readonly string[];
  readonly effort?: CodexEffort;
  readonly timeoutMs?: number;
  readonly spawnCli?: SpawnCodex;
}

export type CodexClient = Anthropic & { readonly dispose: () => void };

const spawnReal: SpawnCodex = (command, args, options) =>
  spawn(command, [...args], {
    ...options,
    detached: process.platform !== 'win32',
    stdio: ['pipe', 'pipe', 'pipe'],
  }) as unknown as CliChildProcess;

/** The same stream seam as other providers; Codex owns login, CraftKit still validates output. */
export function createCodexClient(options: CodexClientOptions = {}): CodexClient {
  const active = new Map<AbortController, { files: CodexFiles; child?: CliChildProcess }>();
  let disposed = false;
  const stream = (
    params: CodexParams,
    request: {
      readonly signal?: AbortSignal;
      readonly headers?: Readonly<Record<string, string>>;
    } = {},
  ) => {
    const listeners = new Map<string, (text: string) => void>();
    const emit = (event: string, text: string): void => {
      try {
        listeners.get(event)?.(text);
      } catch {
        /* Advisory status only. */
      }
    };
    // Start on a microtask so callers can attach listeners before a fast child answers.
    const done = Promise.resolve().then(async () => {
      if (request.signal?.aborted === true || disposed) throw codexAbortError();
      if (active.size >= CODEX_MAX_CONCURRENT)
        throw new CodexBackendError(
          'The Codex server has six active requests. Retry when one finishes.',
          429,
        );
      const requested =
        params.model === 'codex:' ? CODEX_DEFAULT_MODEL : params.model?.replace(/^codex:/u, '');
      const model =
        requested !== undefined &&
        (requested === options.model || options.allowedModels?.includes(requested) === true)
          ? requested
          : options.model;
      const effort =
        codexEffort(
          request.headers?.[CRAFTKIT_REASONING_EFFORT_HEADER] ?? params.output_config?.effort,
        ) ??
        options.effort ??
        (params.thinking?.type === 'disabled' ? 'low' : undefined);
      const files = prepareCodexFiles(params);
      const controller = new AbortController();
      const abort = (): void => {
        controller.abort();
      };
      const run: { files: CodexFiles; child?: CliChildProcess } = { files };
      active.set(controller, run);
      request.signal?.addEventListener('abort', abort, { once: true });
      try {
        const child = (options.spawnCli ?? spawnReal)(
          'codex',
          codexArgs({ ...files, model, effort }),
          { cwd: files.directory, env: codexSubscriptionEnv() },
        );
        run.child = child;
        // A rejected request may still own a terminating OS process. Keep its slot and
        // shutdown ownership until `close`, including the SIGTERM-to-SIGKILL grace period.
        child.on('close', () => {
          active.delete(controller);
        });
        return await runCodex({
          child,
          files,
          signal: controller.signal,
          timeoutMs: options.timeoutMs ?? CODEX_DEFAULT_TIMEOUT_MS,
          emit,
        });
      } catch (cause) {
        if (
          cause instanceof Error &&
          (cause.name === 'AbortError' || cause instanceof CodexBackendError)
        )
          throw cause;
        throw new CodexBackendError(
          'Could not launch Codex. Check its installation and ChatGPT login.',
          503,
          false,
        );
      } finally {
        request.signal?.removeEventListener('abort', abort);
        if (run.child === undefined) active.delete(controller);
        files.remove();
      }
    });
    void done.catch(() => undefined);
    return {
      on: (event: string, listener: (text: string) => void) => {
        listeners.set(event, listener);
      },
      finalMessage: () => done,
    };
  };
  return {
    messages: { stream },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const [controller, run] of active) {
        controller.abort();
        // Dispose also runs in Node's synchronous exit handler: no timers/microtasks remain.
        if (run.child !== undefined) killCodexChild(run.child, 'SIGKILL');
        run.files.remove();
      }
    },
  } as unknown as CodexClient;
}
