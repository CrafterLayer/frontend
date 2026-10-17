export interface ParseError {
  line: number;
  message: string;
}

export type JsonPath = readonly (string | number)[];

export interface ParsedJson {
  value: unknown;
  /** Exact value token when present, otherwise its nearest containing token. */
  lineAt(path: JsonPath): number;
}

export type StrictParseResult =
  { ok: true; parsed: ParsedJson } | { ok: false; errors: ParseError[] };

// Parser-only safety margin for arbitrary text. Law J caps every valid document
// JSON value at MAX_JSON_DEPTH (128), so a valid projection cannot reach 256.
const MAX_DEPTH = 256;

const pathKey = (path: JsonPath): string => JSON.stringify(path);

class StrictParseFailure extends Error {
  readonly detail: ParseError;

  constructor(detail: ParseError) {
    super(detail.message);
    this.name = 'StrictParseFailure';
    this.detail = detail;
  }
}

/** Strict JSON with duplicate rejection and source lines; no native parser shortcuts. */
export function strictParse(text: unknown): StrictParseResult {
  if (typeof text !== 'string') {
    return { ok: false, errors: [{ line: 1, message: 'Expected JSON text.' }] };
  }

  const reader = new StrictJsonReader(text);
  try {
    return { ok: true, parsed: reader.read() };
  } catch (error) {
    if (error instanceof StrictParseFailure) {
      return { ok: false, errors: [error.detail] };
    }
    return {
      ok: false,
      errors: [{ line: reader.currentLine(), message: 'The JSON text could not be read.' }],
    };
  }
}

class StrictJsonReader {
  private index = 0;
  private line = 1;
  private readonly locations = new Map<string, number>();

  constructor(private readonly text: string) {}

  currentLine(): number {
    return this.line;
  }

  read(): ParsedJson {
    this.skipWhitespace();
    if (this.peek() === undefined) {
      this.fail(1, 'Expected a JSON value.');
    }
    const value = this.readValue([], 0);
    this.skipWhitespace();
    const trailing = this.peek();
    if (trailing !== undefined) {
      this.fail(this.line, `Unexpected token ${this.describe(trailing)} after the JSON value.`);
    }

    return {
      value,
      lineAt: (path) => this.findLine(path),
    };
  }

  private findLine(path: JsonPath): number {
    for (let length = path.length; length >= 0; length -= 1) {
      const found = this.locations.get(pathKey(path.slice(0, length)));
      if (found !== undefined) {
        return found;
      }
    }
    return 1;
  }

  private readValue(path: JsonPath, depth: number): unknown {
    this.skipWhitespace();
    const tokenLine = this.line;
    this.locations.set(pathKey(path), tokenLine);
    const token = this.peek();

    if (token === '{') {
      this.assertDepth(depth, tokenLine);
      return this.readObject(path, depth, tokenLine);
    }
    if (token === '[') {
      this.assertDepth(depth, tokenLine);
      return this.readArray(path, depth, tokenLine);
    }
    if (token === '"') {
      return this.readString(tokenLine);
    }
    if (token === '-' || this.isDigit(token)) {
      return this.readNumber(tokenLine);
    }
    if (token === 't') {
      this.readLiteral('true', tokenLine);
      return true;
    }
    if (token === 'f') {
      this.readLiteral('false', tokenLine);
      return false;
    }
    if (token === 'n') {
      this.readLiteral('null', tokenLine);
      return null;
    }

    this.fail(tokenLine, `Unexpected token ${this.describe(token)}; expected a JSON value.`);
  }

  private readObject(path: JsonPath, depth: number, openingLine: number): Record<string, unknown> {
    this.index += 1;
    const output: Record<string, unknown> = {};
    Object.setPrototypeOf(output, null);
    const keys = new Set<string>();

    this.skipWhitespace();
    if (this.peek() === '}') {
      this.index += 1;
      return output;
    }
    if (this.peek() === undefined) {
      this.fail(openingLine, 'Unterminated object token.');
    }

    for (;;) {
      this.skipWhitespace();
      const keyLine = this.line;
      if (this.peek() !== '"') {
        this.fail(keyLine, `Expected an object key, found ${this.describe(this.peek())}.`);
      }
      const key = this.readString(keyLine);
      if (keys.has(key)) {
        this.fail(keyLine, `Duplicate object key ${JSON.stringify(key)}.`);
      }
      keys.add(key);

      this.skipWhitespace();
      if (this.peek() !== ':') {
        this.fail(
          this.peek() === undefined ? keyLine : this.line,
          `Expected ':' after object key ${JSON.stringify(key)}.`,
        );
      }
      const colonLine = this.line;
      this.index += 1;
      this.skipWhitespace();
      if (this.peek() === undefined) {
        this.fail(colonLine, `Expected a value after object key ${JSON.stringify(key)}.`);
      }
      const value = this.readValue([...path, key], depth + 1);
      Object.defineProperty(output, key, {
        configurable: true,
        enumerable: true,
        value,
        writable: true,
      });

      this.skipWhitespace();
      const separator = this.peek();
      if (separator === '}') {
        this.index += 1;
        return output;
      }
      if (separator === undefined) {
        this.fail(openingLine, 'Unterminated object token.');
      }
      if (separator !== ',') {
        this.fail(this.line, `Expected ',' or '}', found ${this.describe(separator)}.`);
      }
      const commaLine = this.line;
      this.index += 1;
      this.skipWhitespace();
      if (this.peek() === undefined || this.peek() === '}') {
        this.fail(commaLine, 'A JSON object cannot end with a trailing comma.');
      }
    }
  }

