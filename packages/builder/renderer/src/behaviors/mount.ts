import { ensureCanvasEngines } from '../engines/inject';
import { BEHAVIOR_PACKS, mountScripts } from './packs';
import { mountBehaviors } from './runtime';

/**
 * The engines the root's markers name, injected into the root's own document where the page
 * carries no export locator (`link[data-ck-engine]`) or the root is the editor canvas.
 */
function injectEngines(root: ParentNode, options?: { readonly interactive?: boolean }): () => void {
  const doc: Document | null =
    (root as Node).nodeType === 9 ? (root as Document) : (root as Node).ownerDocument;
  const prefetched = doc === null ? null : doc.querySelector('link[data-ck-engine]');
  return options?.interactive === false || prefetched === null
    ? // pixi-studio:runtime-wiring additions (2026-10-10): a Preview (interactive) may load the
      // sound engine; the editor canvas never does (DESIGN D12).
      ensureCanvasEngines(root, { canvas: options?.interactive === false })
    : // end pixi-studio:runtime-wiring additions
      () => undefined;
}

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
 * `scripts: false` leaves the `scripts` pack out (free-code mode, 2026-10-09): the editor mounts
 * a region's `js` on its own effect (`mountRegionScripts`), so editing the tree does not restart
 * a running script.
 *
 * One pack that throws while mounting does not stop the others.
 */
export function mountSiteBehaviors(
  root: ParentNode,
  options?: { readonly interactive?: boolean; readonly scripts?: boolean },
): () => void {
  const disposers: (() => void)[] = [];
  for (const mount of [mountBehaviors, ...BEHAVIOR_PACKS]) {
    if (mount === mountScripts && options?.scripts === false) continue;
    try {
      disposers.push(mount(root, options));
    } catch {
      // A failing pack leaves its markup as the no-JS view.
    }
  }
  disposers.push(injectEngines(root, options));
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

/**
 * A region's `js` on its own (free-code mode, 2026-10-09): the `scripts` pack plus the engine
 * injection it may need (the full pixi.js bundle, on the canvas). The editor mounts this from its
 * own effect keyed on the code, so React drives re-runs (`watch: false`: no MutationObserver
 * racing the effect); a host without React gets the watching default.
 */
export function mountRegionScripts(
  root: ParentNode,
  options?: { readonly interactive?: boolean; readonly watch?: boolean },
): () => void {
  const disposers: (() => void)[] = [];
  try {
    disposers.push(mountScripts(root, options));
  } catch {
    // A failing script runtime leaves the region as its no-JS view.
  }
  disposers.push(injectEngines(root, options));
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
