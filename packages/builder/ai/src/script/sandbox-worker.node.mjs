/**
 * Node `worker_threads` entry for the script sandbox (DESIGN §A.2).
 *
 * Plain JS so a worker thread can load it without a TypeScript loader. Loads
 * the QuickJS module once, posts `{ready: true}` (or `{ready: false, error}`),
 * then answers every `{id, request}` with `{id, result}`. The parent runner
 * (`runner-node.ts`) owns the wall clock: it terminates this thread at
 * `hardMs` and respawns lazily.
 */

import { parentPort } from 'node:worker_threads';

import releaseSyncVariant from '@jitl/quickjs-wasmfile-release-sync';
import { newQuickJSWASMModuleFromVariant } from 'quickjs-emscripten-core';

import { engineUnavailable, runScriptInVm } from './sandbox-core.js';

if (parentPort === null) {
  throw new Error('sandbox-worker.node.mjs must run inside a worker thread');
}
const port = parentPort;

let QuickJS;
let loadError;
try {
  QuickJS = await newQuickJSWASMModuleFromVariant(releaseSyncVariant);
} catch (error) {
  loadError = String(error && error.message !== undefined ? error.message : error);
}

port.on('message', (message) => {
  if (message === null || typeof message !== 'object' || typeof message.id !== 'number') return;
  let result;
  try {
    result =
      QuickJS === undefined
        ? engineUnavailable(loadError)
        : runScriptInVm(QuickJS, message.request);
  } catch (error) {
    result = engineUnavailable(error && error.message !== undefined ? error.message : error);
  }
  port.postMessage({ id: message.id, result });
});

port.postMessage(loadError === undefined ? { ready: true } : { ready: false, error: loadError });
