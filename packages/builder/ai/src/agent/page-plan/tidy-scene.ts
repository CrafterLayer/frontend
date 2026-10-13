import { STUDIO_LIB_KEYS, type JsonValue } from '@craftkit/builder-schema';

import {
  closingParen,
  firstLiteralArgument,
  matchesOf,
  readSceneSource,
  receiverOf,
  type SceneSource,
} from './scene-source';
import { isRecord, issuesOf, type TidyContext, type TidyFixer } from './tidy-shared';
import type { LandedSection } from './types';

/*
  Code repairs on a written section's SCENE (tidy-section.ts, 2026-10-13):
  edits to the js that do exactly what the scene check asks, read off the
  same blanked source the check reads (scene-source.ts), so nothing is ever
  inserted inside a string, a comment or a regex:

  - a library the code uses as s.lib.<key> is added to its one literal
    ck.scene({libs:[…]});
  - a jsParams setting the code never defaults gets its region value as the
    default in ck.params({…});
  - an app.ticker loop is guarded with if(!ck.reducedMotion), when every loop
    in the code is one;
  - a listener with a named handler, an interval or an observer kept in a
    variable, and a requestAnimationFrame loop whose id is kept at the top, are
    released in ck.onDispose right where they are made.

  Whatever needs a reading of what the scene is FOR — an unknown library, a
  lookup of an element the tree lacks, a level that cannot be finished, an
  inline handler — is left for the writer.
*/

/** The code with `text` inserted at each index (any order), or the same code when there are none. */
function insertAll(code: string, inserts: readonly (readonly [number, string])[]): string {
  return [...inserts]
    .sort(([one], [two]) => two - one)
    .reduce((next, [at, text]) => `${next.slice(0, at)}${text}${next.slice(at)}`, code);
}

/** The first non-space index at or after `from` in the blanked code. */
function nextSolid(bare: string, from: number): number {
  let index = from;
  while (index < bare.length && /\s/u.test(bare[index] ?? '')) index += 1;
  return index;
}

/** The last non-space character before `index` in the blanked code ('' at the start). */
function previousSolid(bare: string, index: number): string {
  let cursor = index - 1;
  while (cursor >= 0 && /\s/u.test(bare[cursor] ?? '')) cursor -= 1;
  return cursor < 0 ? '' : (bare[cursor] ?? '');
}

/** A call or declaration that ends its statement at `close`: what follows starts a new one. */
function endsStatement(bare: string, close: number): boolean {
  const after = nextSolid(bare, close + 1);
  return (
    after >= bare.length ||
    bare[after] === ';' ||
    bare[after] === '}' ||
    bare.slice(close + 1, after).includes('\n')
  );
}

