import { studioParamLabel } from './labels';
import {
  isHexColour,
  isPaletteParamValue,
  jsParamsJsonLength,
  paramDefaultProblem,
  SCRIPT_PARAM_KEY_PATTERN,
  STUDIO_LIMITS,
} from './schemas';
import type {
  Bilingual,
  CustomCodeJsParams,
  ScriptParamGroup,
  ScriptParamSpec,
  ScriptParamValue,
} from './types';

/**
 * Script params: the values a region's script reads through `ck.params(defaults)`
 * (pixi-studio DESIGN.md §A.1, §B.2, D8).
 *
 * The SPEC (`jsMeta.params`, `ScriptEntry.params`) says what can be tuned and
 * how; the VALUES (`jsParams`, rendered as `data-ck-params`) are what the
 * person or the agent chose. Everything here is pure and total: bad input is
 * coerced or dropped with an issue, never thrown, because the callers are a
 * form mid-drag and an agent tool expanding a plan.
 */

// ── Values ───────────────────────────────────────────────────────────────────

export type ParamValueIssueCode =
  'unknown-key' | 'wrong-type' | 'clamped' | 'not-an-option' | 'truncated' | 'too-large';

export interface ParamValueIssue {
  key: string;
  code: ParamValueIssueCode;
  message: Bilingual;
}

export interface ParamValuesResult {
  /** The given values, coerced and clamped; unknown or unusable keys are dropped. */
  values: CustomCodeJsParams;
  issues: ParamValueIssue[];
}

