/** Split on whitespace outside parentheses: `minmax(0, 1fr) auto` → two parts. */
export function splitTopLevel(css: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of css.trim()) {
    if (char === '(') depth += 1;
    if (char === ')') depth = Math.max(0, depth - 1);
    if (/\s/u.test(char) && depth === 0) {
      if (current !== '') parts.push(current);
      current = '';
      continue;
    }
    current += depth > 0 && /\s/u.test(char) ? '' : char;
  }
  if (current !== '') parts.push(current);
  return parts;
}
