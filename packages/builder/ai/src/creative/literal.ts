/*
  A data-only reader for JavaScript literals inside authored scene code (creative agent,
  2026-10-12).

  Character memory learns a story's cast from the scene the Agent wrote — the array passed to
  `s.lib.dialogue.cast([...])`. That text is JavaScript, not JSON (unquoted keys, single quotes,
  trailing commas, hex colours), so JSON.parse refuses it; evaluating it would run model-authored
  code. This reader accepts exactly the literal subset — objects, arrays, strings, numbers,
  booleans, null — and returns undefined for anything else (identifiers, calls, templates with
  substitutions, spreads), so a cast that refers to variables is skipped, never executed.
*/

export type LiteralValue =
  | string
  | number
  | boolean
  | null
  | readonly LiteralValue[]
  | { readonly [key: string]: LiteralValue };

const MAX_DEPTH = 8;
const MAX_LENGTH = 32_000;

class Reader {
  private at = 0;

  constructor(private readonly text: string) {}

  private fail(): never {
    throw new SyntaxError('not a literal');
  }

  private space(): void {
    for (;;) {
      const rest = this.text.slice(this.at);
      const blank = /^(?:\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/)/u.exec(rest);
      if (blank === null) return;
      this.at += blank[0].length;
    }
  }

  private peek(): string {
    return this.text[this.at] ?? '';
  }

  value(depth: number): LiteralValue {
    if (depth > MAX_DEPTH) this.fail();
    this.space();
    const c = this.peek();
    if (c === '[') return this.array(depth);
    if (c === '{') return this.object(depth);
    if (c === '"' || c === "'" || c === '`') return this.string();
    const rest = this.text.slice(this.at);
    const number = /^-?(?:0x[0-9a-f]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?|\.\d+)/iu.exec(rest);
    if (number !== null) {
      this.at += number[0].length;
      const parsed = Number(number[0]);
      if (!Number.isFinite(parsed)) this.fail();
      return parsed;
    }
    const word = /^(?:true|false|null)\b/u.exec(rest);
    if (word !== null) {
      this.at += word[0].length;
      return word[0] === 'null' ? null : word[0] === 'true';
    }
    return this.fail();
  }

  private string(): string {
    const quote = this.peek();
    this.at += 1;
    let out = '';
    for (;;) {
      const c = this.text[this.at];
      if (c === undefined) this.fail();
      this.at += 1;
      if (c === quote) return out;
      if (quote === '`' && c === '$' && this.peek() === '{') this.fail();
      if (c === '\\') {
        const next = this.text[this.at] ?? '';
        this.at += 1;
        const escapes: Readonly<Record<string, string>> = { n: '\n', t: '\t', r: '', '0': '' };
        out += escapes[next] ?? next;
      } else out += c;
    }
  }

  private array(depth: number): LiteralValue[] {
    this.at += 1;
    const items: LiteralValue[] = [];
    for (;;) {
      this.space();
      if (this.peek() === ']') {
        this.at += 1;
        return items;
      }
      items.push(this.value(depth + 1));
      this.space();
      if (this.peek() === ',') this.at += 1;
      else if (this.peek() !== ']') this.fail();
    }
  }

  private key(): string {
    this.space();
    const c = this.peek();
    if (c === '"' || c === "'") return this.string();
    const name = /^[\p{L}_$][\p{L}\p{N}_$]*/u.exec(this.text.slice(this.at));
    if (name !== null) {
      this.at += name[0].length;
      return name[0];
    }
    const number = /^\d+/u.exec(this.text.slice(this.at));
    if (number !== null) {
      this.at += number[0].length;
      return number[0];
    }
    return this.fail();
  }

  private object(depth: number): Record<string, LiteralValue> {
    this.at += 1;
    const out: Record<string, LiteralValue> = Object.create(null) as Record<string, LiteralValue>;
    for (;;) {
      this.space();
      if (this.peek() === '}') {
        this.at += 1;
        return out;
      }
      const key = this.key();
      this.space();
      if (this.peek() !== ':') this.fail();
      this.at += 1;
      const value = this.value(depth + 1);
      if (key !== '__proto__' && key !== 'constructor' && key !== 'prototype') out[key] = value;
      this.space();
      if (this.peek() === ',') this.at += 1;
      else if (this.peek() !== '}') this.fail();
    }
  }

  get offset(): number {
    return this.at;
  }
}

/** Read one literal from the start of `text`; undefined when it is not a pure literal. */
export function readLiteral(text: string): { value: LiteralValue; length: number } | undefined {
  if (typeof text !== 'string' || text.length === 0) return undefined;
  const reader = new Reader(text.slice(0, MAX_LENGTH));
  try {
    const value = reader.value(0);
    return { value, length: reader.offset };
  } catch {
    return undefined;
  }
}

/** Every literal passed as the first argument of `<anything>.<method>(` in the code. */
export function literalArgumentsOf(code: string, method: string): LiteralValue[] {
  const found: LiteralValue[] = [];
  if (typeof code !== 'string' || !/^[A-Za-z_$][\w$]*$/u.test(method)) return found;
  const call = new RegExp(`\\.\\s*${method}\\s*\\(`, 'gu');
  for (const match of code.slice(0, 400_000).matchAll(call)) {
    const literal = readLiteral(code.slice(match.index + match[0].length));
    if (literal !== undefined) found.push(literal.value);
    if (found.length >= 16) break;
  }
  return found;
}