const IMAGE_VALUE =
  /^(?:https:\/\/[^\s"'<>`\\]+|data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+|[A-Za-z0-9_-]{1,200})$/u;

function issue(key: string, code: ParamValueIssueCode, en: string, ar: string): ParamValueIssue {
  return { key, code, message: { en, ar } };
}

function numberFrom(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function colourFrom(value: unknown): string | undefined {
  if (typeof value === 'string' && isHexColour(value.trim())) return value.trim().toLowerCase();
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffff) {
    return `#${value.toString(16).padStart(6, '0')}`;
  }
  return undefined;
}

/** One value coerced to its spec, or an issue explaining why it cannot be. */
function coerceOne(
  spec: ScriptParamSpec,
  raw: unknown,
): { value?: ScriptParamValue; issue?: ParamValueIssue } {
  const { key } = spec;
  const wrong = (en: string, ar: string) => ({ issue: issue(key, 'wrong-type', en, ar) });
  switch (spec.type) {
    case 'number':
    case 'range': {
      const number = numberFrom(raw);
      if (number === undefined) return wrong(`${key} takes a number.`, `«${key}» يأخذ رقماً.`);
      const low = spec.min ?? Number.NEGATIVE_INFINITY;
      const high = spec.max ?? Number.POSITIVE_INFINITY;
      const clamped = Math.min(high, Math.max(low, number));
      if (clamped !== number) {
        return {
          value: clamped,
          issue: issue(
            key,
            'clamped',
            `${key} was clamped to ${String(clamped)} (range ${String(spec.min)}–${String(spec.max)}).`,
            `قُيّد «${key}» إلى ${String(clamped)} (المدى ${String(spec.min)}–${String(spec.max)}).`,
          ),
        };
      }
      return { value: number };
    }
    case 'color': {
      const colour = colourFrom(raw);
      return colour === undefined
        ? wrong(`${key} takes a #hex colour.`, `«${key}» يأخذ لوناً بصيغة ‎#hex.`)
        : { value: colour };
    }
    case 'palette': {
      if (raw === 'theme') return { value: 'theme' };
      const list = typeof raw === 'string' ? [raw] : Array.isArray(raw) ? raw : undefined;
      const colours = (list ?? [])
        .map((entry) => colourFrom(entry))
        .filter((entry): entry is string => entry !== undefined)
        .slice(0, STUDIO_LIMITS.paletteSwatches);
      if (colours.length === 0) {
        return wrong(
          `${key} takes "theme" or a list of #hex colours.`,
          `«${key}» يأخذ "theme" أو قائمة ألوان ‎#hex.`,
        );
      }
      return { value: colours };
    }
    case 'select': {
      const value = typeof raw === 'number' ? String(raw) : raw;
      if (typeof value === 'string' && (spec.options ?? []).some((o) => o.value === value)) {
        return { value };
      }
      const allowed = (spec.options ?? []).map((option) => option.value).join(', ');
      return {
        issue: issue(
          key,
          'not-an-option',
          `${key} is one of: ${allowed}.`,
          `«${key}» واحد من: ${allowed}.`,
        ),
      };
    }
    case 'toggle': {
      if (typeof raw === 'boolean') return { value: raw };
      if (raw === 'true' || raw === 1) return { value: true };
      if (raw === 'false' || raw === 0) return { value: false };
      return wrong(`${key} is true or false.`, `«${key}» صح أو خطأ.`);
    }
    case 'text': {
      const text =
        typeof raw === 'string' ? raw : typeof raw === 'number' ? String(raw) : undefined;
      if (text === undefined) return wrong(`${key} takes text.`, `«${key}» يأخذ نصاً.`);
      if (text.length > STUDIO_LIMITS.text) {
        return {
          value: text.slice(0, STUDIO_LIMITS.text),
          issue: issue(
            key,
            'truncated',
            `${key} was cut to ${String(STUDIO_LIMITS.text)} characters.`,
            `قُصّ «${key}» إلى ${String(STUDIO_LIMITS.text)} حرفاً.`,
          ),
        };
      }
      return { value: text };
    }
    case 'image': {
      if (raw === '') return { value: '' };
      return typeof raw === 'string' &&
        raw.length <= STUDIO_LIMITS.imageValue &&
        IMAGE_VALUE.test(raw)
        ? { value: raw }
        : wrong(
            `${key} takes an https URL, an image data URL or an asset id.`,
            `«${key}» يأخذ رابط https أو صورة data أو معرّف أصل.`,
          );
    }
    case 'sound':
      return typeof raw === 'string' && raw.length <= STUDIO_LIMITS.soundValue
        ? { value: raw }
        : wrong(`${key} takes a sound reference.`, `«${key}» يأخذ مرجع صوت.`);
  }
}

/**
 * Coerce and clamp `values` against `spec` (§A.1). Only the keys given come
 * back — defaults are the script's own business (`ck.params` merges them) — so
 * a region's `jsParams` keeps holding only what someone actually chose.
 */
export function validateParamValues(
  spec: readonly ScriptParamSpec[],
  values: Readonly<Record<string, unknown>> | undefined,
): ParamValuesResult {
  const byKey = new Map(spec.map((entry) => [entry.key, entry]));
  const out: CustomCodeJsParams = {};
  const issues: ParamValueIssue[] = [];
  for (const [key, raw] of Object.entries(values ?? {})) {
    const entry = byKey.get(key);
    if (entry === undefined) {
      issues.push(
        issue(
          key,
          'unknown-key',
          `${key} is not a param of this script (known: ${[...byKey.keys()].join(', ') || 'none'}).`,
          `«${key}» ليس من إعدادات هذا السكربت.`,
        ),
      );
      continue;
    }
    const result = coerceOne(entry, raw);
    if (result.value !== undefined) out[key] = result.value;
    if (result.issue !== undefined) issues.push(result.issue);
  }
  if (jsParamsJsonLength(out) > STUDIO_LIMITS.jsParamsJson) {
    issues.push(
      issue(
        '',
        'too-large',
        `The values exceed ${String(STUDIO_LIMITS.jsParamsJson)} characters of JSON.`,
        `القيم تتجاوز ${String(STUDIO_LIMITS.jsParamsJson)} حرفاً.`,
      ),
    );
  }
  return { values: out, issues };
}

/** Every param's default, keyed. */
export function paramDefaults(spec: readonly ScriptParamSpec[]): CustomCodeJsParams {
  const out: CustomCodeJsParams = {};
  for (const entry of spec) out[entry.key] = entry.default;
  return out;
}

function sameValue(a: ScriptParamValue | undefined, b: ScriptParamValue | undefined): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((entry, index) => entry === b[index]);
  }
  return a === b;
}

/** Only the values that differ from their defaults (what `jsParams` stores, §A.4). */
export function paramsDiffFromDefaults(
  spec: readonly ScriptParamSpec[],
  values: Readonly<CustomCodeJsParams>,
): CustomCodeJsParams {
  const out: CustomCodeJsParams = {};
  for (const entry of spec) {
    if (!Object.hasOwn(values, entry.key)) continue;
    const value = values[entry.key];
    if (value !== undefined && !sameValue(value, entry.default)) out[entry.key] = value;
  }
  return out;
}

// ── Inference from code ──────────────────────────────────────────────────────

type Literal = number | string | boolean | string[];

/** A tiny cursor over JS source: enough to read one object literal of literals. */
class Cursor {
  index: number;

  constructor(
    readonly source: string,
    start: number,
  ) {
    this.index = start;
  }

  get char(): string {
    return this.source.charAt(this.index);
  }

  get done(): boolean {
    return this.index >= this.source.length;
  }

  skipTrivia(): void {
    for (;;) {
      const rest = this.source.slice(this.index, this.index + 2);
      if (/^\s/u.test(this.char)) {
        this.index += 1;
      } else if (rest === '//') {
        const end = this.source.indexOf('\n', this.index);
        this.index = end === -1 ? this.source.length : end + 1;
      } else if (rest === '/*') {
        const end = this.source.indexOf('*/', this.index + 2);
        this.index = end === -1 ? this.source.length : end + 2;
      } else {
        return;
      }
    }
  }

