import type {
  CkEngine,
  CkEngineContext,
  CkEngineKind,
  CkEngineQueueEntry,
  CkEngines,
  CkEnginesHost,
} from '../../engines/ck-engines-shim';

/**
 * The `engines` behaviour pack (media-motion DESIGN §2.3, D5): the page side of
 * the `window.ckEngines` handshake.
 *
 * It finds every engine marker — `data-ck-scene` (Pixi), `data-ck-timeline`
 * (GSAP), `data-ck-lottie` (lottie-web light) — and either mounts it on the
 * registered engine now, or queues `{kind, el, ctx}` on `window.ckEngines.queue`
 * for the engine asset to drain with `ready(kind, engine)` when it loads.
 *
 * ## Loading (export)
 *
 * A published page that uses an engine carries the locator
 * `<link rel="ck-engine" href="…/assets/ck-<kind>.js" data-ck-engine="<kind>">`
 * in its head — an unknown rel, so the browser fetches nothing (fix pass
 * 2026-10-06: a rel="prefetch" downloaded the engines under reduced motion
 * too). This pack injects `<script src=link.href data-ck-engine=<kind>>`
 * once per document, only when motion is allowed:
 * - timeline: at once (its recipes set the initial state on first paint);
 * - scene and lottie: after first paint AND near the viewport —
 *   `requestIdleCallback` (fallback `setTimeout` 200 ms) and an
 *   IntersectionObserver with `rootMargin: 25%`, both.
 *
 * On the editor canvas there is no link: `mount.ts` injects the engine into the
 * frame document (`engines/inject.ts`) and this pack only queues.
 *
 * ## Rules
 *
 * - Reduced motion: nothing at all — no queue, no request. The fallback markup
 *   (the scene's first img, the Lottie poster) stays.
 * - Canvas (`interactive: false`): `ctx` is `{ still: false, canvas: true }` —
 *   the engines RUN while editing but never restructure React's DOM nor take
 *   pointer input (gsap-pixi 2026-10-08) — and a MutationObserver on
 *   `data-ck-play` forwards Preview to the engine's `ctx.onPlay` / `ctx.onStop`
 *   callbacks. Published / Preview: `{ still: false, canvas: false }`.
 * - One element may carry several markers (a section with a scene AND a
 *   timeline): each (kind, element) pair mounts once.
 * - `self: true` handles only `root` itself, never its descendants (the
 *   document engines mount registered blocks one element at a time).
 * - Idempotent: a handled element carries `data-ck-engine-mounted`, whose value
 *   lists the kinds mounted on it (`"scene timeline"`).
 * - Dispose calls each entry's disposer and removes this mount's entries from
 *   the queue, so a late `ready` never mounts them.
 *
 * ## Why one self-contained function
 *
 * It is serialised with `Function.prototype.toString` into
 * `assets/ck-behaviors.js` (like `mountBehaviors`), so it has NO runtime
 * imports (the ones above are types and vanish) and reads NO module-scope
 * identifier. `ensureCkEngines` below is a verbatim copy of
 * `engines/ck-engines-shim.ts`, held equal by a parity test.
 */
