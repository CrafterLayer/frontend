import { ensureCanvasEngines } from '../engines/inject';
import { BEHAVIOR_PACKS } from './packs';
import { mountBehaviors } from './runtime';

/**
 * Every site behaviour on one root (media-motion DESIGN §2.1): the core
 * runtime (`mountBehaviors`) plus every behaviour pack, in the same order the
 * published `assets/ck-behaviors.js` runs them, with ONE disposer.
 *
 * Where the page carries no export prefetch link (`link[data-ck-engine]`) —
 * the editor canvas, a host preview — or on the canvas itself
 * (`interactive: false`), the engines the root's markers name are injected
 * into the root's own document (`ensureCanvasEngines`, §2.4); the `engines`
 * pack has queued the markers for them.
 *
 * One pack that throws while mounting does not stop the others.
 */
export function mountSiteBehaviors(
  root: ParentNode,
  options?: { readonly interactive?: boolean },
): () => void {
  const disposers: (() => void)[] = [];
  for (const mount of [mountBehaviors, ...BEHAVIOR_PACKS]) {
    try {
      disposers.push(mount(root, options));
    } catch {
      // A failing pack leaves its markup as the no-JS view.
    }
  }
  const doc: Document | null =
    (root as Node).nodeType === 9 ? (root as Document) : (root as Node).ownerDocument;
  const prefetched = doc === null ? null : doc.querySelector('link[data-ck-engine]');
  if (options?.interactive === false || prefetched === null) {
    disposers.push(ensureCanvasEngines(root));
  }
  let disposed = false;
  return function dispose() {
    if (disposed) return;
    disposed = true;
    for (let at = disposers.length - 1; at >= 0; at -= 1) {
      try {
        disposers[at]?.();
      } catch {
        // One failing disposer must not strand the others.
      }
    }
    disposers.length = 0;
  };
}
