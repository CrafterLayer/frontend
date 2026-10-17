/**
 * Run one script in a fresh QuickJS runtime (DESIGN §A.2, §A.2.1).
 *
 * Pure given a loaded QuickJS WASM module: the browser worker, the Node worker
 * and the inline runner all call `runScriptInVm(QuickJS, request)`. Each run
 * gets its own runtime with a memory limit, a max stack size and an interrupt
 * deadline (`cpuMs`), evaluates the wrapper below, reads exactly ONE string
 * back, re-validates it against the request, and disposes everything.
 *
 * Errors come back RAW (`{code, detail}`); the runner turns them into the exact
 * §A.8 texts with `finalizeScriptRun` (errors.ts), so the wording lives in one
 * place. Plain JS + a .d.ts so Node `worker_threads` can load it unchanged.
 */

import { ckPrelude } from './ck-prelude.js';

/** The file name QuickJS reports for the wrapper (the user's code is `<input>`). */
export const SANDBOX_FILENAME = 'ck-script.js';

const PRELUDE_SOURCE = ckPrelude.toString();

const ERROR_CODES = [
  'E_TOO_LONG',
  'E_SYNTAX',
  'E_RUNTIME',
  'E_TIMEOUT',
  'E_TIMEOUT_HARD',
  'E_MEMORY',
  'E_STACK',
  'E_LIMIT_CALLS',
  'E_LIMIT_STEPS',
  'E_NO_TOOL',
  'E_BAD_TARGET',
  'E_TOOL_INPUT',
  'E_EMPTY',
  'E_OTHER_PAGE',
  'E_TOO_MANY_WRITES',
  'E_ENGINE',
];
const SET_KEYS = ['text', 'href', 'src', 'alt'];
const BUCKETS = ['base', 'tablet', 'mobile'];
const MALFORMED =
  'the script replaced a built-in (JSON, Object or Array), so its result could not be read';

