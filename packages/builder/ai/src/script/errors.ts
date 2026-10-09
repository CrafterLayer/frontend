/**
 * Script error texts (DESIGN §A.8). Each message tells the MODEL how to fix the
 * script: it goes to the single repair round (`repairAiPlanOnce`) together with
 * the original `script.run` step, so it is written as an instruction, never as
 * a stack trace. Messages are capped at `maxErrorChars` (600).
 *
 * The sandbox (QuickJS worker) returns RAW errors — a code plus the facts
 * (`ScriptErrorDetail`) — and every runner calls `finalizeScriptRun`, so the
 * exact wording lives in this one file for both the engine and the host.
 */

import { DEFAULT_SCRIPT_LIMITS } from './limits';
import {
  SCRIPT_ERROR_CODES,
  type ScriptError,
  type ScriptErrorCode,
  type ScriptLimits,
  type ScriptRunResult,
  type ScriptRunStats,
} from './types';

/** The facts an error message is filled from; every field is optional. */
export interface ScriptErrorDetail {
  /** The engine's, the tool's or the reason's own text (E_SYNTAX, E_RUNTIME, E_BAD_TARGET, E_TOOL_INPUT). */
  readonly message?: string;
  readonly line?: number;
  readonly col?: number;
  /** 1-based number of the queued write (set/style/tool) the error belongs to. */
  readonly n?: number;
  /** Tool name (E_NO_TOOL, E_TOOL_INPUT). */
  readonly name?: string;
  /** Did-you-mean tool name (E_NO_TOOL). */
  readonly suggestion?: string;
  /** The lane's tool names (E_NO_TOOL). */
  readonly tools?: readonly string[];
  /** Source length (E_TOO_LONG). */
  readonly chars?: number;
  /** The kind the script searched for and how many it found (E_EMPTY). */
  readonly kind?: string;
  readonly found?: number;
  /** Element counts per kind on the page, in display order (E_EMPTY). */
  readonly kinds?: Readonly<Record<string, number>>;
  /** The open page's title or slug (E_OTHER_PAGE). */
  readonly page?: string;
  /** How many sections / writes the script touched (E_TOO_MANY_WRITES). */
  readonly count?: number;
  /** The door's per-plan write cap (E_TOO_MANY_WRITES); 64 by default. */
  readonly max?: number;
  /** Budgets the message quotes (defaults to DEFAULT_SCRIPT_LIMITS). */
  readonly limits?: Partial<ScriptLimits>;
}

/** What the sandbox posts back before the runner finalizes the message. */
export interface RawScriptError {
  readonly code: ScriptErrorCode;
  readonly detail: ScriptErrorDetail;
}

export type RawScriptRunResult =
  | Extract<ScriptRunResult, { ok: true }>
  | {
      readonly ok: false;
      readonly error: RawScriptError;
      readonly notes: readonly string[];
      readonly stats: ScriptRunStats;
    };

const DOOR_MAX_WRITES = 64;
const TOOL_LIST_BUDGET = 260;

function seconds(ms: number): string {
  const s = ms / 1000;
  return Number.isInteger(s) ? String(s) : s.toFixed(1);
}

function megabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return Number.isInteger(mb) ? String(mb) : mb.toFixed(1);
}

function callRef(detail: ScriptErrorDetail): string {
  const n = detail.n === undefined ? '' : ` call #${String(detail.n)}`;
  const line = detail.line === undefined ? '' : ` (line ${String(detail.line)})`;
  return n + line;
}

function lineRef(detail: ScriptErrorDetail, withCol: boolean): string {
  if (detail.line === undefined) return '';
  const col = withCol && detail.col !== undefined ? `:${String(detail.col)}` : '';
  return ` line ${String(detail.line)}${col}`;
}

/** Strip a trailing period so "<message>. Next sentence" never doubles it. */
function clause(text: string | undefined, fallback: string): string {
  const value = (text ?? '').replace(/\s+/gu, ' ').trim();
  return (value === '' ? fallback : value).replace(/[.\s]+$/u, '');
}

