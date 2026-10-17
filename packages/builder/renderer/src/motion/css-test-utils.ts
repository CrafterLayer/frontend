/**
 * A tiny CSS reader for the generator tests: every declaration with the
 * selector and the at-rules around it. Enough for generated CSS (no strings
 * holding braces or semicolons); not a general parser.
 */
export interface ParsedDeclaration {
  readonly property: string;
  readonly value: string;
  /** The rule's selector (the innermost prelude). */
  readonly selector: string;
  /** Every enclosing prelude, outermost first (at-rules and the selector). */
  readonly ancestors: readonly string[];
}

export function declarationsOf(css: string): ParsedDeclaration[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//gu, '');
  const stack: string[] = [];
  const out: ParsedDeclaration[] = [];
  let buffer = '';
  function flush(): void {
    const chunk = buffer.trim();
    buffer = '';
    if (chunk === '' || stack.length === 0) return;
    const colon = chunk.indexOf(':');
    if (colon <= 0) return;
    out.push({
      property: chunk.slice(0, colon).trim(),
      value: chunk.slice(colon + 1).trim(),
      selector: stack[stack.length - 1] ?? '',
      ancestors: [...stack],
    });
  }
  for (const character of text) {
    if (character === '{') {
      stack.push(buffer.trim());
      buffer = '';
    } else if (character === ';') {
      flush();
    } else if (character === '}') {
      flush();
      stack.pop();
    } else {
      buffer += character;
    }
  }
  return out;
}

export function insideKeyframes(declaration: ParsedDeclaration): boolean {
  return declaration.ancestors.some((prelude) => prelude.startsWith('@keyframes'));
}
