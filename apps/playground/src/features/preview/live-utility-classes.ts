/**
 * Every class name the custom-code trees of a site carry, for the live
 * Tailwind compiler to generate.
 *
 * Shape-driven, like the plan door: a tree is any object of `kind: 'root'`
 * with children, wherever the site holds it — a page region, a shared header,
 * a repeated block — so a new place a tree can live needs no change here.
 * Trees are immutable (Immer), so each one is read once and remembered by
 * identity: the walk on every store notification touches only what changed.
 */

type JsonRecord = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const classesByTree = new WeakMap<object, readonly string[]>();

function classesOfTree(tree: JsonRecord): readonly string[] {
  const cached = classesByTree.get(tree);
  if (cached !== undefined) return cached;
  const names = new Set<string>();
  const stack: unknown[] = [tree];
  while (stack.length > 0) {
    const node = stack.pop();
    if (Array.isArray(node)) {
      stack.push(...(node as unknown[]));
      continue;
    }
    if (!isRecord(node)) continue;
    const className = node['className'];
    if (typeof className === 'string') {
      for (const name of className.split(/\s+/u)) if (name !== '') names.add(name);
    }
    const children = node['children'];
    if (Array.isArray(children)) stack.push(children);
  }
  const found = [...names];
  classesByTree.set(tree, found);
  return found;
}

/** The class names every custom-code tree in `value` uses, in no particular order. */
export function liveUtilityClasses(value: unknown): ReadonlySet<string> {
  const names = new Set<string>();
  const stack: unknown[] = [value];
  let visited = 0;
  while (stack.length > 0 && visited < 200_000) {
    const current = stack.pop();
    visited += 1;
    if (Array.isArray(current)) {
      stack.push(...(current as unknown[]));
      continue;
    }
    if (!isRecord(current)) continue;
    if (current['kind'] === 'root' && Array.isArray(current['children'])) {
      for (const name of classesOfTree(current)) names.add(name);
      continue;
    }
    stack.push(...Object.values(current));
  }
  return names;
}
