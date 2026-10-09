/**
 * The runner a host gets when it does not pass one (DESIGN §A.2, §A.13).
 *
 * - In a page (`Worker` and `window` exist): the browser Worker runner.
 * - Anywhere else (vitest, SSR): the inline runner. Node hosts that run
 *   untrusted plans pass `createNodeScriptRunner()` from
 *   `@craftkit/builder-ai/script-node` instead.
 *
 * Both runners are reached through dynamic `import()`, so a plan without a
 * `script.run` step never loads the engine. A failure to load either resolves
 * to a runner that answers every run with E_ENGINE, so the model is told to
 * write plain steps instead of the plan failing outright. Memoized.
 */

import { finalizeScriptRun, rawScriptFailure } from './errors';
import { resolveScriptLimits } from './limits';
import type { ScriptRunner } from './types';

let memo: Promise<ScriptRunner> | undefined;

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** True in a page that can start a module Worker (not in Node, not in a worker). */
export function canUseBrowserWorker(): boolean {
  const scope = globalThis as { readonly Worker?: unknown };
  return typeof scope.Worker === 'function' && 'window' in globalThis;
}

/** A runner that answers every run with E_ENGINE (the engine could not load). */
export function createUnavailableScriptRunner(reason: string): ScriptRunner {
  return {
    run: (request) =>
      Promise.resolve(
        finalizeScriptRun(
          rawScriptFailure('E_ENGINE', { message: reason }),
          resolveScriptLimits(request.limits),
        ),
      ),
    dispose: () => undefined,
  };
}

async function createDefaultRunner(): Promise<ScriptRunner> {
  try {
    if (canUseBrowserWorker()) {
      const { createBrowserScriptRunner } = await import('./runner-browser');
      return createBrowserScriptRunner();
    }
    const { createInlineScriptRunner } = await import('./runner-inline');
    return createInlineScriptRunner();
  } catch (error) {
    return createUnavailableScriptRunner(messageOf(error));
  }
}

/** The shared runner for this page or process (created on first use). */
export function defaultScriptRunner(): Promise<ScriptRunner> {
  memo ??= createDefaultRunner();
  return memo;
}

/** Dispose and forget the shared runner (tests; a page that wants a fresh worker). */
export function resetDefaultScriptRunner(): void {
  const previous = memo;
  memo = undefined;
  void previous?.then((runner) => {
    runner.dispose();
  });
}