function jsOf(section: LandedSection): string | undefined {
  return typeof section.js === 'string' && section.js.trim() !== '' ? section.js : undefined;
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/u;

// ── scene-lib: list what s.lib uses ──────────────────────────────────────────

const LIBS_LIST = /\blibs\s*:\s*\[/gu;
const SCENE_CALL = /\bck\s*\.\s*scene\s*\(/gu;
const LIST_KEY = /List '([\w$]+)' in the scene's libs/u;

function fixLibs({ section, issues }: TidyContext): LandedSection | undefined {
  const code = jsOf(section);
  const keys = issuesOf(issues, 'scene-lib', 'List ').flatMap(({ message }) => {
    const key = LIST_KEY.exec(message)?.[1];
    return key !== undefined && (STUDIO_LIB_KEYS as readonly string[]).includes(key) ? [key] : [];
  });
  if (code === undefined || keys.length === 0) return undefined;
  const source = readSceneSource(code);
  const quoted = [...new Set(keys)].map((key) => `'${key}'`).join(',');
  const lists = matchesOf(source, LIBS_LIST);
  if (lists.length > 1) return undefined;
  const list = lists[0];
  if (list !== undefined) {
    const open = list.index + list[0].length;
    const empty = source.bare[nextSolid(source.bare, open)] === ']';
    return { ...section, js: insertAll(code, [[open, empty ? quoted : `${quoted},`]]) };
  }
  const calls = matchesOf(source, SCENE_CALL);
  const call = calls[0];
  if (calls.length !== 1 || call === undefined) return undefined;
  const open = call.index + call[0].length;
  const first = nextSolid(source.bare, open);
  if (source.bare[first] === ')')
    return { ...section, js: insertAll(code, [[first, `{libs:[${quoted}]}`]]) };
  if (source.bare[first] !== '{') return undefined;
  const empty = source.bare[nextSolid(source.bare, first + 1)] === '}';
  return { ...section, js: insertAll(code, [[first + 1, `libs:[${quoted}]${empty ? '' : ','}`]]) };
}

// ── scene-params: default every region setting ───────────────────────────────

const PARAMS_CALL = /\bck\s*\.\s*params\s*\(\s*/u;

function fixParams({ section, issues }: TidyContext): LandedSection | undefined {
  const code = jsOf(section);
  const asked = issuesOf(issues, 'scene-params', 'Give ');
  const params: JsonValue | undefined = section.jsParams;
  if (code === undefined || asked.length === 0 || !isRecord(params)) return undefined;
  const keys = asked.flatMap(({ message }) =>
    [...(message.split(' a default')[0] ?? '').matchAll(/'([^']+)'/gu)].map(([, key = '']) => key),
  );
  const source = readSceneSource(code);
  const call = PARAMS_CALL.exec(source.bare);
  if (call === null || keys.length === 0) return undefined;
  const brace = call.index + call[0].length;
  if (source.bare[brace] !== '{') return undefined;
  const entries = keys.flatMap((key) => {
    const value = params[key];
    if (value === undefined) return [];
    return [`${IDENTIFIER.test(key) ? key : JSON.stringify(key)}:${JSON.stringify(value)}`];
  });
  if (entries.length === 0) return undefined;
  const empty = source.bare[nextSolid(source.bare, brace + 1)] === '}';
  return {
    ...section,
    js: insertAll(code, [[brace + 1, `${entries.join(',')}${empty ? '' : ','}`]]),
  };
}

// ── scene-guard: calm a ticker loop under reduced motion ─────────────────────

const TICKER_ADD = /\bticker\s*\.\s*add\s*\(/gu;
const CHAIN_START = /(?:[A-Za-z_$][\w$]*\s*\.\s*)*$/u;
const STATEMENT_BEFORE = new Set(['', ';', '{', '}', ')']);

function fixMotionGuard({ section, issues }: TidyContext): LandedSection | undefined {
  const code = jsOf(section);
  if (code === undefined || issuesOf(issues, 'scene-guard', 'Guard the animation').length === 0)
    return undefined;
  const source = readSceneSource(code);
  const { bare } = source;
  // Every loop must be one this can guard: a frame loop of its own would stay unguarded.
  if (/\breducedMotion\b|\brequestAnimationFrame\b/u.test(bare)) return undefined;
  const inserts: [number, string][] = [];
  for (const match of matchesOf(source, TICKER_ADD)) {
    const chain = CHAIN_START.exec(bare.slice(Math.max(0, match.index - 120), match.index));
    const start = chain === null ? match.index : match.index - chain[0].length;
    const before = previousSolid(bare, start);
    const keyword = /\belse\s*$/u.test(bare.slice(0, start));
    if (!STATEMENT_BEFORE.has(before) && !keyword) return undefined;
    inserts.push([start, 'if(!ck.reducedMotion)']);
  }
  return inserts.length === 0 ? undefined : { ...section, js: insertAll(code, inserts) };
}

// ── scene-cleanup: release what outlives the stage ───────────────────────────

const ADD_LISTENER = /(?<![\w$])addEventListener\s*\(/gu;
const REMOVE_LISTENER = /(?<![\w$])removeEventListener\s*\(/gu;
const INTERVAL = /(?<![\w$])setInterval\s*\(/gu;
const OBSERVER =
  /\bnew\s+(?:IntersectionObserver|ResizeObserver|MutationObserver|PerformanceObserver)\s*\(/gu;
const DECLARED = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*$/u;
const RAF_KEPT = /(?<![\w$.])([A-Za-z_$][\w$]*)\s*=\s*requestAnimationFrame\s*\(/u;

/** The arguments of the call whose `(` is at `open`, split at its top-level commas, as blanked text. */
function argumentsOf(bare: string, open: number): readonly string[] {
  const close = closingParen(bare, open);
  const parts: string[] = [];
  let depth = 0;
  let start = open + 1;
  for (let index = open + 1; index < close; index += 1) {
    const character = bare[index];
    if (character === '(' || character === '[' || character === '{') depth += 1;
    else if (character === ')' || character === ']' || character === '}') depth -= 1;
    else if (character === ',' && depth === 0) {
      parts.push(bare.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(bare.slice(start, close).trim());
  return parts;
}

/** `removeEventListener(type, fn[, true])` for each listener whose removal the code lacks. */
function listenerReleases(source: SceneSource): readonly [number, string][] | undefined {
  const { bare } = source;
  if (/\b(?:signal|once)\s*:/u.test(bare)) return [];
  const removedTypes = matchesOf(source, REMOVE_LISTENER).map(
    (match) => firstLiteralArgument(source, match.index + match[0].length - 1)?.text,
  );
  if (removedTypes.includes(undefined)) return [];
  const inserts: [number, string][] = [];
  for (const match of matchesOf(source, ADD_LISTENER)) {
    const open = match.index + match[0].length - 1;
    const type = firstLiteralArgument(source, open)?.text;
    if (type !== undefined && removedTypes.includes(type)) continue;
    const receiver = receiverOf(bare, match.index);
    const [, handler = '', options = ''] = argumentsOf(bare, open);
    const close = closingParen(bare, open);
    const capture = options === 'true' || /\bcapture\s*:\s*(?:true|!0)\b/u.test(options);
    const plain =
      options === '' ||
      options === 'false' ||
      /^\{\s*passive\s*:\s*(?:true|false)\s*\}$/u.test(options);
    if (
      type === undefined ||
      receiver === '?' ||
      !IDENTIFIER.test(handler) ||
      !(plain || capture) ||
      !endsStatement(bare, close)
    ) {
      return undefined;
    }
    const on = receiver === '' ? '' : `${receiver}.`;
    inserts.push([
      close + 1,
      `;ck.onDispose(()=>${on}removeEventListener('${type}',${handler}${capture ? ',true' : ''}))`,
    ]);
  }
  return inserts;
}

/** `clearInterval(id)` / `observer.disconnect()` after each kept interval or observer the code never ends. */
function keptReleases(
  source: SceneSource,
  pattern: RegExp,
  release: (name: string) => string,
): readonly [number, string][] | undefined {
  const inserts: [number, string][] = [];
  for (const match of matchesOf(source, pattern)) {
    const name = DECLARED.exec(source.bare.slice(0, match.index))?.[1];
    const close = closingParen(source.bare, match.index + match[0].length - 1);
    if (name === undefined || !endsStatement(source.bare, close)) return undefined;
    inserts.push([close + 1, `;ck.onDispose(()=>${release(name)})`]);
  }
  return inserts;
}

/** The brace depth at `index` in the blanked code. */
function depthAt(bare: string, index: number): number {
  let depth = 0;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (bare[cursor] === '{') depth += 1;
    else if (bare[cursor] === '}') depth -= 1;
  }
  return depth;
}

/** A frame loop whose id is kept in a top-level variable: cancelled once, at the end of the code. */
function frameRelease(source: SceneSource): readonly [number, string][] | undefined {
  const { bare } = source;
  const kept = RAF_KEPT.exec(bare);
  if (kept === null) return /\brequestAnimationFrame\b/u.test(bare) ? undefined : [];
  const name = kept[1] ?? '';
  const declared = new RegExp(`\\b(?:let|var)\\s+${name.replace(/\$/gu, '\\$')}\\b`, 'u').exec(
    bare,
  );
  const returns = [...bare.matchAll(/\breturn\b/gu)].some(
    (match) => depthAt(bare, match.index) === 0,
  );
  if (declared === null || depthAt(bare, declared.index) !== 0 || returns) return undefined;
  return [[source.code.length, `\nck.onDispose(()=>cancelAnimationFrame(${name}));`]];
}

function fixCleanup({ section, issues }: TidyContext): LandedSection | undefined {
  const code = jsOf(section);
  if (code === undefined || issuesOf(issues, 'scene-cleanup').length === 0) return undefined;
  const source = readSceneSource(code);
  const { bare } = source;
  // Each kind on its own: one listener this cannot release leaves every listener to the writer.
  const parts = [
    listenerReleases(source),
    /\bclearInterval\s*\(/u.test(bare)
      ? []
      : keptReleases(source, INTERVAL, (id) => `clearInterval(${id})`),
    /\.\s*disconnect\s*\(/u.test(bare)
      ? []
      : keptReleases(source, OBSERVER, (name) => `${name}.disconnect()`),
    /\bcancelAnimationFrame\s*\(/u.test(bare) ? [] : frameRelease(source),
  ];
  const inserts = parts.flatMap((part) => part ?? []);
  return inserts.length === 0 ? undefined : { ...section, js: insertAll(code, inserts) };
}

/** The scene repairs, in the order the build runs them. */
export const SCENE_FIXERS: readonly TidyFixer[] = Object.freeze([
  { name: 'scene-libs', codes: ['scene-lib'], fix: fixLibs },
  { name: 'scene-params', codes: ['scene-params'], fix: fixParams },
  { name: 'scene-motion-guard', codes: ['scene-guard'], fix: fixMotionGuard },
  { name: 'scene-cleanup', codes: ['scene-cleanup'], fix: fixCleanup },
]);
