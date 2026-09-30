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
 * Whether a page needs the runtime at all — a cheap check an exporter runs
 * before embedding the script. Reads rendered markup (a string), a DOM node,
 * or any JSON value (a stored document or tree).
 */
export function hasBehaviors(markupOrDocument: unknown): boolean {
  if (typeof markupOrDocument === 'string') return markupOrDocument.includes('data-ck-behavior');
  if (typeof markupOrDocument !== 'object' || markupOrDocument === null) return false;
  const node = markupOrDocument as { querySelector?: unknown };
  if (typeof node.querySelector === 'function') {
    return (markupOrDocument as ParentNode).querySelector('[data-ck-behavior]') !== null;
  }
  try {
    return JSON.stringify(markupOrDocument).includes('"data-ck-behavior"');
  } catch {
    return false;
  }
}