  private readArray(path: JsonPath, depth: number, openingLine: number): unknown[] {
    this.index += 1;
    const output: unknown[] = [];

    this.skipWhitespace();
    if (this.peek() === ']') {
      this.index += 1;
      return output;
    }
    if (this.peek() === undefined) {
      this.fail(openingLine, 'Unterminated array token.');
    }

    for (;;) {
      output.push(this.readValue([...path, output.length], depth + 1));
      this.skipWhitespace();
      const separator = this.peek();
      if (separator === ']') {
        this.index += 1;
        return output;
      }
      if (separator === undefined) {
        this.fail(openingLine, 'Unterminated array token.');
      }
      if (separator !== ',') {
        this.fail(this.line, `Expected ',' or ']', found ${this.describe(separator)}.`);
      }
      const commaLine = this.line;
      this.index += 1;
      this.skipWhitespace();
      if (this.peek() === undefined || this.peek() === ']') {
        this.fail(commaLine, 'A JSON array cannot end with a trailing comma.');
      }
    }
  }

  private readString(tokenLine: number): string {
    this.index += 1;
    let output = '';

    for (;;) {
      const character = this.peek();
      if (character === undefined) {
        this.fail(tokenLine, 'Unterminated string token.');
      }
      if (character === '"') {
        this.index += 1;
        return output;
      }
      if (character === '\\') {
        output += this.readEscape(tokenLine);
        continue;
      }
      if (character.charCodeAt(0) < 0x20) {
        this.fail(this.line, 'Unescaped control character inside a string token.');
      }
      output += character;
      this.index += 1;
    }
  }

  private readEscape(tokenLine: number): string {
    this.index += 1;
    const escaped = this.peek();
    if (escaped === undefined) {
      this.fail(tokenLine, 'Unterminated string escape.');
    }

    const simple: Record<string, string> = {
      '"': '"',
      '/': '/',
      '\\': '\\',
      b: '\b',
      f: '\f',
      n: '\n',
      r: '\r',
      t: '\t',
    };
    const replacement = simple[escaped];
    if (replacement !== undefined) {
      this.index += 1;
      return replacement;
    }
    if (escaped !== 'u') {
      this.fail(this.line, `Invalid string escape \\${escaped}.`);
    }

    this.index += 1;
    const start = this.index;
    for (let offset = 0; offset < 4; offset += 1) {
      const digit = this.text[start + offset];
      if (digit === undefined || !/[0-9a-fA-F]/u.test(digit)) {
        this.fail(this.line, 'A Unicode escape requires exactly four hexadecimal digits.');
      }
    }
    this.index += 4;
    return String.fromCharCode(Number.parseInt(this.text.slice(start, start + 4), 16));
  }

  private readNumber(tokenLine: number): number {
    const start = this.index;
    if (this.peek() === '-') {
      this.index += 1;
    }

    const firstDigit = this.peek();
    if (firstDigit === '0') {
      this.index += 1;
      if (this.isDigit(this.peek())) {
        this.fail(this.line, 'A JSON number cannot contain a leading zero.');
      }
    } else if (this.isNonZeroDigit(firstDigit)) {
      this.consumeDigits();
    } else {
      this.fail(tokenLine, 'Expected a digit after the minus sign.');
    }

    if (this.peek() === '.') {
      this.index += 1;
      if (!this.isDigit(this.peek())) {
        this.fail(this.line, 'Expected a digit after the decimal point.');
      }
      this.consumeDigits();
    }

    const exponent = this.peek();
    if (exponent === 'e' || exponent === 'E') {
      this.index += 1;
      const sign = this.peek();
      if (sign === '+' || sign === '-') {
        this.index += 1;
      }
      if (!this.isDigit(this.peek())) {
        this.fail(this.line, 'Expected a digit in the exponent.');
      }
      this.consumeDigits();
    }

    return Number(this.text.slice(start, this.index));
  }

  private consumeDigits(): void {
    while (this.isDigit(this.peek())) {
      this.index += 1;
    }
  }

  private readLiteral(literal: 'true' | 'false' | 'null', tokenLine: number): void {
    for (let offset = 0; offset < literal.length; offset += 1) {
      if (this.text[this.index + offset] !== literal[offset]) {
        this.fail(tokenLine, `Invalid token; expected '${literal}'.`);
      }
    }
    this.index += literal.length;
  }

  private assertDepth(depth: number, line: number): void {
    if (depth >= MAX_DEPTH) {
      this.fail(line, `JSON nesting exceeds the supported depth of ${String(MAX_DEPTH)}.`);
    }
  }

  private skipWhitespace(): void {
    for (;;) {
      const character = this.peek();
      if (character === ' ' || character === '\t') {
        this.index += 1;
        continue;
      }
      if (character === '\n') {
        this.index += 1;
        this.line += 1;
        continue;
      }
      if (character === '\r') {
        this.index += this.text[this.index + 1] === '\n' ? 2 : 1;
        this.line += 1;
        continue;
      }
      return;
    }
  }

  private peek(): string | undefined {
    return this.text[this.index];
  }

  private isDigit(value: string | undefined): boolean {
    return value !== undefined && value >= '0' && value <= '9';
  }

  private isNonZeroDigit(value: string | undefined): boolean {
    return value !== undefined && value >= '1' && value <= '9';
  }

  private describe(value: string | undefined): string {
    return value === undefined ? 'end of input' : JSON.stringify(value);
  }

  private fail(line: number, message: string): never {
    throw new StrictParseFailure({ line, message });
  }
}
