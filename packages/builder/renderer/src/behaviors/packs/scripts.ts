import type {
  CkEngine,
  CkEngineContext,
  CkEngineKind,
  CkEngineQueueEntry,
  CkEngines,
  CkEnginesHost,
} from '../../engines/ck-engines-shim';

/** What a region script receives as its one parameter, `ck`. */
export interface CkScriptApi {
  /** The region element (`[data-ck-custom-code]`) to draw inside; `position: relative` if it was static. */
  readonly root: HTMLElement;
  /** True on the editor canvas, false on Preview and on the published site. */
  readonly editor: boolean;
  /** `prefers-reduced-motion: reduce` at mount; the script decides what that means. */
  readonly reducedMotion: boolean;
  /** Cleanup, called on re-run, region removal and page teardown (at once if already disposed). */
  onDispose(fn: () => void): void;
  /** The FULL pixi.js v8 namespace, loaded lazily. */
  pixi(): Promise<unknown>;
  /** A PIXI.Application filling `ck.root`, initialised, destroyed on dispose. */
  stage(options?: {
    readonly background?: string | null;
    readonly pointer?: boolean;
    readonly resolution?: number;
  }): Promise<{ PIXI: unknown; app: unknown; canvas: HTMLCanvasElement }>;
}

/** The crash guard lives on the frame's window, so every region's mount shares it. */
interface ScriptsGuard {
  /** The previous session froze while a script's synchronous part was running. */
  paused: boolean;
  /** The localStorage flag is set until the next task. */
  armed: boolean;
  /** Paused sessions only: the code each region (by id) had when it was first seen. */
  seen: Record<string, string>;
}

interface ScriptsHost {
  ckJsGuard?: ScriptsGuard;
}

/**
 * The `scripts` behaviour pack (free-code mode, 2026-10-09): evaluates a region's `js`.
 *
 * A `customCode` block's `js` prop is rendered as `data-ck-js="<code>"` plus
 * `data-ck-js-id="<node id>"` on the region wrapper (never a `<script>`: the tree cannot express
 * one and this keeps it that way). This pack finds those regions and runs each code string as the
 * BODY of an async function with ONE parameter, `ck` (`CkScriptApi`).
 *
 * ## Security (owner-approved free-code mode)
 *
 * On the PUBLISHED site a script has full page access, by design. On the editor canvas it runs in
 * the canvas iframe's realm (`window.eval` of the frame, so `document` and `window` are the
 * frame's) which is same-origin with the editor; what bounds it there is who may AUTHOR `js` (the
 * composer toggle) and the crash guard below, not a sandbox.
 *
 * ## Contract
 *
 * - Runs once per mount. A changed `data-ck-js` value (MutationObserver, unless `watch: false`)
 *   disposes and re-runs; a region leaving the DOM disposes it; the returned function disposes all.
 * - Every run is try/caught, sync and async: `console.error('[ck-js]', id, error)`, and on the
 *   editor canvas (`interactive: false`) also `data-ck-js-error="<message>"` on the region, cleared
 *   by the next run. A run that was already disposed reports nothing.
 * - `ck.root` gets `position: relative` while it is `static`; restored on dispose.
 * - Pixi is NOT in this pack: `ck.pixi()` queues `{kind: 'pixi'}` on `window.ckEngines` and asks
 *   for `assets/ck-pixi.js` (export: `link[data-ck-engine="pixi"]`) or waits for the editor canvas
 *   to inject it (`engines/inject.ts`). It is requested on demand and never gated on reduced
 *   motion: the author's code decides what to draw.
 * - Idempotent: a mounted region carries `data-ck-js-mounted`.
 *
 * ## Crash guard (editor canvas only)
 *
 * A synchronous infinite loop in AI-written JS would freeze the editor on every load of the saved
 * document. Before the first script of a task runs, `localStorage['ck-js-guard'] = '1'` is set; it
 * is cleared on the next task, i.e. once the synchronous part of every script returned. If the
 * page boots and the flag is still set, NO script runs: the flag is cleared and each region gets
 * `data-ck-js-error="Scripts paused after the editor froze last time"`. A region whose code then
 * changes (the author fixed it) runs again, guarded. Preview and published pages do not use it.
 * It covers the synchronous part only: a loop after the first `await` is not caught.
 *
 * ## Why one self-contained function
 *
 * Like `mountEngines`, it is serialised with `Function.prototype.toString` into
 * `assets/ck-behaviors.js`, so it has NO runtime imports (the ones above are types and vanish),
 * reads NO module-scope identifier, and uses no `async` syntax (promise chains instead: a lower
 * build target would inject a module-scope helper). `ensureCkEngines` below is a verbatim copy of
 * `engines/ck-engines-shim.ts`, held equal by a parity test.
 */
