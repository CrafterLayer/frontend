/**
 * Split a CSS list value (`box-shadow`, `background-image`, `transition`) into
 * its top-level layers: commas inside `rgb(…)`/`linear-gradient(…)` do not
 * split.
 */
export function splitLayers(css: string): string[] {
  const layers: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of css) {
    if (char === '(') depth += 1;
    if (char === ')') depth = Math.max(0, depth - 1);
    if (char === ',' && depth === 0) {
      layers.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim() !== '') layers.push(current.trim());
  return layers.filter((layer) => layer !== '');
}

export function joinLayers(layers: readonly string[]): string {
  return layers.map((layer) => layer.trim()).filter((layer) => layer !== '').join(', ');
}

/** Move one item, returning a new array (no-op when out of range). */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  if (from < 0 || from >= next.length || to < 0 || to >= next.length) return next;
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}
