/*
  An eval-free expression language for dialogue conditions and variable updates
  (creative engines, 2026-10-12).

  Grammar (parsed, never passed to eval / Function):
    or      := and ('||' and)*            also the word 'or'
    and     := equality ('&&' equality)*  also the word 'and'
    equality:= compare (('==' | '!=' | '===' | '!==') compare)*
    compare := sum (('<' | '<=' | '>' | '>=') sum)*
    sum     := product (('+' | '-') product)*
    product := unary (('*' | '/' | '%') unary)*
    unary   := ('!' | 'not' | '-') unary | primary
    primary := number | 'string' | "string" | true | false | null | identifier | '(' or ')'
  Identifiers read story variables (letters, digits, _ and Arabic letters; dots are not property
  access, a dotted name is just a variable name). An unknown variable reads as 0, so a condition
  on a flag that was never set is simply false. Source is capped at 256 characters, nesting at 32.
*/

export type DialogueValue = number | string | boolean | null;
export type VarReader = (name: string) => DialogueValue;
export type CompiledExpression = (read: VarReader) => DialogueValue;

export const EXPRESSION_MAX_LENGTH = 256;
const MAX_DEPTH = 32;

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'str'; value: string }
  | { kind: 'id'; value: string }
  | { kind: 'op'; value: string };

const OPERATORS = [
  '===',
  '!==',
  '==',
  '!=',
  '<=',
  '>=',
  '&&',
  '||',
  '<',
  '>',
  '+',
  '-',
  '*',
  '/',
  '%',
  '!',
  '(',
  ')',
];
const WORD_OPERATORS: Readonly<Record<string, string>> = { and: '&&', or: '||', not: '!' };
const IDENT = /^[\p{L}_][\p{L}\p{N}_.]*/u;

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let at = 0;
  while (at < source.length) {
    const rest = source.slice(at);
    const space = /^\s+/u.exec(rest);
    if (space !== null) {
      at += space[0].length;
      continue;
    }
    const number = /^\d+(\.\d+)?/u.exec(rest);
    if (number !== null) {
      tokens.push({ kind: 'num', value: Number(number[0]) });
      at += number[0].length;
      continue;
    }
    const quote = rest[0];
    if (quote === '"' || quote === "'") {
      const end = rest.indexOf(quote, 1);
      if (end < 0) throw new SyntaxError(`unterminated string at ${String(at)}`);
      tokens.push({ kind: 'str', value: rest.slice(1, end) });
      at += end + 1;
      continue;
    }
    const ident = IDENT.exec(rest);
    if (ident !== null) {
      const word = ident[0];
      const op = WORD_OPERATORS[word];
      tokens.push(op === undefined ? { kind: 'id', value: word } : { kind: 'op', value: op });
      at += word.length;
      continue;
    }
    const op = OPERATORS.find((candidate) => rest.startsWith(candidate));
    if (op === undefined) throw new SyntaxError(`unexpected "${rest[0] ?? ''}" at ${String(at)}`);
    tokens.push({ kind: 'op', value: op });
    at += op.length;
  }
  return tokens;
}

function truthy(value: DialogueValue): boolean {
  return value !== null && value !== false && value !== 0 && value !== '';
}

function num(value: DialogueValue): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return 0;
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function compileExpression(source: string): CompiledExpression {
  if (typeof source !== 'string') throw new TypeError('expression must be a string');
  if (source.length > EXPRESSION_MAX_LENGTH) {
    throw new RangeError(`expression longer than ${String(EXPRESSION_MAX_LENGTH)} characters`);
  }
  const tokens = tokenize(source);
  let index = 0;
  let depth = 0;

  const peek = (): Token | undefined => tokens[index];
  const isOp = (value: string): boolean => {
    const token = peek();
    return token?.kind === 'op' && token.value === value;
  };

  function enter(): void {
    depth += 1;
    if (depth > MAX_DEPTH) throw new RangeError('expression nests too deeply');
  }

  function binary(
    next: () => CompiledExpression,
    ops: readonly string[],
    apply: (op: string, a: DialogueValue, b: DialogueValue) => DialogueValue,
  ): CompiledExpression {
    let left = next();
    for (;;) {
      const token = peek();
      if (token?.kind !== 'op' || !ops.includes(token.value)) return left;
      index += 1;
      const right = next();
      const l = left;
      const op = token.value;
      left = (read) => apply(op, l(read), right(read));
    }
  }

  function or(): CompiledExpression {
    let left = and();
    while (isOp('||')) {
      index += 1;
      const right = and();
      const l = left;
      left = (read) => (truthy(l(read)) ? true : truthy(right(read)));
    }
    return left;
  }

  function and(): CompiledExpression {
    let left = equality();
    while (isOp('&&')) {
      index += 1;
      const right = equality();
      const l = left;
      left = (read) => (truthy(l(read)) ? truthy(right(read)) : false);
    }
    return left;
  }

  function equality(): CompiledExpression {
    return binary(compare, ['==', '!=', '===', '!=='], (op, a, b) => {
      // Loose on purpose: "3" from a text field equals 3.
      const same = typeof a === typeof b ? a === b : num(a) === num(b) && a !== null && b !== null;
      return op.startsWith('=') ? same : !same;
    });
  }

  function compare(): CompiledExpression {
    return binary(sum, ['<', '<=', '>', '>='], (op, a, b) => {
      const x = num(a);
      const y = num(b);
      if (op === '<') return x < y;
      if (op === '<=') return x <= y;
      if (op === '>') return x > y;
      return x >= y;
    });
  }

  function sum(): CompiledExpression {
    return binary(product, ['+', '-'], (op, a, b) => {
      if (op === '+' && (typeof a === 'string' || typeof b === 'string')) {
        return `${String(a ?? '')}${String(b ?? '')}`.slice(0, 2000);
      }
      return finite(op === '+' ? num(a) + num(b) : num(a) - num(b));
    });
  }

  function product(): CompiledExpression {
    return binary(unary, ['*', '/', '%'], (op, a, b) => {
      const x = num(a);
      const y = num(b);
      if (op === '*') return finite(x * y);
      if (y === 0) return 0;
      return finite(op === '/' ? x / y : x % y);
    });
  }

  function unary(): CompiledExpression {
    if (isOp('!')) {
      index += 1;
      enter();
      const inner = unary();
      depth -= 1;
      return (read) => !truthy(inner(read));
    }
    if (isOp('-')) {
      index += 1;
      enter();
      const inner = unary();
      depth -= 1;
      return (read) => finite(-num(inner(read)));
    }
    return primary();
  }

  function primary(): CompiledExpression {
    const token = peek();
    if (token === undefined) throw new SyntaxError('expression ended early');
    index += 1;
    if (token.kind === 'num' || token.kind === 'str') {
      const value = token.value;
      return () => value;
    }
    if (token.kind === 'id') {
      if (token.value === 'true') return () => true;
      if (token.value === 'false') return () => false;
      if (token.value === 'null') return () => null;
      const name = token.value;
      return (read) => read(name);
    }
    if (token.value === '(') {
      enter();
      const inner = or();
      depth -= 1;
      if (!isOp(')')) throw new SyntaxError('missing )');
      index += 1;
      return inner;
    }
    throw new SyntaxError(`unexpected "${token.value}"`);
  }

  if (tokens.length === 0) throw new SyntaxError('empty expression');
  const compiled = or();
  if (index !== tokens.length) throw new SyntaxError('unexpected text after the expression');
  return compiled;
}

export function isTruthy(value: DialogueValue): boolean {
  return truthy(value);
}
