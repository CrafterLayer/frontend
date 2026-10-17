/*
  An eval-free compiler for the particle emitter's path expressions (pixi-studio, 2026-10-10).

  Upstream (spd789562/pixi-v8-particle-emitter, behaviors/PathMovement.ts) turned a string such as
  "sin(x / 10) * 20" into a function with `new Function()`. That is refused by a CSP without
  'unsafe-eval' (the Script Studio preview frame) and evaluates config text as code, so the
  vendored copy calls this instead (CRAFTKIT PATCH 2, vendor/particle-emitter/PATCHES.md).

  Grammar (the upstream whitelist, parsed instead of filtered):
    expr    := term (('+' | '-') term)*
    term    := unary (('*' | '/' | '%') unary)*
    unary   := ('-' | '+') unary | power
    power   := primary ('^' unary)?          // '^' and '**' are both exponent
    primary := number | 'x' | CONST | FN '(' expr (',' expr)* ')' | '(' expr ')'
  CONST and FN are Math members from the upstream list. Anything else throws a SyntaxError
  naming the position, and the emitter falls back exactly as it did on a bad expression.
*/

const MATH_CONSTANTS: Readonly<Record<string, number>> = {
  E: Math.E,
  LN2: Math.LN2,
  LN10: Math.LN10,
  LOG2E: Math.LOG2E,
  LOG10E: Math.LOG10E,
  PI: Math.PI,
  SQRT1_2: Math.SQRT1_2,
  SQRT2: Math.SQRT2,
};

type MathFn = (...args: number[]) => number;

const MATH_FUNCTIONS: Readonly<Record<string, MathFn>> = {
  abs: Math.abs,
  acos: Math.acos,
  acosh: Math.acosh,
  asin: Math.asin,
  asinh: Math.asinh,
  atan: Math.atan,
  atanh: Math.atanh,
  atan2: Math.atan2,
  cbrt: Math.cbrt,
  ceil: Math.ceil,
  cos: Math.cos,
  cosh: Math.cosh,
  exp: Math.exp,
  expm1: Math.expm1,
  floor: Math.floor,
  fround: Math.fround,
  hypot: Math.hypot,
  log: Math.log,
  log1p: Math.log1p,
  log10: Math.log10,
  log2: Math.log2,
  max: Math.max,
  min: Math.min,
  pow: Math.pow,
  random: Math.random,
  round: Math.round,
  sign: Math.sign,
  sin: Math.sin,
  sinh: Math.sinh,
  sqrt: Math.sqrt,
  tan: Math.tan,
  tanh: Math.tanh,
};

/** The longest expression accepted; emitter paths are one short formula. */
export const SAFE_EXPRESSION_MAX_LENGTH = 512;

type Node = (x: number) => number;

/**
 * Compile `source` into `(x) => y` without eval. Throws a SyntaxError on anything outside the
 * grammar above (unknown names, member access, strings, assignment, calls on non-Math names).
 */
export function compileSafeExpression(source: string): (x: number) => number {
  if (typeof source !== 'string' || source.length > SAFE_EXPRESSION_MAX_LENGTH) {
    throw new SyntaxError('path expression must be a string of at most 512 characters');
  }
  const text = source;
  let index = 0;

  function fail(message: string): never {
    throw new SyntaxError(`path expression: ${message} at ${String(index)} in "${text}"`);
  }

  function skipSpace(): void {
    while (index < text.length && /\s/u.test(text.charAt(index))) index += 1;
  }

  function peek(): string {
    skipSpace();
    return text.charAt(index);
  }

  function eat(token: string): boolean {
    skipSpace();
    if (text.startsWith(token, index)) {
      index += token.length;
      return true;
    }
    return false;
  }

  function parseNumber(): Node {
    const match = /^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/iu.exec(text.slice(index));
    if (match === null) fail('expected a number');
    index += match[0].length;
    const value = Number(match[0]);
    return function constant(): number {
      return value;
    };
  }

  function parseName(): Node {
    const match = /^[A-Za-z_][A-Za-z0-9_]*/u.exec(text.slice(index));
    if (match === null) fail('expected a name');
    const name = match[0];
    index += name.length;
    if (name === 'x') {
      return function variable(x: number): number {
        return x;
      };
    }
    if (Object.prototype.hasOwnProperty.call(MATH_CONSTANTS, name)) {
      const value = MATH_CONSTANTS[name] ?? 0;
      return function constant(): number {
        return value;
      };
    }
    if (!Object.prototype.hasOwnProperty.call(MATH_FUNCTIONS, name)) fail(`unknown name "${name}"`);
    const fn = MATH_FUNCTIONS[name] as MathFn;
    if (!eat('(')) fail(`"${name}" must be called`);
    const args: Node[] = [];
    if (!eat(')')) {
      do {
        args.push(parseExpression());
      } while (eat(','));
      if (!eat(')')) fail('expected ")"');
    }
    return function call(x: number): number {
      const values: number[] = [];
      for (const arg of args) values.push(arg(x));
      return fn(...values);
    };
  }

  function parsePrimary(): Node {
    const char = peek();
    if (char === '(') {
      index += 1;
      const inner = parseExpression();
      if (!eat(')')) fail('expected ")"');
      return inner;
    }
    if (/[\d.]/u.test(char)) return parseNumber();
    if (/[A-Za-z_]/u.test(char)) return parseName();
    return fail(char === '' ? 'unexpected end' : `unexpected "${char}"`);
  }

  function parsePower(): Node {
    const base = parsePrimary();
    if (eat('**') || eat('^')) {
      const exponent = parseUnary();
      return function power(x: number): number {
        return base(x) ** exponent(x);
      };
    }
    return base;
  }

  function parseUnary(): Node {
    if (eat('-')) {
      const operand = parseUnary();
      return function negate(x: number): number {
        return -operand(x);
      };
    }
    if (eat('+')) return parseUnary();
    return parsePower();
  }

  function parseTerm(): Node {
    let left = parseUnary();
    for (;;) {
      const char = peek();
      if (char === '*' && text.charAt(index + 1) !== '*') {
        index += 1;
        const a = left;
        const b = parseUnary();
        left = function multiply(x: number): number {
          return a(x) * b(x);
        };
      } else if (char === '/') {
        index += 1;
        const a = left;
        const b = parseUnary();
        left = function divide(x: number): number {
          return a(x) / b(x);
        };
      } else if (char === '%') {
        index += 1;
        const a = left;
        const b = parseUnary();
        left = function modulo(x: number): number {
          return a(x) % b(x);
        };
      } else {
        return left;
      }
    }
  }

  function parseExpression(): Node {
    let left = parseTerm();
    for (;;) {
      const char = peek();
      if (char === '+') {
        index += 1;
        const a = left;
        const b = parseTerm();
        left = function add(x: number): number {
          return a(x) + b(x);
        };
      } else if (char === '-') {
        index += 1;
        const a = left;
        const b = parseTerm();
        left = function subtract(x: number): number {
          return a(x) - b(x);
        };
      } else {
        return left;
      }
    }
  }

  const root = parseExpression();
  skipSpace();
  if (index < text.length) fail(`unexpected "${text.charAt(index)}"`);
  return function path(x: number): number {
    return root(x);
  };
}