export function mountScripts(
  root: ParentNode,
  options?: { readonly interactive?: boolean; readonly watch?: boolean },
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

  interface Run {
    readonly el: HTMLElement;
    readonly code: string;
    readonly id: string;
    readonly cleanups: (() => void)[];
    stopped: boolean;
    pixi?: Promise<unknown>;
  }
  interface PixiApplication {
    canvas: HTMLCanvasElement;
    init(options: Record<string, unknown>): Promise<void>;
    destroy(rendererOptions?: unknown, options?: unknown): void;
  }

  const doc: Document | null =
    (root as Node).nodeType === 9 ? (root as Document) : (root as Node).ownerDocument;
  const win = doc === null ? null : doc.defaultView;
  if (doc === null || win === null)
    return function noop() {
      // No window: nothing was mounted.
    };
  const page: Document = doc;
  const view = win as Window & CkEnginesHost & ScriptsHost;

  const ATTRIBUTE = 'data-ck-js';
  const ID_ATTRIBUTE = 'data-ck-js-id';
  const ERROR_ATTRIBUTE = 'data-ck-js-error';
  const MARK = 'data-ck-js-mounted';
  const GUARD_KEY = 'ck-js-guard';
  const PAUSED_MESSAGE = 'Scripts paused after the editor froze last time';
  const SELECTOR = '[' + ATTRIBUTE + ']';
  const canvas = options?.interactive === false;
  const watch = options?.watch !== false;
  const reducedMotion =
    typeof view.matchMedia === 'function' &&
    view.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function regionsIn(): HTMLElement[] {
    const found: HTMLElement[] = [];
    if ((root as Node).nodeType === 1 && (root as Element).matches(SELECTOR)) {
      found.push(root as HTMLElement);
    }
    for (const el of Array.from(root.querySelectorAll<HTMLElement>(SELECTOR))) found.push(el);
    return found.filter(function live(el: HTMLElement) {
      return el.closest('[data-ck-clone]') === null;
    });
  }

  const initial = regionsIn();
  if (initial.length === 0)
    return function noop() {
      // No script in this root.
    };

  const runs = new Map<HTMLElement, Run>();
  let disposed = false;

  /* ── crash guard ─────────────────────────────────────────────────────── */

  function setFlag(on: boolean): void {
    try {
      if (on) view.localStorage.setItem(GUARD_KEY, '1');
      else view.localStorage.removeItem(GUARD_KEY);
    } catch {
      // Storage may be blocked: the guard then protects nothing, and nothing else is lost.
    }
  }

  function guardState(): ScriptsGuard {
    let guard = view.ckJsGuard;
    if (guard === undefined) {
      let stale = false;
      try {
        stale = view.localStorage.getItem(GUARD_KEY) === '1';
      } catch {
        stale = false;
      }
      const created: ScriptsGuard = { paused: stale, armed: false, seen: {} };
      guard = created;
      view.ckJsGuard = created;
      if (stale) setFlag(false);
      // A frame torn down in the very task that armed the guard did not freeze: it must not
      // make the next boot think it did.
      view.addEventListener('pagehide', function leaving(): void {
        if (created.armed) setFlag(false);
      });
    }
    return guard;
  }

  function arm(guard: ScriptsGuard): void {
    if (guard.armed) return;
    guard.armed = true;
    setFlag(true);
    view.setTimeout(function released(): void {
      guard.armed = false;
      setFlag(false);
    }, 0);
  }

  /* ── evaluation ──────────────────────────────────────────────────────── */

  /*
    The frame's own AsyncFunction, so `document` / `window` in author code are the frame's. Only
    CONSTANT strings reach `eval` / `Function` here; the author's code goes through the
    AsyncFunction constructor in `compile` on purpose: this is the free-code mode, and what gates
    it is the authoring toggle, not a sandbox (see the header).
  */
  function asyncFunctionConstructor(): FunctionConstructor {
    try {
      const own = (view as unknown as { eval(code: string): unknown }).eval(
        '(async function () {}).constructor',
      );
      if (typeof own === 'function') return own as FunctionConstructor;
    } catch {
      // No eval on that window: this realm's own constructor below.
    }
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- a constant string, to reach AsyncFunction without async syntax (see the header)
    return new Function('return (async function () {}).constructor')() as FunctionConstructor;
  }

  function compile(run: Run): (ck: CkScriptApi) => Promise<unknown> {
    const AsyncFunction = asyncFunctionConstructor();
    const label = run.id.replace(/[^A-Za-z0-9_.-]/g, '_');
    return new AsyncFunction(
      'ck',
      '"use strict";\n' + run.code + '\n//# sourceURL=ck-js-' + label + '.js',
    ) as (ck: CkScriptApi) => Promise<unknown>;
  }

  function fail(run: Run, error: unknown): void {
    if (run.stopped) return;
    console.error('[ck-js]', run.id, error);
    if (!canvas) return;
    const written =
      error !== null &&
      typeof error === 'object' &&
      typeof (error as { message?: unknown }).message === 'string'
        ? (error as { message: string }).message
        : String(error);
    run.el.setAttribute(ERROR_ATTRIBUTE, written);
  }

  function settle(fn: () => void, run: Run): void {
    try {
      fn();
    } catch (error) {
      console.error('[ck-js]', run.id, error);
    }
  }

  /* ── pixi (ck.pixi / ck.stage) ───────────────────────────────────────── */

  function requestBundle(onError: (error: Error) => void): void {
    if (page.querySelector('script[data-ck-engine="pixi"]') !== null) return;
    const link = page.querySelector<HTMLLinkElement>('link[data-ck-engine="pixi"]');
    // No locator: the editor canvas, where the bundle is injected into the frame head.
    if (link === null) return;
    const href = link.href !== '' ? link.href : (link.getAttribute('href') ?? '');
    if (href === '') return;
    const script = page.createElement('script');
    script.src = href;
    script.async = true;
    script.setAttribute('data-ck-engine', 'pixi');
    script.addEventListener('error', function failed() {
      onError(new Error('Could not load ' + href));
    });
    page.head.appendChild(script);
  }

  function loadPixi(run: Run): Promise<unknown> {
    if (run.pixi !== undefined) return run.pixi;
    const loading = new Promise<unknown>(function executor(resolve, reject) {
      const api = ensureCkEngines(view);
      let timer = 0;
      const ctx: CkEngineContext = {
        still: false,
        canvas,
        rtl: false,
        lang: '',
        onPlay: function onPlay(): void {
          /* a script has nothing to replay */
        },
        onStop: function onStop(): void {
          /* a script has nothing to stop */
        },
        provide: function provide(namespace: unknown): void {
          view.clearTimeout(timer);
          resolve(namespace);
        },
      };
      const engine = api.engines.pixi;
      if (engine) {
        try {
          engine.mount(run.el, ctx);
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
        return;
      }
      const entry: CkEngineQueueEntry = { kind: 'pixi', el: run.el, ctx };
      api.queue.push(entry);
      run.cleanups.push(function unqueue(): void {
        view.clearTimeout(timer);
        const at = api.queue.indexOf(entry);
        if (at >= 0) api.queue.splice(at, 1);
      });
      timer = view.setTimeout(function late(): void {
        reject(
          new Error(
            'The pixi.js bundle did not load. Call ck.pixi() or ck.stage() literally so the page knows to ship it.',
          ),
        );
      }, 20000);
      requestBundle(reject);
    });
    run.pixi = loading;
    return loading;
  }

  function openStage(
    run: Run,
    stageOptions?: {
      readonly background?: string | null;
      readonly pointer?: boolean;
      readonly resolution?: number;
    },
  ): Promise<{ PIXI: unknown; app: unknown; canvas: HTMLCanvasElement }> {
    return loadPixi(run).then(function create(namespace: unknown) {
      const PIXI = namespace as { Application: new () => PixiApplication };
      const app = new PIXI.Application();
      const given = stageOptions ?? {};
      const init: Record<string, unknown> = {
        resizeTo: run.el,
        antialias: true,
        autoDensity: true,
        resolution:
          typeof given.resolution === 'number' && given.resolution > 0
            ? given.resolution
            : Math.min(view.devicePixelRatio || 1, 2),
      };
      if (typeof given.background === 'string' && given.background !== '') {
        init['background'] = given.background;
        init['backgroundAlpha'] = 1;
      } else {
        init['backgroundAlpha'] = 0;
      }
      function discard(): void {
        try {
          app.destroy(true, { children: true });
        } catch {
          // A half-built application has nothing to destroy.
        }
      }
      return app.init(init).then(
        function ready() {
          if (run.stopped) {
            discard();
            throw new Error('The region stopped before its stage was ready.');
          }
          const surface = app.canvas;
          const style = surface.style;
          style.position = 'absolute';
          style.top = '0';
          style.left = '0';
          style.display = 'block';
          style.zIndex = '0';
          style.pointerEvents = given.pointer === true ? 'auto' : 'none';
          run.el.appendChild(surface);
          run.cleanups.push(function destroyStage(): void {
            app.destroy({ removeView: true }, { children: true });
          });
          return { PIXI, app, canvas: surface };
        },
        function broken(error: unknown) {
          discard();
          throw error;
        },
      );
    });
  }

  /* ── one region ──────────────────────────────────────────────────────── */

  function createApi(run: Run): CkScriptApi {
    const el = run.el;
    let position = '';
    try {
      position = view.getComputedStyle(el).position;
    } catch {
      position = '';
    }
    if (position === '' || position === 'static') {
      const before = el.style.position;
      el.style.position = 'relative';
      run.cleanups.push(function restorePosition(): void {
        if (el.style.position === 'relative') el.style.position = before;
      });
    }
    return {
      root: el,
      editor: canvas,
      reducedMotion,
      onDispose: function onDispose(fn: () => void): void {
        if (typeof fn !== 'function') return;
        if (run.stopped) settle(fn, run);
        else run.cleanups.push(fn);
      },
      pixi: function pixi(): Promise<unknown> {
        return loadPixi(run);
      },
      stage: function stage(stageOptions) {
        return openStage(run, stageOptions);
      },
    };
  }

  function execute(run: Run): void {
    let result: Promise<unknown>;
    try {
      result = Promise.resolve(compile(run)(createApi(run)));
    } catch (error) {
      fail(run, error);
      return;
    }
    result.then(undefined, function rejected(error: unknown): void {
      fail(run, error);
    });
  }

  function stop(run: Run): void {
    if (run.stopped) return;
    run.stopped = true;
    runs.delete(run.el);
    for (let at = run.cleanups.length - 1; at >= 0; at -= 1) {
      const cleanup = run.cleanups[at];
      if (cleanup !== undefined) settle(cleanup, run);
    }
    run.cleanups.length = 0;
    run.el.removeAttribute(MARK);
  }

  function start(el: HTMLElement): void {
    const code = el.getAttribute(ATTRIBUTE) ?? '';
    if (code.trim() === '' || runs.has(el) || el.hasAttribute(MARK)) return;
    const id = el.getAttribute(ID_ATTRIBUTE) ?? '';
    const run: Run = { el, code, id, cleanups: [], stopped: false };
    runs.set(el, run);
    el.setAttribute(MARK, '');
    el.removeAttribute(ERROR_ATTRIBUTE);
    if (canvas) {
      const guard = guardState();
      if (guard.paused) {
        // The code this region had when the editor booted paused (first sight of it this session).
        const first = guard.seen[id] ?? code;
        guard.seen[id] = first;
        if (first === code) {
          el.setAttribute(ERROR_ATTRIBUTE, PAUSED_MESSAGE);
          return;
        }
      }
      arm(guard);
    }
    execute(run);
  }

  /* Dispose what left or changed, run what is new. */
  function reconcile(): void {
    for (const run of Array.from(runs.values())) {
      if (!run.el.isConnected || !run.el.hasAttribute(ATTRIBUTE)) stop(run);
    }
    for (const el of regionsIn()) {
      const run = runs.get(el);
      if (run?.code === (el.getAttribute(ATTRIBUTE) ?? '')) continue;
      if (run !== undefined) stop(run);
      start(el);
    }
  }

  for (const el of initial) start(el);

  let watcher: MutationObserver | null = null;
  const Mutation = (view as unknown as { MutationObserver?: typeof MutationObserver })
    .MutationObserver;
  if (watch && typeof Mutation === 'function') {
    watcher = new Mutation(function changed(records: MutationRecord[]) {
      if (disposed) return;
      let scan = false;
      for (const record of records) {
        if (record.type === 'attributes' || record.removedNodes.length > 0) scan = true;
        for (const node of Array.from(record.addedNodes)) {
          if (
            node.nodeType === 1 &&
            ((node as Element).hasAttribute(ATTRIBUTE) ||
              (node as Element).querySelector(SELECTOR) !== null)
          ) {
            scan = true;
          }
        }
      }
      if (scan) reconcile();
    });
    watcher.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [ATTRIBUTE],
    });
  }

  return function dispose() {
    if (disposed) return;
    disposed = true;
    if (watcher !== null) watcher.disconnect();
    for (const run of Array.from(runs.values())) stop(run);
  };
}