  /** A quoted string (', " or a backtick without `${`), unescaped; undefined if not at one. */
  readString(): string | undefined {
    const quote = this.char;
    if (quote !== "'" && quote !== '"' && quote !== '`') return undefined;
    let out = '';
    let at = this.index + 1;
    while (at < this.source.length) {
      const char = this.source.charAt(at);
      if (char === quote) {
        this.index = at + 1;
        return out;
      }
      if (quote === '`' && char === '$' && this.source.charAt(at + 1) === '{') return undefined;
      if (char === '\n' && quote !== '`') return undefined;
      if (char === '\\') {
        const next = this.source.charAt(at + 1);
        const escapes: Record<string, string> = { n: '\n', t: '\t', r: '\r', '0': '\0' };
        if (next === 'u') {
          const hex = /^[0-9a-fA-F]{4}/u.exec(this.source.slice(at + 2, at + 6));
          if (hex === null) return undefined;
          out += String.fromCharCode(Number.parseInt(hex[0], 16));
          at += 6;
          continue;
        }
        const escaped = escapes[next];
        out += Object.hasOwn(escapes, next) && escaped !== undefined ? escaped : next;
        at += 2;
        continue;
      }
      out += char;
      at += 1;
    }
    return undefined;
  }

  readIdentifier(): string | undefined {
    const match = /^[A-Za-z_$][\w$]*/u.exec(this.source.slice(this.index, this.index + 64));
    if (match === null) return undefined;
    this.index += match[0].length;
    return match[0];
  }

  /** Skip one value expression: up to the next `,` or `}` at depth 0. */
  skipValue(): void {
    let depth = 0;
    while (!this.done) {
      this.skipTrivia();
      const char = this.char;
      if (char === "'" || char === '"' || char === '`') {
        const before = this.index;
        if (this.readString() === undefined) {
          // An unterminated or templated string: step over its opening quote.
          this.index = before + 1;
        }
        continue;
      }
      if (char === '(' || char === '[' || char === '{') depth += 1;
      if (char === ')' || char === ']' || char === '}') {
        if (depth === 0) return;
        depth -= 1;
      }
      if (char === ',' && depth === 0) return;
      this.index += 1;
    }
  }

