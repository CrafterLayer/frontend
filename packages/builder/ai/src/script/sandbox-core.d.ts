/**
 * Types for `sandbox-core.js` (plain JS so Node `worker_threads`, the Vite
 * browser worker and vitest load the same file; DESIGN §A.2 D4).
 */

import type { QuickJSWASMModule } from 'quickjs-emscripten-core';

import type { RawScriptRunResult } from './errors';
import type { ScriptRunRequest } from './types';

/** The file name QuickJS reports for the wrapper (the user's code is `<input>`). */
export declare const SANDBOX_FILENAME: 'ck-script.js';

/** The exact source QuickJS evaluates for `request` (prelude + JSON-quoted user code). */
export declare function buildWrapperSource(request: ScriptRunRequest): string;

/** Re-check a parsed VM output against the request (targets, tools, caps). */
export declare function sanitizeOutput(
  parsed: unknown,
  request: ScriptRunRequest,
): RawScriptRunResult;

/**
 * Run one script in a fresh runtime of a loaded module: memory, stack and CPU
 * limits, one JSON string back, everything disposed. Errors are RAW; pass the
 * result through `finalizeScriptRun` for the §A.8 messages.
 */
export declare function runScriptInVm(
  QuickJS: QuickJSWASMModule,
  request: ScriptRunRequest,
): RawScriptRunResult;

/** A raw E_ENGINE result for a run that could not reach a VM. */
export declare function engineUnavailable(message: unknown): RawScriptRunResult;