/** The tool's own message, whitespace collapsed but otherwise untouched. */
function verbatim(text: string | undefined, fallback: string): string {
  const value = (text ?? '').replace(/\s+/gu, ' ').trim();
  return value === '' ? fallback : value;
}

function toolList(tools: readonly string[] | undefined): string {
  if (tools === undefined || tools.length === 0) return '(none)';
  let out = '';
  for (const name of tools) {
    const next = out === '' ? name : `${out}, ${name}`;
    if (next.length > TOOL_LIST_BUDGET) return `${out}…`;
    out = next;
  }
  return out;
}

function kindList(kinds: Readonly<Record<string, number>> | undefined): string {
  if (kinds === undefined) return '(none)';
  const parts = Object.entries(kinds)
    .filter(([, count]) => count > 0)
    .map(([kind, count]) => `${kind} ${String(count)}`);
  return parts.length === 0 ? '(none)' : parts.join(', ');
}

function cap(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

function rawMessage(code: ScriptErrorCode, detail: ScriptErrorDetail): string {
  const limits = { ...DEFAULT_SCRIPT_LIMITS, ...detail.limits };
  switch (code) {
    case 'E_TOO_LONG':
      return `E_TOO_LONG: the script is ${String(detail.chars ?? '?')} chars (max ${String(limits.maxSourceChars)}). Put repeated data in one array and loop over it; if every edit is different, write plain steps instead.`;
    case 'E_SYNTAX':
      return `E_SYNTAX${lineRef(detail, true)}: ${clause(detail.message, 'the script does not parse')}. Write plain JavaScript only: no TypeScript types, no import/export, no await, single quotes inside the JSON string.`;
    case 'E_RUNTIME':
      return `E_RUNTIME${lineRef(detail, false)}: ${clause(detail.message, 'the script threw')}. Check names: only ck.find/pages/photos/set/style/tool/fmt/note exist; El fields are id,kind,text,tag,node,section,page,path,part,index,src,href.`;
    case 'E_TIMEOUT':
      return `E_TIMEOUT: the script ran past ${seconds(limits.cpuMs)} s. Loop over ck.find() results; never while(true) or nested loops over all elements.`;
    case 'E_TIMEOUT_HARD':
      return `E_TIMEOUT_HARD: the script was stopped after ${seconds(limits.hardMs)} s (it built very large strings or arrays). Queue edits with ck.set/ck.style instead of building text.`;
    case 'E_MEMORY':
      return `E_MEMORY: the script used more than ${megabytes(limits.memoryBytes)} MB. Do not build big strings or arrays; queue edits directly.`;
    case 'E_STACK':
      return 'E_STACK: recursion too deep. Use a for loop instead of recursion.';
    case 'E_LIMIT_CALLS':
      return `E_LIMIT_CALLS: more than ${String(limits.maxCalls)} ck calls. Pass arrays: ck.style(ck.find({kind:'button'}), {...}) is ONE call.`;
    case 'E_LIMIT_STEPS':
      return `E_LIMIT_STEPS: more than ${String(limits.maxSteps)} edits in one script. Narrow with ck.find({section}) or do the rest in followUp.`;
    case 'E_NO_TOOL': {
      const mean = detail.suggestion === undefined ? '' : ` Did you mean "${detail.suggestion}"?`;
      return `E_NO_TOOL${callRef(detail)}: no tool "${detail.name ?? '?'}" here.${mean} Tools: ${toolList(detail.tools)}`;
    }
    case 'E_BAD_TARGET':
      return `E_BAD_TARGET${callRef(detail)}: ${clause(detail.message, 'that is not an element')}. Pass elements returned by ck.find(), not ids you wrote.`;
    case 'E_TOOL_INPUT':
      return `E_TOOL_INPUT${callRef(detail)} tool "${detail.name ?? '?'}": ${verbatim(detail.message, 'the input was rejected')}`;
    case 'E_EMPTY': {
      const found =
        detail.kind === undefined
          ? ''
          : ` ck.find({kind:'${detail.kind}'}) found ${String(detail.found ?? 0)} here;`;
      return `E_EMPTY: the script changed nothing.${found} ${found === '' ? 'Kinds' : 'kinds'} on this page: ${kindList(detail.kinds)}`;
    }
    case 'E_OTHER_PAGE':
      return `E_OTHER_PAGE: this edit can only change the open page (page "${detail.page ?? '?'}"). Edit this page now and say in followUp which other pages need the same change.`;
    case 'E_TOO_MANY_WRITES':
      return `E_TOO_MANY_WRITES: the script touches ${String(detail.count ?? '?')} sections (max ${String(detail.max ?? DOOR_MAX_WRITES)} writes per plan). Limit it with ck.find({section}) and put the rest in followUp.`;
    case 'E_ENGINE':
      return 'E_ENGINE: the script engine is unavailable right now. Write the same change as plain tool steps.';
  }
}

/** The exact §A.8 text for `code`, filled from `detail` and capped at `maxErrorChars`. */
export function scriptErrorMessage(code: ScriptErrorCode, detail: ScriptErrorDetail = {}): string {
  const max = detail.limits?.maxErrorChars ?? DEFAULT_SCRIPT_LIMITS.maxErrorChars;
  return cap(rawMessage(code, detail), max);
}

/** A finished `ScriptError` (code, message, line?, col?). */
export function scriptError(code: ScriptErrorCode, detail: ScriptErrorDetail = {}): ScriptError {
  return {
    code,
    message: scriptErrorMessage(code, detail),
    ...(detail.line === undefined ? {} : { line: detail.line }),
    ...(detail.col === undefined ? {} : { col: detail.col }),
  };
}

/** Edit distance (insert, delete, substitute), used for did-you-mean. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
    }
    previous = current;
  }
  return previous[b.length] ?? Math.max(a.length, b.length);
}

/** The closest valid name within edit distance 3, or undefined. Ties keep list order. */
export function didYouMean(name: string, valid: readonly string[]): string | undefined {
  const needle = name.toLowerCase();
  let best: string | undefined;
  let bestDistance = 4;
  for (const candidate of valid) {
    const distance = levenshtein(needle, candidate.toLowerCase());
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

const ERROR_CODES: ReadonlySet<string> = new Set(SCRIPT_ERROR_CODES);

/** True when `value` is one of the sixteen E_* codes. */
export function isScriptErrorCode(value: unknown): value is ScriptErrorCode {
  return typeof value === 'string' && ERROR_CODES.has(value);
}

const ZERO_STATS: ScriptRunStats = { ms: 0, calls: 0, found: 0 };

/** A raw failure built on the host side (worker died, hard timeout, engine load failure). */
export function rawScriptFailure(
  code: ScriptErrorCode,
  detail: ScriptErrorDetail = {},
  stats: ScriptRunStats = ZERO_STATS,
  notes: readonly string[] = [],
): RawScriptRunResult {
  return { ok: false, error: { code, detail }, notes, stats };
}

/**
 * Turn the sandbox's raw result into the public `ScriptRunResult`: the raw error
 * becomes the exact §A.8 message for the request's limits. A successful run
 * passes through unchanged.
 */
export function finalizeScriptRun(
  raw: RawScriptRunResult,
  limits: ScriptLimits = DEFAULT_SCRIPT_LIMITS,
): ScriptRunResult {
  if (raw.ok) return raw;
  const code = isScriptErrorCode(raw.error.code) ? raw.error.code : 'E_ENGINE';
  const detail: ScriptErrorDetail = { ...raw.error.detail, limits };
  return { ok: false, error: scriptError(code, detail), notes: raw.notes, stats: raw.stats };
}
