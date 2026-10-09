/**
 * Undo the wrappers a model puts around a script before the sandbox sees it.
 *
 * Models answer "write a script" with markdown fences, a `js` language line,
 * `export default`, or the whole body inside `async () => { … }` (which would
 * otherwise only DEFINE a function and change nothing). The sandbox runs the
 * code as a function body, so each wrapper is peeled off and the body kept.
 *
 * The idea comes from Cloudflare's `normalizeCode` in `@cloudflare/codemode`
 * (MIT); no code was copied. Pure: no engine, no kernel.
 */

export interface NormalizedScript {
  /** The function body the sandbox runs. */
  readonly code: string;
  /** Lines removed above the body: add it to a sandbox line to point into the model's text. */
  readonly lineOffset: number;
}

const FENCE_OPEN = /^\s*```[\w-]*[^\S\n]*\n/u;
const FENCE_CLOSE = /\n?[^\S\n]*```\s*$/u;
const LANGUAGE_LINE = /^\s*(?:js|javascript)[^\S\n]*\n/iu;
const EXPORT_DEFAULT = /^\s*export\s+default\s+/u;
/** `async () => {`, `(ck) => {`, `async function main(ck) {`, `function () {`, optional `(` for an IIFE. */
const WRAPPER_HEAD =
  /^\s*\(?\s*(?:async\s+)?(?:function\s*[\w$]*\s*\([^)]*\)|\([^)]*\)\s*=>|[\w$]+\s*=>)\s*\{/u;
/** `async () => expression` (no braces). */
const ARROW_EXPRESSION = /^\s*(?:async\s+)?(?:\([^)]*\)|[\w$]+)\s*=>\s*(?!\{)/u;
/** What may follow the body's closing brace: `)`, `()`, `)()`, `();`, `;`. */
const WRAPPER_TAIL = /^\s*\)?\s*(?:\(\s*(?:ck)?\s*\))?\s*\)?\s*;?\s*$/u;

function countNewlines(text: string): number {
  let count = 0;
  for (const char of text) if (char === '\n') count += 1;
  return count;
}

/**
 * Index of the `}` that closes the `{` at `open`, skipping strings, template
 * literals and comments; -1 when it never closes.
 */
function matchingBrace(source: string, open: number): number {
  let depth = 0;
  let index = open;
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (char === '/' && next === '/') {
      const end = source.indexOf('\n', index);
      index = end === -1 ? source.length : end;
      continue;
    }
    if (char === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2);
      index = end === -1 ? source.length : end + 2;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      index += 1;
      while (index < source.length && source[index] !== char) {
        index += source[index] === '\\' ? 2 : 1;
      }
      index += 1;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
    index += 1;
  }
  return -1;
}

/** Peel one wrapping function, if the WHOLE text is one. */
function unwrapFunction(source: string): { code: string; removedLines: number } | undefined {
  const head = WRAPPER_HEAD.exec(source);
  if (head !== null) {
    const open = head[0].length - 1;
    const close = matchingBrace(source, open);
    if (close === -1 || !WRAPPER_TAIL.test(source.slice(close + 1))) return undefined;
    let body = source.slice(open + 1, close);
    let removedLines = countNewlines(source.slice(0, open + 1));
    // The body usually starts on the next line; drop that first newline so line 1 stays line 1.
    const lead = /^[^\S\n]*\n/u.exec(body);
    if (lead !== null) {
      body = body.slice(lead[0].length);
      removedLines += 1;
    }
    return { code: body.replace(/\s+$/u, ''), removedLines };
  }
  const arrow = ARROW_EXPRESSION.exec(source);
  if (arrow !== null) {
    const expression = source.slice(arrow[0].length).replace(/;?\s*$/u, '');
    if (expression === '') return undefined;
    return {
      code: `return ${expression};`,
      removedLines: countNewlines(source.slice(0, arrow[0].length)),
    };
  }
  return undefined;
}

/** Normalize a script and report how many lines were removed above the body. */
export function normalizeScriptSource(input: string): NormalizedScript {
  let code = input.replace(/\r\n?/gu, '\n');
  let lineOffset = 0;

  const fence = FENCE_OPEN.exec(code);
  if (fence !== null && FENCE_CLOSE.test(code.slice(fence[0].length))) {
    lineOffset += countNewlines(fence[0]);
    code = code.slice(fence[0].length).replace(FENCE_CLOSE, '');
  }

  const language = LANGUAGE_LINE.exec(code);
  if (language !== null) {
    lineOffset += countNewlines(language[0]);
    code = code.slice(language[0].length);
  }

  // Blank lines above the first statement count too.
  const leading = /^\s*/u.exec(code)?.[0] ?? '';
  lineOffset += countNewlines(leading);
  code = code.slice(leading.length);

  const exported = EXPORT_DEFAULT.exec(code);
  if (exported !== null) {
    lineOffset += countNewlines(exported[0]);
    code = code.slice(exported[0].length);
  }

  const unwrapped = unwrapFunction(code);
  if (unwrapped !== undefined) {
    lineOffset += unwrapped.removedLines;
    code = unwrapped.code;
  }

  return { code: code.replace(/\s+$/u, ''), lineOffset };
}

/** Strip fences, a `js`/`javascript` line, `export default` and a wrapping function; keep the body. */
export function normalizeScriptCode(input: string): string {
  return normalizeScriptSource(input).code;
}
