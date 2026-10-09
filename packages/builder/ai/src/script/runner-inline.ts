/**
 * In-thread script runner: QuickJS on the caller's own thread, with ONLY the
 * `cpuMs` interrupt (DESIGN §A.2, §A.13).
 *
 * For tests (vitest has no global `Worker`) and as the documented last resort.
 * Without a Worker there is no wall-clock kill: the research bench measured a
 * `'x'.repeat(1e5)` loop stalling in-thread QuickJS for 70–104 s with only nine
 * interrupt ticks. NEVER use it in a server that runs untrusted plans; Node
 * hosts use `createNodeScriptRunner` (`@craftkit/builder-ai/script-node`).
 *
 * Nothing heavy is imported until the first `run`: the QuickJS module and
 * sandbox-core load lazily, so importing this file costs no engine bytes.
 */

import type { QuickJSWASMModule } from 'quickjs-emscripten-core';

import { finalizeScriptRun, rawScriptFailure, type RawScriptRunResult } from './errors';
import { resolveScriptLimits } from './limits';
import type { ScriptRunRequest, ScriptRunResult, ScriptRunner } from './types';

export interface InlineScriptRunnerOptions {
  /** Supply the QuickJS module (tests). Default: the release-sync variant, loaded once per process. */
  readonly loadModule?: () => Promise<QuickJSWASMModule>;
}

let sharedModule: Promise<QuickJSWASMModule> | undefined;

/** Load the release-sync QuickJS module once; a failed load is retried on the next run. */
export function loadQuickJSModule(): Promise<QuickJSWASMModule> {
  if (sharedModule === undefined) {
    const loading = (async () => {
      const [core, variant] = await Promise.all([
        import('quickjs-emscripten-core'),
        import('@jitl/quickjs-wasmfile-release-sync'),
      ]);
      return core.newQuickJSWASMModuleFromVariant(variant.default);
    })();
    sharedModule = loading;
    loading.catch(() => {
      if (sharedModule === loading) sharedModule = undefined;
    });
  }
  return sharedModule;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Run scripts on this thread. See the file header for when that is acceptable. */
export function createInlineScriptRunner(options: InlineScriptRunnerOptions = {}): ScriptRunner {
  const loadModule = options.loadModule ?? loadQuickJSModule;
  let disposed = false;

  async function run(request: ScriptRunRequest): Promise<ScriptRunResult> {
    const limits = resolveScriptLimits(request.limits);
    const full: ScriptRunRequest = { ...request, limits };
    let raw: RawScriptRunResult;
    if (disposed) {
      raw = rawScriptFailure('E_ENGINE', { message: 'the script runner was disposed' });
    } else if (request.code.length > limits.maxSourceChars) {
      raw = rawScriptFailure('E_TOO_LONG', { chars: request.code.length });
    } else {
      try {
        const [module, core] = await Promise.all([loadModule(), import('./sandbox-core.js')]);
        raw = core.runScriptInVm(module, full);
      } catch (error) {
        raw = rawScriptFailure('E_ENGINE', { message: messageOf(error) });
      }
    }
    return finalizeScriptRun(raw, limits);
  }

  return {
    run,
    dispose() {
      disposed = true;
    },
  };
}