export function mountEngines(
  root: ParentNode,
  options?: { readonly interactive?: boolean; readonly self?: boolean },
): () => void {
  function ensureCkEngines(win: CkEnginesHost): CkEngines {
    const existing = win.ckEngines as Partial<CkEngines> | undefined;
    if (existing?.engines && existing.queue && typeof existing.ready === 'function') {
      return existing as CkEngines;
    }
    const api: CkEngines = {
      engines: {},
      queue: [],
      ready: function ready(kind: CkEngineKind, engine: CkEngine): void {
        api.engines[kind] = engine;
        const waiting = api.queue.slice();
        api.queue.length = 0;
        for (const entry of waiting) {
          if (entry.kind !== kind) {
            api.queue.push(entry);
            continue;
          }
          if (entry.dispose || !entry.el.isConnected) continue;
          try {
            entry.dispose = engine.mount(entry.el, entry.ctx);
          } catch {
            entry.dispose = function noop(): void {
              /* the element keeps its fallback markup */
            };
          }
        }
      },
    };
    win.ckEngines = api;
    return api;
  }

  const doc: Document | null =
    (root as Node).nodeType === 9 ? (root as Document) : (root as Node).ownerDocument;
  const win = doc === null ? null : doc.defaultView;
  if (doc === null || win === null) return function noop() {
      // No window: nothing was mounted.
    };
  const page: Document = doc;
  const view = win as Window &
    CkEnginesHost & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
  const reduced =
    typeof view.matchMedia === 'function' &&
    view.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return function noop() {
      // Reduced motion: no engine, the fallback markup stays.
    };
  /* The canvas RUNS the engines (gsap-pixi 2026-10-08): `still` stays false, `canvas` says where. */
  const canvas = options?.interactive === false;
  const self = options?.self === true;
  const MARK = 'data-ck-engine-mounted';
  const KINDS: readonly (readonly [CkEngineKind, string])[] = [
    ['scene', 'data-ck-scene'],
    ['timeline', 'data-ck-timeline'],
    ['lottie', 'data-ck-lottie'],
  ];

  /* The kinds already mounted on an element: the MARK value is a space-separated list. */
  function marksOf(el: Element): string[] {
    return (el.getAttribute(MARK) ?? '').split(' ').filter(function named(token: string) {
      return token !== '';
    });
  }

  const found: { kind: CkEngineKind; el: HTMLElement }[] = [];
  for (const [kind, attribute] of KINDS) {
    const selector = `[${attribute}]`;
    const els: Element[] = [];
    if ((root as Node).nodeType === 1 && (root as Element).matches(selector)) els.push(root as Element);
    if (!self) els.push(...Array.from(root.querySelectorAll(selector)));
    for (const el of els) {
      if (marksOf(el).includes(kind) || el.closest('[data-ck-clone]') !== null) continue;
      if (found.some((item) => item.el === el && item.kind === kind)) continue;
      found.push({ kind, el: el as HTMLElement });
    }
  }
  if (found.length === 0) return function noop() {
      // No marker in this root.
    };

  /* Computed direction first; the `dir` attribute where a DOM computes none (as mountBehaviors). */
  function isRtl(el: Element): boolean {
    let computed = '';
    try {
      computed = view.getComputedStyle(el).direction;
    } catch {
      computed = '';
    }
    if (computed === 'rtl') return true;
    const owner = el.closest('[dir]');
    const written = owner === null ? '' : (owner.getAttribute('dir') ?? '').toLowerCase();
    if (written === 'rtl') return true;
    if (written === 'ltr') return false;
    return (page.documentElement.getAttribute('dir') ?? '').toLowerCase() === 'rtl';
  }

  function langOf(el: Element): string {
    const owner = el.closest('[lang]');
    const lang = owner === null ? '' : (owner.getAttribute('lang') ?? '');
    return lang !== '' ? lang : page.documentElement.lang || '';
  }

  const api = ensureCkEngines(view);
  const cleanups: (() => void)[] = [];
  const own: { entry: CkEngineQueueEntry; play: (() => void)[]; stop: (() => void)[]; marked: boolean }[] = [];
  const waiting = new Set<CkEngineKind>();

  for (const { kind, el } of found) {
    const play: (() => void)[] = [];
    const stop: (() => void)[] = [];
    const ctx: CkEngineContext = {
      still: false,
      canvas,
      rtl: isRtl(el),
      lang: langOf(el),
      onPlay: function onPlay(cb: () => void): void {
        play.push(cb);
      },
      onStop: function onStop(cb: () => void): void {
        stop.push(cb);
      },
    };
    const entry: CkEngineQueueEntry = { kind, el, ctx };
    const marks = marksOf(el);
    const marked = !marks.includes(kind);
    if (marked) el.setAttribute(MARK, marks.concat([kind]).join(' '));
    own.push({ entry, play, stop, marked });
    const engine = api.engines[kind];
    if (engine) {
      try {
        const dispose = engine.mount(el, ctx);
        entry.dispose =
          typeof dispose === 'function'
            ? dispose
            : function noop(): void {
                /* the engine returned nothing to stop */
              };
      } catch {
        entry.dispose = function noop(): void {
          /* the element keeps its fallback markup */
        };
      }
    } else {
      api.queue.push(entry);
      waiting.add(kind);
    }
  }

  /*
    Canvas Preview: data-ck-play on the marker (or an ancestor) plays; removing it stops. The
    pack never builds a still context any more (the canvas runs), so `canvas` alone wires it.
    With `self` the root is the marker, so its ancestors are watched through the whole document.
  */
  if (canvas) {
    const Mutation = (view as unknown as { MutationObserver?: typeof MutationObserver }).MutationObserver;
    if (typeof Mutation === 'function') {
      const watcher = new Mutation(function previewed(records: MutationRecord[]) {
        for (const record of records) {
          const target = record.target as Element;
          const playing = target.hasAttribute('data-ck-play');
          for (const item of own) {
            if (item.entry.el !== target && !target.contains(item.entry.el)) continue;
            for (const cb of (playing ? item.play : item.stop).slice()) {
              try {
                cb();
              } catch {
                // One engine callback must not stop the others.
              }
            }
          }
        }
      });
      watcher.observe(self ? page.documentElement : root, {
        subtree: true,
        attributes: true,
        attributeFilter: ['data-ck-play'],
      });
      cleanups.push(function unwatch() {
        watcher.disconnect();
      });
    }
  }

  /* Export: request each waiting engine from its locator link, once per document. */
  function inject(kind: CkEngineKind, href: string): void {
    if (page.querySelector(`script[data-ck-engine="${kind}"]`) !== null) return;
    const script = page.createElement('script');
    script.src = href;
    script.async = true;
    script.setAttribute('data-ck-engine', kind);
    page.head.appendChild(script);
  }

  for (const kind of Array.from(waiting)) {
    const link = page.querySelector<HTMLLinkElement>(`link[data-ck-engine="${kind}"]`);
    if (link === null) continue;
    if (page.querySelector(`script[data-ck-engine="${kind}"]`) !== null) continue;
    const href = link.href !== '' ? link.href : (link.getAttribute('href') ?? '');
    if (href === '') continue;
    if (kind === 'timeline') {
      inject(kind, href);
      continue;
    }
    let idle = false;
    let near = false;
    let done = false;
    const due = function due(): void {
      if (done || !idle || !near) return;
      done = true;
      inject(kind, href);
    };
    if (typeof view.requestIdleCallback === 'function') {
      const id = view.requestIdleCallback(
        function idled() {
          idle = true;
          due();
        },
        { timeout: 2000 },
      );
      cleanups.push(function unidle() {
        if (typeof view.cancelIdleCallback === 'function') view.cancelIdleCallback(id);
      });
    } else {
      const timer = view.setTimeout(function idled() {
        idle = true;
        due();
      }, 200);
      cleanups.push(function untime() {
        view.clearTimeout(timer);
      });
    }
    const Intersection = (view as unknown as { IntersectionObserver?: typeof IntersectionObserver })
      .IntersectionObserver;
    if (typeof Intersection === 'function') {
      const observer = new Intersection(
        function seen(entries: IntersectionObserverEntry[]) {
          if (!entries.some((record) => record.isIntersecting)) return;
          near = true;
          observer.disconnect();
          due();
        },
        { rootMargin: '25%' },
      );
      for (const item of own) if (item.entry.kind === kind) observer.observe(item.entry.el);
      cleanups.push(function unobserve() {
        observer.disconnect();
      });
    } else {
      near = true;
    }
  }

  let disposed = false;
  return function dispose() {
    if (disposed) return;
    disposed = true;
    for (let at = cleanups.length - 1; at >= 0; at -= 1) {
      try {
        cleanups[at]?.();
      } catch {
        // One failing cleanup must not strand the others.
      }
    }
    cleanups.length = 0;
    for (const item of own) {
      const index = api.queue.indexOf(item.entry);
      if (index >= 0) api.queue.splice(index, 1);
      const stopEngine = item.entry.dispose;
      item.entry.dispose = function disposed(): void {
        /* already stopped */
      };
      if (typeof stopEngine === 'function') {
        try {
          stopEngine();
        } catch {
          // An engine that fails to dispose leaves its element as it is.
        }
      }
      if (item.marked) {
        const kind = item.entry.kind;
        const rest = marksOf(item.entry.el).filter(function other(token: string) {
          return token !== kind;
        });
        if (rest.length === 0) item.entry.el.removeAttribute(MARK);
        else item.entry.el.setAttribute(MARK, rest.join(' '));
      }
    }
    own.length = 0;
  };
}

/**
 * The fallback imgs inside a scene or a Lottie element are the no-JS and
 * reduced-motion view; they are hidden only once the engine has drawn
 * (`data-ck-ready`), so a failed load leaves them visible. A scene HOST (a
 * section whose content the scene draws behind, `data-ck-scene-host`) keeps its
 * imgs: they are content, not a fallback (gsap-pixi 2026-10-08).
 */
export const ENGINES_PACK_CSS = `
[data-ck-scene][data-ck-ready]:not([data-ck-scene-host]) > img,
[data-ck-lottie][data-ck-ready] > img {
  display: none;
}
`;
