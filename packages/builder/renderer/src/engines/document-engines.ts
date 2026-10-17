import { mountEngines } from '../behaviors/packs/engines';
import { CUSTOM_CODE_REGION_ATTRIBUTE } from '../tailwind/live-utilities';
import { ensureCanvasEngines } from './inject';

/**
 * Engines on REGISTERED blocks (gsap-pixi 2026-10-08, runtime contract item 7).
 *
 * A customCode region mounts its own engines (`CustomCode` → `mountSiteBehaviors`). A registered
 * block — a marketing section whose `motion` carries a scene or a timeline, a part whose
 * `partStyles` carries a timeline — renders the same markers (`data-ck-scene`,
 * `data-ck-timeline`, `data-ck-lottie`) but has no such mount. `mountDocumentEngines` is that
 * mount for a whole document view (the canvas frame body, the Preview frame body):
 *
 * - every marker OUTSIDE `[data-ck-custom-code]` mounts on its own, through
 *   `mountEngines(el, { interactive, self: true })`, remembered with a signature of its marker and
 *   param attributes;
 * - a MutationObserver re-scans (debounced) only on a relevant change: a marker / param attribute
 *   on a candidate element, or an added / removed node that carries (or held) a marker — React's
 *   text updates, the engines' own nodes (a scene layer, split spans) and anything inside a
 *   customCode region are ignored;
 * - an element that left the view, or lost its markers, is disposed; one whose signature changed
 *   (a new recipe, a new density) is disposed and mounted again — a newly chosen recipe plays at
 *   once;
 * - the engine scripts the markers name are injected into the root's own document
 *   (`ensureCanvasEngines(root)`), unless a published page loads them from its
 *   `link[data-ck-engine]` locators;
 * - reduced motion: nothing at all.
 *
 * Returns one disposer: it stops observing, disposes every mount and cancels pending injections.
 */
export function mountDocumentEngines(
  root: Element,
  options: { readonly interactive: boolean },
): () => void {
  const doc = root.ownerDocument;
  const view = doc.defaultView;
  const noop = (): void => undefined;
  if (view === null) return noop;
  if (
    typeof view.matchMedia === 'function' &&
    view.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return noop;
  }

  const mounted = new Map<Element, { readonly signature: string; readonly dispose: () => void }>();
  const injections: (() => void)[] = [];
  let disposed = false;
  let timer: number | undefined;
  /* A published page (a locator link) lets the engines pack request the scripts itself. */
  const fromLinks = options.interactive && doc.querySelector('link[data-ck-engine]') !== null;

  function scan(): void {
    if (disposed) return;
    const live = markersIn(root).filter(eligible);
    const present = new Set(live);
    for (const [el, record] of Array.from(mounted)) {
      if (present.has(el) && el.isConnected) continue;
      mounted.delete(el);
      safely(record.dispose);
    }
    let added = false;
    for (const el of live) {
      const signature = signatureOf(el);
      const record = mounted.get(el);
      if (record?.signature === signature) continue;
      if (record !== undefined) safely(record.dispose);
      let dispose: () => void = noop;
      try {
        dispose = mountEngines(el, { interactive: options.interactive, self: true });
      } catch {
        // A failing mount leaves the element's markup as the no-JS view.
      }
      mounted.set(el, { signature, dispose });
      added = true;
    }
    if (added && !fromLinks) injections.push(ensureCanvasEngines(root));
  }

  function relevant(record: MutationRecord): boolean {
    if (record.type === 'attributes') {
      const target = record.target as Element;
      return mounted.has(target) || (target.matches(MARKER_SELECTOR) && eligible(target));
    }
    for (const node of Array.from(record.removedNodes)) {
      if (node.nodeType !== 1) continue;
      for (const el of mounted.keys()) if (node === el || node.contains(el)) return true;
    }
    for (const node of Array.from(record.addedNodes)) {
      if (node.nodeType === 1 && markersIn(node as Element).some(eligible)) return true;
    }
    return false;
  }

  const schedule = (): void => {
    if (disposed) return;
    if (timer !== undefined) view.clearTimeout(timer);
    timer = view.setTimeout(() => {
      timer = undefined;
      scan();
    }, RESCAN_DEBOUNCE_MS);
  };

  scan();

  const Observer = (view as Window & { MutationObserver?: typeof MutationObserver })
    .MutationObserver;
  const observer =
    typeof Observer === 'function'
      ? new Observer((records) => {
          if (records.some(relevant)) schedule();
        })
      : null;
  observer?.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: [...WATCHED_ATTRIBUTES],
  });

  return () => {
    if (disposed) return;
    disposed = true;
    observer?.disconnect();
    if (timer !== undefined) view.clearTimeout(timer);
    timer = undefined;
    for (const record of mounted.values()) safely(record.dispose);
    mounted.clear();
    for (const cancel of injections) safely(cancel);
    injections.length = 0;
  };
}

/** The engine markers (`CUSTOM_CODE_ENGINE_MARKERS`). */
const MARKERS = ['data-ck-scene', 'data-ck-timeline', 'data-ck-lottie'] as const;

/** What an engine reads off its own element: a change re-mounts it. */
const PARAMS = [
  'data-ck-scrub',
  'data-ck-density',
  'data-ck-palette',
  'data-ck-src',
  'data-ck-speed',
  'data-ck-ease',
  'data-ck-stagger',
  'data-ck-delay',
] as const;

const WATCHED_ATTRIBUTES: readonly string[] = [...MARKERS, ...PARAMS];

const MARKER_SELECTOR = MARKERS.map((name) => `[${name}]`).join(', ');

/** customCode regions mount their own engines; their markers are never ours. */
const REGION_SELECTOR = `[${CUSTOM_CODE_REGION_ATTRIBUTE}]`;

/** Long enough to fold one React commit's mutations into one scan. */
const RESCAN_DEBOUNCE_MS = 40;

function markersIn(el: Element): Element[] {
  const found = el.matches(MARKER_SELECTOR) ? [el] : [];
  return found.concat(Array.from(el.querySelectorAll(MARKER_SELECTOR)));
}

function eligible(el: Element): boolean {
  return el.closest(REGION_SELECTOR) === null && el.closest('[data-ck-clone]') === null;
}

function signatureOf(el: Element): string {
  return WATCHED_ATTRIBUTES.map((name) => {
    const value = el.getAttribute(name);
    return value === null ? '' : `${name}=${value}`;
  }).join('\n');
}

function safely(run: () => void): void {
  try {
    run();
  } catch {
    // One failing disposer must not strand the others.
  }
}
