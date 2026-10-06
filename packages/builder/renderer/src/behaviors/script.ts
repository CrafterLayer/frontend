import { mountBehaviors } from './runtime';

/**
 * The behaviour runtime as one inline script for an exported page:
 * `mountBehaviors` serialised by `Function.prototype.toString` and called on
 * the document. It must run after the markup is parsed, so an exporter places
 * it at the end of <body> (or in a `defer`/module script).
 */
export function behaviorRuntimeScript(): string {
  return `(${mountBehaviors.toString()})(document);`;
}

/**
 * What makes a page need the runtime: a behaviour, a motion or hover preset
 * (child indexes, triggers, split text, pointer effects), or the spotlight
 * effect's pointer variables. Kept equal to the selector inside
 * `mountBehaviors` (which cannot import it).
 */
export const BEHAVIOR_RUNTIME_SELECTOR =
  '[data-ck-behavior], [data-ck-motion], [data-ck-hover], .ck-fx-spotlight';

const RUNTIME_MARKERS = [
  'data-ck-behavior',
  'data-ck-motion',
  'data-ck-hover',
  'ck-fx-spotlight',
] as const;

/**
 * Whether a page needs the runtime at all — a cheap check an exporter runs
 * before embedding the script, and the canvas runs before mounting. Reads
 * rendered markup (a string), a DOM node, or any JSON value (a stored
 * document or tree).
 */
export function hasBehaviors(markupOrDocument: unknown): boolean {
  if (typeof markupOrDocument === 'string')
    return RUNTIME_MARKERS.some((marker) => markupOrDocument.includes(marker));
  if (typeof markupOrDocument !== 'object' || markupOrDocument === null) return false;
  const node = markupOrDocument as { querySelector?: unknown };
  if (typeof node.querySelector === 'function') {
    return (markupOrDocument as ParentNode).querySelector(BEHAVIOR_RUNTIME_SELECTOR) !== null;
  }
  try {
    const json = JSON.stringify(markupOrDocument);
    return (
      json.includes('"data-ck-behavior"') ||
      json.includes('"data-ck-motion"') ||
      json.includes('"data-ck-hover"') ||
      /ck-fx-spotlight\b/u.test(json)
    );
  } catch {
    return false;
  }
}