  /** A literal value, or undefined (cursor left after whatever it consumed). */
  readLiteral(): Literal | undefined {
    this.skipTrivia();
    const string = this.readString();
    if (string !== undefined) return string;
    const rest = this.source.slice(this.index, this.index + 40);
    const hexNumber = /^0[xX][0-9a-fA-F]+/u.exec(rest);
    if (hexNumber !== null) {
      this.index += hexNumber[0].length;
      return Number(hexNumber[0]);
    }
    const number = /^-?\s*(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/u.exec(rest);
    if (number !== null) {
      this.index += number[0].length;
      return Number(number[0].replace(/\s+/gu, ''));
    }
    const word = /^(?:true|false)\b/u.exec(rest);
    if (word !== null) {
      this.index += word[0].length;
      return word[0] === 'true';
    }
    if (this.char === '[') {
      this.index += 1;
      const items: string[] = [];
      for (;;) {
        this.skipTrivia();
        if ((this.char as string) === ']') {
          this.index += 1;
          return items;
        }
        const item = this.readString();
        if (item === undefined) return undefined;
        items.push(item);
        this.skipTrivia();
        if ((this.char as string) === ',') this.index += 1;
      }
    }
    return undefined;
  }
}

/**
 * The FIRST `ck.params({...})` object literal, read with a small tokenizer
 * (never evaluated). Keys whose value is not a plain literal are skipped.
 */
export function readParamsLiteral(code: string): [string, Literal][] {
  const start = /\bck\s*\.\s*params\s*\(\s*\{/u.exec(code);
  if (start === null) return [];
  const cursor = new Cursor(code, start.index + start[0].length);
  const out: [string, Literal][] = [];
  while (!cursor.done) {
    cursor.skipTrivia();
    if (cursor.char === '}') break;
    if (cursor.char === ',') {
      cursor.index += 1;
      continue;
    }
    const key = cursor.readString() ?? cursor.readIdentifier();
    if (key === undefined) {
      const before = cursor.index;
      cursor.skipValue();
      // A stray `)` or `]` at depth 0 stops skipValue where it stands: step over it.
      if (cursor.index === before) cursor.index += 1;
      continue;
    }
    cursor.skipTrivia();
    if (cursor.char !== ':') {
      // Shorthand `{ seed }` or a method: no literal to read.
      cursor.skipValue();
      continue;
    }
    cursor.index += 1;
    const valueStart = cursor.index;
    const literal = cursor.readLiteral();
    cursor.skipTrivia();
    const char = cursor.char as string;
    const clean = literal !== undefined && (char === ',' || char === '}');
    if (clean) {
      out.push([key, literal]);
    } else {
      cursor.index = valueStart;
      cursor.skipValue();
    }
  }
  return out;
}

const KNOWN_RANGES: Readonly<Record<string, { min: number; max: number; step: number }>> = {
  speed: { min: 0, max: 3, step: 0.05 },
  density: { min: 0.2, max: 2, step: 0.05 },
  opacity: { min: 0, max: 1, step: 0.01 },
  alpha: { min: 0, max: 1, step: 0.01 },
  volume: { min: 0, max: 1, step: 0.01 },
};

function groupOf(key: string): ScriptParamGroup {
  if (/sound|volume|sfx|audio|mute/iu.test(key)) return 'sound';
  if (/interactive|pointer|cursor|hover|mouse|touch|click|drag|magnet|repel|attract/iu.test(key)) {
    return 'interaction';
  }
  if (
    /speed|duration|delay|tempo|motion|spin|rotat|drift|flow|wind|gravity|fps|loop|time/iu.test(key)
  ) {
    return 'motion';
  }
  return 'look';
}

function numericSpec(
  key: string,
  value: number,
): Pick<ScriptParamSpec, 'type' | 'min' | 'max' | 'step'> {
  if (key === 'seed') {
    return { type: 'number', min: 0, max: 99_999, step: 1 };
  }
  const known = Object.hasOwn(KNOWN_RANGES, key) ? KNOWN_RANGES[key] : undefined;
  if (known !== undefined) {
    return {
      type: 'range',
      min: Math.min(known.min, value),
      max: Math.max(known.max, value),
      step: known.step,
    };
  }
  const min = value < 0 ? value * 2 : 0;
  const max = value > 0 ? value * 2 : value < 0 ? -value * 2 : 1;
  const span = max - min;
  const step =
    Number.isInteger(value) && span >= 10
      ? span > 2_000
        ? 10
        : 1
      : span <= 2
        ? 0.01
        : span <= 20
          ? 0.1
          : 1;
  return { type: 'range', min, max, step };
}

function stringSpec(key: string, value: string): Pick<ScriptParamSpec, 'type'> {
  if (value === 'theme') return { type: 'palette' };
  if (isHexColour(value)) return { type: 'color' };
  if (
    /image|photo|img|picture|texture|src|backdrop/iu.test(key) &&
    (value === '' || /^(?:https:|data:image\/)/u.test(value))
  ) {
    return { type: 'image' };
  }
  if (/sound|sfx/iu.test(key) && value.length <= STUDIO_LIMITS.soundValue) return { type: 'sound' };
  return { type: 'text' };
}

/**
 * A param spec inferred from the FIRST `ck.params({...})` object literal
 * (§A.1): a number becomes a range (min 0, max 2× the default, a step sized to
 * the span; `seed` stays a whole number), `'#hex'` a colour, a boolean a
 * toggle, `'theme'` or a list of hex a palette, any other string text. Labels
 * are the key humanised (en) plus `STUDIO_PARAM_LABELS` (ar), the key itself
 * being the Arabic fallback.
 */
export function inferParamSpec(code: string): ScriptParamSpec[] {
  const out: ScriptParamSpec[] = [];
  const seen = new Set<string>();
  for (const [key, value] of readParamsLiteral(code)) {
    if (out.length >= STUDIO_LIMITS.params) break;
    if (!SCRIPT_PARAM_KEY_PATTERN.test(key) || seen.has(key)) continue;
    let shape: Pick<ScriptParamSpec, 'type' | 'min' | 'max' | 'step'> | undefined;
    let fallback: ScriptParamValue = value;
    if (typeof value === 'number') {
      shape = numericSpec(key, value);
    } else if (typeof value === 'boolean') {
      shape = { type: 'toggle' };
    } else if (typeof value === 'string') {
      shape = stringSpec(key, value);
      if (shape.type === 'text') fallback = value.slice(0, STUDIO_LIMITS.text);
    } else if (isPaletteParamValue(value)) {
      shape = { type: 'palette' };
      fallback = value.map((entry) => entry.toLowerCase());
    }
    if (shape === undefined) continue;
    const spec: ScriptParamSpec = {
      key,
      type: shape.type,
      label: studioParamLabel(key),
      default:
        shape.type === 'color' && typeof fallback === 'string' ? fallback.toLowerCase() : fallback,
      group: groupOf(key),
    };
    if (shape.min !== undefined) spec.min = shape.min;
    if (shape.max !== undefined) spec.max = shape.max;
    if (shape.step !== undefined) spec.step = shape.step;
    if (paramDefaultProblem(spec) !== undefined) continue;
    seen.add(key);
    out.push(spec);
  }
  return out;
}
