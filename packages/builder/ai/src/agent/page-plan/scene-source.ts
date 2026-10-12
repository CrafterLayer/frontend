import type { SectionCheckCode, SectionCheckIssue } from './types';

/**
 * A region script as the scene checker reads it (check-scene.ts).
 *
 * Not a parser: just enough lexing that a rule never matches inside a string,
 * a template's text, a comment or a regex. `bare` is the code with all of
 * those blanked to spaces — the same length and the same lines, so an index in
 * `bare` is an index in the code — and `literals` are the strings it held,
 * where they stood, for the rules that read string arguments (a selector, a
 * library key, an address). Quote characters stay in `bare`, so a bracket in
 * a string never unbalances a call.
 */

export interface SceneLiteral {
  /** The index of the opening quote (a template chunk: of the backtick or the `}` before it). */
  readonly start: number;
  /** The index just past the closing quote, or where an unterminated string stopped. */
  readonly end: number;
  /** The text between the quotes as written, escapes kept. A template gives each static chunk. */
  readonly text: string;
}

export interface SceneSource {
  readonly code: string;
  readonly bare: string;
  readonly literals: readonly SceneLiteral[];
}

/** After one of these a `/` starts a regex; after anything else it divides. */
const BEFORE_REGEX = '(,=:[!&|?{};+-*%<>~^';
const KEYWORD_BEFORE_REGEX =
  /(?:^|[^\w$])(?:return|typeof|case|do|else|in|of|new|delete|void|throw|yield|await)$/u;

function regexAllowed(out: readonly string[], at: number): boolean {
  let cursor = at - 1;
  while (cursor >= 0 && /\s/u.test(out[cursor] ?? '')) cursor -= 1;
  if (cursor < 0) return true;
  const previous = out[cursor] ?? '';
  if (previous !== '' && BEFORE_REGEX.includes(previous)) return true;
  return KEYWORD_BEFORE_REGEX.test(out.slice(Math.max(0, cursor - 9), cursor + 1).join(''));
}

/** Read `code` into its blanked form and its string literals. Linear, never throws. */
export function readSceneSource(code: string): SceneSource {
  // UTF-16 units, as every index into `code` counts them.
  const out = code.split('');
  const length = out.length;
  const literals: SceneLiteral[] = [];
  /** Brace depth at each open `${`: a `}` at that depth resumes the template's text. */
  const templates: number[] = [];
  let depth = 0;

  const blank = (from: number, to: number): void => {
    for (let index = from; index < to && index < length; index += 1) {
      if (out[index] !== '\n') out[index] = ' ';
    }
  };
  const char = (index: number): string => out[index] ?? '';

  /** Template text from `from` to its closing backtick or next `${`; returns where code resumes. */
  const templateText = (from: number): number => {
    let index = from;
    while (index < length) {
      const current = char(index);
      if (current === '\\') {
        index += 2;
        continue;
      }
      if (current === '`' || (current === '$' && char(index + 1) === '{')) {
        literals.push({ start: from - 1, end: index + 1, text: code.slice(from, index) });
        blank(from, index);
        if (current === '`') return index + 1;
        templates.push(depth);
        return index + 2;
      }
      index += 1;
    }
    literals.push({ start: from - 1, end: length, text: code.slice(from) });
    blank(from, length);
    return length;
  };

  let index = 0;
  while (index < length) {
    const current = char(index);
    const next = char(index + 1);
    if (current === '/' && next === '/') {
      const end = code.indexOf('\n', index);
      const stop = end === -1 ? length : end;
      blank(index, stop);
      index = stop;
    } else if (current === '/' && next === '*') {
      const end = code.indexOf('*/', index + 2);
      const stop = end === -1 ? length : end + 2;
      blank(index, stop);
      index = stop;
    } else if (current === "'" || current === '"') {
      let cursor = index + 1;
      while (cursor < length && char(cursor) !== current && char(cursor) !== '\n') {
        cursor += char(cursor) === '\\' ? 2 : 1;
      }
      const closed = char(cursor) === current;
      literals.push({
        start: index,
        end: closed ? cursor + 1 : cursor,
        text: code.slice(index + 1, cursor),
      });
      blank(index + 1, cursor);
      index = closed ? cursor + 1 : cursor;
    } else if (current === '`') {
      index = templateText(index + 1);
    } else if (current === '/' && regexAllowed(out, index)) {
      let cursor = index + 1;
      let inClass = false;
      while (cursor < length && char(cursor) !== '\n') {
        const at = char(cursor);
        if (at === '\\') {
          cursor += 2;
          continue;
        }
        if (at === '[') inClass = true;
        else if (at === ']') inClass = false;
        else if (at === '/' && !inClass) break;
        cursor += 1;
      }
      if (char(cursor) === '/') {
        blank(index + 1, cursor);
        index = cursor + 1;
      } else {
        // Not a regex after all (a line ended first): read it as a division.
        index += 1;
      }
    } else if (current === '{') {
      depth += 1;
      index += 1;
    } else if (current === '}') {
      if (templates.length > 0 && templates[templates.length - 1] === depth) {
        templates.pop();
        index = templateText(index + 1);
      } else {
        depth -= 1;
        index += 1;
      }
    } else {
      index += 1;
    }
  }
  return { code, bare: out.join(''), literals };
}