function clock() {
  return globalThis.performance.now();
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function positiveInt(value) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

function count(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function cap(text, max) {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

/**
 * The source QuickJS evaluates. The user's code reaches the VM as a JSON string
 * literal handed to `new Function`, so it is compiled in the global scope and
 * can never see the prelude's state (`__s`), and no character in it can end the
 * wrapper. The input reaches the prelude through `JSON.parse` of a JSON-quoted
 * string, so page text is data, never syntax.
 */
export function buildWrapperSource(request) {
  const input = {
    elements: request.elements,
    pages: request.pages,
    photos: request.photos,
    tools: request.tools,
    locale: request.locale,
    limits: request.limits,
    seed: request.seed,
    now: request.now,
  };
  return [
    '(() => {',
    "'use strict';",
    `const __s = (${PRELUDE_SOURCE})(JSON.parse(${JSON.stringify(JSON.stringify(input))}));`,
    "let __r; let __p = 'compile';",
    'try {',
    `const __f = new Function('ck', ${JSON.stringify(String(request.code))});`,
    "__p = 'run';",
    '__r = __f(__s.api);',
    '} catch (e) { return __s.fail(e, __p); }',
    'return __s.finish(__r);',
    '})()',
  ].join('\n');
}

function rawFailure(code, detail, stats, notes) {
  return { ok: false, error: { code, detail: detail || {} }, notes: notes || [], stats };
}

function cleanDetail(detail) {
  const out = {};
  if (!isObject(detail)) return out;
  if (typeof detail.message === 'string') out.message = cap(detail.message, 300);
  for (const key of ['line', 'col', 'n', 'chars', 'found', 'count', 'max']) {
    const value = positiveInt(detail[key]);
    if (value !== undefined) out[key] = value;
  }
  for (const key of ['name', 'suggestion', 'kind', 'page']) {
    if (typeof detail[key] === 'string') out[key] = cap(detail[key], 80);
  }
  if (Array.isArray(detail.tools))
    out.tools = detail.tools.filter((name) => typeof name === 'string');
  if (isObject(detail.kinds)) {
    const kinds = {};
    for (const [kind, value] of Object.entries(detail.kinds)) kinds[kind] = count(value);
    out.kinds = kinds;
  }
  return out;
}

function cleanNotes(notes, limits) {
  if (!Array.isArray(notes)) return [];
  const out = [];
  for (const note of notes) {
    if (typeof note !== 'string' || note === '') continue;
    if (out.length >= limits.maxNotes) break;
    out.push(cap(note, limits.maxNoteChars));
  }
  return out;
}

function cleanStyles(styles) {
  if (!isObject(styles) || Object.keys(styles).length === 0) return undefined;
  const out = {};
  for (const [key, value] of Object.entries(styles)) {
    if (
      value === null ||
      typeof value === 'string' ||
      (typeof value === 'number' && Number.isFinite(value))
    ) {
      out[key] = value;
      continue;
    }
    if (!isObject(value)) return undefined;
    const v = value.value;
    if (!(v === null || typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v))))
      return undefined;
    const entry = { value: v };
    if (value.bucket !== undefined) {
      if (!BUCKETS.includes(value.bucket)) return undefined;
      entry.bucket = value.bucket;
    }
    if (typeof value.state === 'string') entry.state = value.state;
    out[key] = entry;
  }
  return out;
}

/**
 * Re-check what the VM returned against the request. The prelude already
 * enforces all of this; the copy here means a script that tampers with
 * built-ins still cannot hand the host a target, tool or count it could not
 * have queued legitimately.
 */
export function sanitizeOutput(parsed, request) {
  const limits = request.limits;
  if (!isObject(parsed) || typeof parsed.ok !== 'boolean') {
    return rawFailure('E_RUNTIME', { message: MALFORMED }, { ms: 0, calls: 0, found: 0 });
  }
  const notes = cleanNotes(parsed.notes, limits);
  const statsIn = isObject(parsed.stats) ? parsed.stats : {};
  const stats = { ms: 0, calls: count(statsIn.calls), found: count(statsIn.found) };
  if (parsed.ok === false) {
    const error = isObject(parsed.error) ? parsed.error : {};
    const code = ERROR_CODES.includes(error.code) ? error.code : 'E_RUNTIME';
    const detail = cleanDetail(error.detail);
    if (code === 'E_RUNTIME' && detail.message === undefined && !ERROR_CODES.includes(error.code)) {
      detail.message = MALFORMED;
    }
    return rawFailure(code, detail, stats, notes);
  }
  if (!Array.isArray(parsed.calls))
    return rawFailure('E_RUNTIME', { message: MALFORMED }, stats, notes);
  if (parsed.calls.length > limits.maxSteps) return rawFailure('E_LIMIT_STEPS', {}, stats, notes);

  const ids = new Set();
  for (const el of request.elements) ids.add(el.id);
  const tools = new Set(request.tools.filter((name) => name !== 'script.run'));
  const calls = [];
  let targetTotal = 0;
  for (let index = 0; index < parsed.calls.length; index += 1) {
    const call = parsed.calls[index];
    const n = index + 1;
    if (!isObject(call)) return rawFailure('E_RUNTIME', { message: MALFORMED }, stats, notes);
    const line = positiveInt(call.line);
    const base = line === undefined ? { n } : { n, line };
    if (call.op === 'set' || call.op === 'style') {
      if (!Array.isArray(call.targets) || call.targets.length === 0) {
        return rawFailure('E_RUNTIME', { message: MALFORMED }, stats, notes);
      }
      for (const target of call.targets) {
        if (typeof target !== 'string' || !ids.has(target)) {
          return rawFailure(
            'E_BAD_TARGET',
            { ...base, message: 'a target is not an element from ck.find()' },
            stats,
            notes,
          );
        }
      }
      targetTotal += call.targets.length;
      if (targetTotal > limits.maxTargets) return rawFailure('E_LIMIT_STEPS', base, stats, notes);
      const targets = [...call.targets];
      if (call.op === 'set') {
        if (!isObject(call.value))
          return rawFailure('E_RUNTIME', { message: MALFORMED }, stats, notes);
        const value = {};
        for (const [key, field] of Object.entries(call.value)) {
          if (!SET_KEYS.includes(key) || typeof field !== 'string') {
            return rawFailure('E_RUNTIME', { message: MALFORMED }, stats, notes);
          }
          value[key] = field;
        }
        calls.push({ ...base, op: 'set', targets, value });
      } else {
        const styles = cleanStyles(call.styles);
        if (styles === undefined)
          return rawFailure('E_RUNTIME', { message: MALFORMED }, stats, notes);
        const out = { ...base, op: 'style', targets, styles };
        if (isObject(call.options)) {
          const options = {};
          if (BUCKETS.includes(call.options.bucket)) options.bucket = call.options.bucket;
          if (typeof call.options.state === 'string') options.state = call.options.state;
          out.options = options;
        }
        calls.push(out);
      }
      continue;
    }
    if (call.op === 'tool') {
      if (typeof call.name !== 'string' || !tools.has(call.name)) {
        return rawFailure(
          'E_NO_TOOL',
          { ...base, name: String(call.name), tools: [...tools] },
          stats,
          notes,
        );
      }
      const out = {
        ...base,
        op: 'tool',
        name: call.name,
        input: call.input === undefined ? {} : call.input,
      };
      if (typeof call.page === 'string') out.page = call.page;
      calls.push(out);
      continue;
    }
    return rawFailure('E_RUNTIME', { message: MALFORMED }, stats, notes);
  }
  const result =
    typeof parsed.result === 'string' ? cap(parsed.result, limits.maxResultChars) : undefined;
  return result === undefined
    ? { ok: true, calls, notes, stats }
    : { ok: true, calls, result, notes, stats };
}

function dumpError(context, handle) {
  try {
    const dumped = context.dump(handle);
    if (isObject(dumped)) {
      return { name: String(dumped.name ?? ''), message: String(dumped.message ?? '') };
    }
    return { name: '', message: String(dumped) };
  } catch {
    return { name: '', message: 'out of memory' };
  }
}

/** Map an error that escaped the wrapper (uncatchable interrupt, or the prelude itself failing). */
function escapedError(error, interrupted) {
  const message = error.message;
  if (interrupted || /interrupted/iu.test(message)) return { code: 'E_TIMEOUT', detail: {} };
  if (/out of memory|string too long/iu.test(message)) return { code: 'E_MEMORY', detail: {} };
  if (/stack overflow/iu.test(message)) return { code: 'E_STACK', detail: {} };
  const text = error.name === '' ? message : `${error.name}: ${message}`;
  return { code: 'E_RUNTIME', detail: { message: cap(text, 300) } };
}

/** Map an exception thrown on the HOST side while driving the VM. */
function hostError(error) {
  const message = String(error && error.message !== undefined ? error.message : error);
  if (/maximum call stack|stack overflow/iu.test(message)) return { code: 'E_STACK', detail: {} };
  if (/out of memory/iu.test(message)) return { code: 'E_MEMORY', detail: {} };
  return { code: 'E_ENGINE', detail: { message: cap(message, 300) } };
}

/**
 * Run `request.code` in a fresh runtime of the loaded `QuickJS` module.
 *
 * @param {import('quickjs-emscripten-core').QuickJSWASMModule} QuickJS
 * @param {import('./types').ScriptRunRequest} request
 * @returns {import('./errors').RawScriptRunResult}
 */
export function runScriptInVm(QuickJS, request) {
  const started = clock();
  const elapsed = () => Math.max(0, Math.round(clock() - started));
  const limits = request.limits;
  const code = String(request.code ?? '');
  if (code.length > limits.maxSourceChars) {
    return rawFailure('E_TOO_LONG', { chars: code.length }, { ms: elapsed(), calls: 0, found: 0 });
  }
  if (!QuickJS || typeof QuickJS.newRuntime !== 'function') {
    return rawFailure(
      'E_ENGINE',
      { message: 'the QuickJS module is not loaded' },
      { ms: elapsed(), calls: 0, found: 0 },
    );
  }

  let runtime;
  let context;
  let interrupted = false;
  try {
    runtime = QuickJS.newRuntime();
    runtime.setMemoryLimit(limits.memoryBytes);
    runtime.setMaxStackSize(limits.stackBytes);
    const deadline = started + limits.cpuMs;
    runtime.setInterruptHandler(() => {
      if (clock() > deadline) interrupted = true;
      return interrupted;
    });
    context = runtime.newContext();
    const evaluated = context.evalCode(buildWrapperSource({ ...request, code }), SANDBOX_FILENAME);
    if (evaluated.error) {
      const error = dumpError(context, evaluated.error);
      evaluated.error.dispose();
      const mapped = escapedError(error, interrupted);
      return rawFailure(mapped.code, mapped.detail, { ms: elapsed(), calls: 0, found: 0 });
    }
    const handle = evaluated.value;
    let text;
    try {
      text = context.typeof(handle) === 'string' ? context.getString(handle) : undefined;
    } finally {
      handle.dispose();
    }
    if (text === undefined) {
      return rawFailure('E_RUNTIME', { message: MALFORMED }, { ms: elapsed(), calls: 0, found: 0 });
    }
    if (text.length > limits.maxOutputChars) {
      return rawFailure('E_LIMIT_STEPS', {}, { ms: elapsed(), calls: 0, found: 0 });
    }
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return rawFailure('E_RUNTIME', { message: MALFORMED }, { ms: elapsed(), calls: 0, found: 0 });
    }
    const result = sanitizeOutput(parsed, request);
    return { ...result, stats: { ...result.stats, ms: elapsed() } };
  } catch (error) {
    const mapped = interrupted ? { code: 'E_TIMEOUT', detail: {} } : hostError(error);
    return rawFailure(mapped.code, mapped.detail, { ms: elapsed(), calls: 0, found: 0 });
  } finally {
    try {
      context?.dispose();
    } catch {
      // a context that failed half-way may already be gone
    }
    try {
      runtime?.dispose();
    } catch {
      // never let cleanup turn a result into a crash
    }
  }
}

/** A raw E_ENGINE result for a run that could not reach a VM (module failed to load). */
export function engineUnavailable(message) {
  return rawFailure(
    'E_ENGINE',
    { message: cap(String(message), 300) },
    { ms: 0, calls: 0, found: 0 },
  );
}
