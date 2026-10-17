/**
 * Browser module-worker entry for the script sandbox (DESIGN §A.2, §A.2.2).
 *
 * Bundled by Vite from `new Worker(new URL('./sandbox-worker.browser.ts',
 * import.meta.url), {type: 'module'})` in runner-browser.ts. Loads the QuickJS
 * module once, posts `{ready: true}` (or `{ready: false, error}`), then answers
 * every `{id, request}` with `{id, result}`. The page side owns the wall clock:
 * it terminates this worker at `hardMs` and respawns lazily.
 *
 * The wasm URL comes from Vite's `?url` import so it resolves in dev (where
 * dependencies are pre-bundled and the variant's own `import.meta.url` lookup
 * would point into `.vite/deps`) and in the production build. A CSP, if one is
 * ever added, must allow 'wasm-unsafe-eval' and same-origin workers.
 */

import releaseSyncVariant from '@jitl/quickjs-wasmfile-release-sync';
// @ts-expect-error -- Vite's `?url` suffix has no type declaration in this headless package.
import wasmUrlImport from '@jitl/quickjs-wasmfile-release-sync/wasm?url';
import {
  newQuickJSWASMModuleFromVariant,
  newVariant,
  type QuickJSWASMModule,
} from 'quickjs-emscripten-core';

import type { RawScriptRunResult } from './errors';
import { engineUnavailable, runScriptInVm } from './sandbox-core.js';
import type { ScriptRunRequest } from './types';

interface WorkerScope {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: { readonly data: unknown }) => void): void;
}

const scope = globalThis as unknown as WorkerScope;
const wasmLocation: unknown = wasmUrlImport;

function loadQuickJS(): Promise<QuickJSWASMModule> {
  const variant =
    typeof wasmLocation === 'string'
      ? newVariant(releaseSyncVariant, { wasmLocation })
      : releaseSyncVariant;
  return newQuickJSWASMModuleFromVariant(variant);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const ready: Promise<QuickJSWASMModule | string> = loadQuickJS().catch((error: unknown) =>
  messageOf(error),
);

scope.addEventListener('message', (event) => {
  const data = event.data as { readonly id?: unknown; readonly request?: ScriptRunRequest } | null;
  if (data === null || typeof data.id !== 'number' || data.request === undefined) return;
  const { id, request } = data;
  void ready.then((loaded) => {
    let result: RawScriptRunResult;
    try {
      result =
        typeof loaded === 'string' ? engineUnavailable(loaded) : runScriptInVm(loaded, request);
    } catch (error) {
      result = engineUnavailable(messageOf(error));
    }
    scope.postMessage({ id, result });
  });
});

void ready.then((loaded) => {
  scope.postMessage(typeof loaded === 'string' ? { ready: false, error: loaded } : { ready: true });
});