/** The 1-based line of `index` in `code`. */
export function lineOf(code: string, index: number): number {
  let line = 1;
  for (let cursor = code.indexOf('\n'); cursor !== -1 && cursor < index;) {
    line += 1;
    cursor = code.indexOf('\n', cursor + 1);
  }
  return line;
}

/** The index of the `)` that closes the `(` at `open` in `bare`, or the end of the code. */
export function closingParen(bare: string, open: number): number {
  let depth = 0;
  for (let index = open; index < bare.length; index += 1) {
    const current = bare[index];
    if (current === '(') depth += 1;
    else if (current === ')') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return bare.length;
}

/** The literals that stand between `from` and `to` (a call's parentheses). */
export function literalsWithin(
  source: SceneSource,
  from: number,
  to: number,
): readonly SceneLiteral[] {
  return source.literals.filter(({ start }) => start > from && start < to);
}

// ── What every scene rule shares ─────────────────────────────────────────────

function at(source: SceneSource, index: number): { readonly path: string } {
  return { path: `js line ${String(lineOf(source.code, index))}` };
}

export function finding(
  code: SectionCheckCode,
  message: string,
  source?: SceneSource,
  index?: number,
): SectionCheckIssue {
  return source === undefined || index === undefined
    ? { code, message }
    : { code, message, ...at(source, index) };
}

/** Every match of a global `pattern` in the blanked code. */
export function matchesOf(source: SceneSource, pattern: RegExp): readonly RegExpExecArray[] {
  return [...source.bare.matchAll(pattern)];
}

/** The literal a call's first argument is, when it is one (`fn('click', …)` → `click`). */
export function firstLiteralArgument(source: SceneSource, open: number): SceneLiteral | undefined {
  const first = literalsWithin(source, open, closingParen(source.bare, open))[0];
  if (first === undefined) return undefined;
  return source.bare.slice(open + 1, first.start).trim() === '' ? first : undefined;
}

/** A dotted chain ending the text, and the one character before it. */
const CHAIN_END = /(^|[^\w$.])((?:[\w$]+\s*\.\s*)+)$/u;
const PAGE_TARGETS = new Set([
  '',
  'window',
  'globalThis',
  'self',
  'document',
  'window.document',
  'document.body',
  'document.documentElement',
]);

/**
 * What the call whose name starts at `index` is made on: `''` bare (the
 * window), `'?'` an expression (`f().x`), else the dotted chain (`ck.root`).
 */
export function receiverOf(bare: string, index: number): string {
  const before = bare.slice(Math.max(0, index - 80), index);
  if (!/\.\s*$/u.test(before)) return '';
  const chain = CHAIN_END.exec(before);
  if (chain === null || chain[1] === ')' || chain[1] === ']') return '?';
  return (chain[2] ?? '').replace(/\s+/gu, '').replace(/\.$/u, '');
}

/** The page itself — the window, the document, its body or root — not the region. */
export function isPageTarget(receiver: string): boolean {
  return PAGE_TARGETS.has(receiver);
}
