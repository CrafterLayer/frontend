import type {
  CkEngine,
  CkEngineContext,
  CkEngineKind,
  CkEngineQueueEntry,
  CkEngines,
  CkEnginesHost,
  CkLibraryFactory,
} from '../../engines/ck-engines-shim';

import type {
  CkAudioBands,
  CkSceneContext,
  CkSceneOptions,
  CkScriptApi,
  CkScriptParamValue,
  CkSoundApi,
  ScriptsGuard,
  ScriptsHost,
} from './scripts-api';

export type {
  CkAudioBands,
  CkSceneContext,
  CkSceneOptions,
  CkScriptApi,
  CkScriptParamValue,
  CkSoundApi,
} from './scripts-api';

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
 * - A plain `ck.stage()` follows its REGION, not only the window (preview-fix 2026-10-12): Pixi's
 *   `resizeTo` hears only window resizes, so a region that grew after the stage opened (the script
 *   filling its copy, a web font, Preview's shorter viewport pushing content past a `vh` height)
 *   kept a canvas of its first size, and the scene ended part-way down while the HTML layers ran
 *   on past it. Now the canvas always fills the region (`followRegion`): a script that listens
 *   (`app.renderer.on('resize', layout)`) gets the region's size; one that never does keeps its
 *   first frame, scaled to cover the region (`object-fit: cover`, pointers mapped the same way).
 *   `ck.scene` keeps `resizeTo`: the kit follows the region itself.
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
    // pixi-studio:runtime-wiring additions (2026-10-10)
    /** The region's `data-ck-params` at start: a change re-runs it. */
    readonly paramsText: string;
    /** What `ck.params` merged (the scene's `params`). */
    params?: Record<string, CkScriptParamValue>;
    // end pixi-studio:runtime-wiring additions
  }
  interface PixiApplication {
    canvas: HTMLCanvasElement;
    init(options: Record<string, unknown>): Promise<void>;
    destroy(rendererOptions?: unknown, options?: unknown): void;
    // preview-fix (2026-10-12): what a plain stage reads to follow its region.
    readonly screen?: { readonly width: number; readonly height: number };
    readonly renderer?: PixiRenderer;
    render?(): void;
  }
  interface PixiRenderer {
    resize(width: number, height: number): void;
    listenerCount?(event: string): number;
    events?: { mapPositionToPoint?(point: { x: number; y: number }, x: number, y: number): void };
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
  const logger = (view as Window & { console: Pick<Console, 'error'> }).console;

  const ATTRIBUTE = 'data-ck-js';
  const ID_ATTRIBUTE = 'data-ck-js-id';
  const ERROR_ATTRIBUTE = 'data-ck-js-error';
  const MARK = 'data-ck-js-mounted';
  const GUARD_KEY = 'ck-js-guard';
  const PAUSED_MESSAGE = 'Scripts paused after the editor froze last time';
  const SELECTOR = '[' + ATTRIBUTE + ']';
  // pixi-studio:runtime-wiring additions (2026-10-10): held equal to STUDIO_LIB_KEYS and
  // STUDIO_PIXI_BOUND_KEYS by scripts.studio.test.ts (this body cannot import them).
  const PARAMS_ATTRIBUTE = 'data-ck-params';
  const LIB_KEYS: readonly string[] =
    'kit filters emitter physics brush rough viewport anim fx dialogue ink tilemap audio gameai hud peeps procgen gif'.split(
      ' ',
    );
  const PIXI_BOUND: readonly string[] = 'kit filters emitter viewport fx tilemap audio hud'.split(
    ' ',
  );
  const LATE_MS = 20000;
  // end pixi-studio:runtime-wiring additions
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
    logger.error('[ck-js]', run.id, error);
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
      logger.error('[ck-js]', run.id, error);
    }
  }

  /* ── pixi (ck.pixi / ck.stage) ───────────────────────────────────────── */

  function requestBundle(onError: (error: Error) => void): void {
    requestAsset('pixi', onError);
  }

  /*
    pixi-studio:runtime-wiring (2026-10-10): any engine asset, the way `pixi` always was — the
    export's `link[data-ck-engine="<kind>"]` locator names it, and it is requested once per
    document. No locator: the editor canvas or a host Preview, where `inject.ts` adds it.
  */
  function requestAsset(kind: CkEngineKind, onError: (error: Error) => void): void {
    if (page.querySelector('script[data-ck-engine="' + kind + '"]') !== null) return;
    const link = page.querySelector<HTMLLinkElement>('link[data-ck-engine="' + kind + '"]');
    if (link === null) return;
    const href = link.href !== '' ? link.href : (link.getAttribute('href') ?? '');
    if (href === '') return;
    const script = page.createElement('script');
    script.src = href;
    script.async = true;
    script.setAttribute('data-ck-engine', kind);
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
      readonly blend?: boolean;
    },
    kit?: boolean,
  ): Promise<{ PIXI: unknown; app: unknown; canvas: HTMLCanvasElement }> {
    return loadPixi(run).then(function create(namespace: unknown) {
      const PIXI = namespace as { Application: new () => PixiApplication };
      const app = new PIXI.Application();
      const given = stageOptions ?? {};
      const init: Record<string, unknown> = {
        antialias: true,
        autoDensity: true,
        resolution:
          typeof given.resolution === 'number' && given.resolution > 0
            ? given.resolution
            : Math.min(view.devicePixelRatio || 1, 2),
      };
      if (kit === true) init['resizeTo'] = run.el;
      else {
        init['width'] = Math.max(1, run.el.clientWidth);
        init['height'] = Math.max(1, run.el.clientHeight);
      }
      if (typeof given.background === 'string' && given.background !== '') {
        init['background'] = given.background;
        init['backgroundAlpha'] = 1;
      } else {
        init['backgroundAlpha'] = 0;
      }
      // pixi-studio:runtime-wiring additions (2026-10-10): advanced blend modes (DESIGN D6).
      if (given.blend === true) init['useBackBuffer'] = true;
      // end pixi-studio:runtime-wiring additions
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
          // pixi-studio (2026-10-10): the editor canvas never captures pointer input (a click selects).
          style.pointerEvents = given.pointer === true && !canvas ? 'auto' : 'none';
          run.el.appendChild(surface);
          run.cleanups.push(function destroyStage(): void {
            app.destroy({ removeView: true }, { children: true });
          });
          if (kit !== true) followRegion(run, app, surface);
          return { PIXI, app, canvas: surface };
        },
        function broken(error: unknown) {
          discard();
          throw error;
        },
      );
    });
  }

  function followRegion(run: Run, app: PixiApplication, surface: HTMLCanvasElement): void {
    const el = run.el;
    const renderer = app.renderer;
    function listening(): number {
      return renderer?.listenerCount?.('resize') ?? 0;
    }
    const before = listening();
    function follow(): void {
      const screen = app.screen;
      const width = el.clientWidth;
      const height = el.clientHeight;
      const resized = screen !== undefined && (width !== screen.width || height !== screen.height);
      if (!run.stopped && resized && width > 0 && height > 0 && listening() > before) {
        renderer?.resize(width, height);
        app.render?.();
      }
      Object.assign(surface.style, { width: '100%', height: '100%', objectFit: 'cover' });
    }
    follow();
    const events = renderer?.events;
    if (events !== undefined)
      events.mapPositionToPoint = function mapThroughCover(point, x, y): void {
        const rect = surface.getBoundingClientRect();
        const screen = app.screen ?? rect;
        const scale = Math.max(rect.width / screen.width, rect.height / screen.height) || 1;
        point.x = (x - rect.left - (rect.width - screen.width * scale) / 2) / scale;
        point.y = (y - rect.top - (rect.height - screen.height * scale) / 2) / scale;
      };
    const Observer = (view as unknown as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    if (typeof Observer !== 'function') return;
    const observer = new Observer(follow);
    observer.observe(el);
    run.cleanups.push(function unobserve(): void {
      observer.disconnect();
    });
  }

  /* ── pixi-studio:runtime-wiring additions (2026-10-10): DESIGN §B.2, §C.3 ── */

  /* `<html lang>` and direction, read at the region (the nearest `lang` / `dir` wins). */
  function langOf(el: Element): string {
    const owner = el.closest('[lang]');
    return (owner === null ? '' : (owner.getAttribute('lang') ?? '')).trim();
  }

  function rtlOf(el: Element): boolean {
    const owner = el.closest('[dir]');
    return (owner === null ? '' : (owner.getAttribute('dir') ?? '')).trim().toLowerCase() === 'rtl';
  }

  function readParams(run: Run): Record<string, unknown> {
    if (run.paramsText.trim() === '') return {};
    try {
      const parsed: unknown = JSON.parse(run.paramsText);
      return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  function stringList(value: unknown): string[] | null {
    if (!Array.isArray(value)) return null;
    const out: string[] = [];
    for (const item of value as unknown[]) {
      if (typeof item !== 'string') return null;
      out.push(item);
    }
    return out;
  }

  /* `value` as the type of `fallback`, or `fallback` when it cannot be (DESIGN §B.2 ck.params). */
  function coerceParam(value: unknown, fallback: CkScriptParamValue): CkScriptParamValue {
    if (typeof fallback === 'number') {
      const number =
        typeof value === 'number'
          ? value
          : typeof value === 'string' && value.trim() !== ''
            ? Number(value)
            : Number.NaN;
      return Number.isFinite(number) ? number : fallback;
    }
    if (typeof fallback === 'boolean') {
      if (value === true || value === false) return value;
      if (value === 'true') return true;
      if (value === 'false') return false;
      return fallback;
    }
    const list = stringList(value);
    if (Array.isArray(fallback)) {
      // A palette: a list of colours, or 'theme'.
      if (list !== null) return list;
      return value === 'theme' ? 'theme' : fallback;
    }
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    // A palette whose default is 'theme' takes a list of colours.
    if (list !== null && fallback === 'theme') return list;
    return fallback;
  }

  function mergeParams(run: Run, defaults: unknown): Record<string, CkScriptParamValue> {
    const given = readParams(run);
    const merged: Record<string, CkScriptParamValue> = {};
    if (defaults !== null && typeof defaults === 'object' && !Array.isArray(defaults)) {
      const source = defaults as Record<string, CkScriptParamValue>;
      for (const [key, fallback] of Object.entries(source)) {
        merged[key] = Object.prototype.hasOwnProperty.call(given, key)
          ? coerceParam(given[key], fallback)
          : fallback;
      }
    }
    run.params = merged;
    return merged;
  }

  /*
    What a `lib-<key>` or `sound` engine provides, requested ONCE per document: queued on the
    document element (always connected, so a region leaving does not strand the others) and
    cached on `window.ckEngines`. A request that fails or never arrives (20 s) is forgotten, so a
    later use may ask again.
  */
  function provided(kind: CkEngineKind, advice: string): Promise<unknown> {
    const api = ensureCkEngines(view);
    const cache = api.provided ?? {};
    api.provided = cache;
    const known = cache[kind];
    if (known !== undefined) return known;
    const host = page.documentElement;
    const loading = new Promise<unknown>(function executor(resolve, reject) {
      let entry: CkEngineQueueEntry | null = null;
      const timer = view.setTimeout(function late(): void {
        if (entry !== null) {
          const at = api.queue.indexOf(entry);
          if (at >= 0) api.queue.splice(at, 1);
        }
        reject(new Error(advice));
      }, LATE_MS);
      const ctx: CkEngineContext = {
        still: false,
        canvas,
        rtl: rtlOf(host),
        lang: langOf(host),
        onPlay: function onPlay(): void {
          /* a library has nothing to replay */
        },
        onStop: function onStop(): void {
          /* a library has nothing to stop */
        },
        provide: function provide(value: unknown): void {
          view.clearTimeout(timer);
          resolve(value);
        },
      };
      const engine = api.engines[kind];
      if (engine) {
        try {
          engine.mount(host, ctx);
        } catch (error) {
          view.clearTimeout(timer);
          reject(error instanceof Error ? error : new Error(String(error)));
        }
        return;
      }
      entry = { kind, el: host, ctx };
      api.queue.push(entry);
      requestAsset(kind, function failed(error: Error): void {
        view.clearTimeout(timer);
        reject(error);
      });
    });
    cache[kind] = loading;
    loading.then(undefined, function forget(): void {
      if (cache[kind] === loading) Reflect.deleteProperty(cache, kind);
    });
    return loading;
  }

  /* The namespace a library's factory makes, ONCE per document (DESIGN D2). */
  function made(kind: CkEngineKind, factory: unknown, PIXI: unknown): unknown {
    const api = ensureCkEngines(view);
    const store = api.made ?? {};
    api.made = store;
    if (Object.prototype.hasOwnProperty.call(store, kind)) return store[kind];
    let namespace: unknown = factory;
    if (
      factory !== null &&
      typeof factory === 'object' &&
      typeof (factory as Partial<CkLibraryFactory>).create === 'function'
    ) {
      namespace = (factory as CkLibraryFactory).create(PIXI);
    }
    store[kind] = namespace;
    return namespace;
  }

  function libraryAdvice(key: string): string {
    return (
      'The ck-lib-' +
      key +
      ".js library did not load. Name it literally — ck.use('" +
      key +
      "') or ck.scene({ libs: ['" +
      key +
      "'] }) — so the page knows to ship it."
    );
  }

  function loadLibraries(
    run: Run,
    requested: readonly unknown[],
  ): Promise<Record<string, unknown>> {
    const keys: string[] = [];
    for (const item of requested) {
      const list: readonly unknown[] = Array.isArray(item) ? (item as unknown[]) : [item];
      for (const key of list) {
        if (typeof key !== 'string' || !LIB_KEYS.includes(key)) {
          return Promise.reject(
            new Error(
              'Unknown library "' +
                String(key) +
                '". Known libraries: ' +
                LIB_KEYS.join(', ') +
                '.',
            ),
          );
        }
        if (!keys.includes(key)) keys.push(key);
      }
    }
    // Pixi FIRST for a Pixi-bound key: its factory binds to the page's one namespace.
    const bound = keys.some(function pixiBound(key: string): boolean {
      return PIXI_BOUND.includes(key);
    });
    const pixi = bound ? loadPixi(run) : null;
    if (pixi !== null)
      pixi.then(undefined, function handledBelow(): void {
        /* each library below reports the failure */
      });
    const loading = keys.map(function each(key: string): Promise<unknown> {
      const kind = ('lib-' + key) as CkEngineKind;
      return provided(kind, libraryAdvice(key)).then(function bind(factory: unknown) {
        const wantsPixi =
          PIXI_BOUND.includes(key) ||
          (factory !== null &&
            typeof factory === 'object' &&
            (factory as Partial<CkLibraryFactory>).pixi === true);
        if (!wantsPixi) return made(kind, factory, undefined);
        return (pixi ?? loadPixi(run)).then(function withPixi(PIXI: unknown) {
          return made(kind, factory, PIXI);
        });
      });
    });
    return Promise.all(loading).then(function collect(namespaces: unknown[]) {
      const out: Record<string, unknown> = {};
      keys.forEach(function put(key: string, at: number): void {
        out[key] = namespaces[at];
      });
      return out;
    });
  }

  function openScene(run: Run, ck: CkScriptApi, options: unknown): Promise<unknown> {
    const given = (
      options !== null && typeof options === 'object' ? options : {}
    ) as CkSceneOptions;
    const keys: string[] = ['kit'];
    const extra: readonly unknown[] = Array.isArray(given.libs) ? (given.libs as unknown[]) : [];
    for (const key of extra) {
      if (typeof key !== 'string' || !keys.includes(key)) keys.push(key as string);
    }
    // Audio bands start loading the sound engine (never on the canvas, never under reduced motion).
    if (given.audio === true && !canvas && !reducedMotion) ck.sound.analyser();
    const stage = openStage(
      run,
      {
        background: given.background ?? null,
        pointer: given.pointer === true,
        blend: given.blend === true,
      },
      true,
    );
    const libs = loadLibraries(run, keys);
    return Promise.all([stage, libs]).then(function compose(pair) {
      const opened = pair[0];
      const loaded = pair[1];
      const kit = loaded['kit'] as { createScene?: unknown } | null | undefined;
      if (kit === null || kit === undefined || typeof kit.createScene !== 'function') {
        throw new Error('ck-lib-kit.js loaded without createScene().');
      }
      const lib: Record<string, unknown> = {};
      for (const key of keys) if (key !== 'kit') lib[key] = loaded[key];
      const context: CkSceneContext = {
        ck,
        PIXI: opened.PIXI,
        app: opened.app,
        canvas: opened.canvas,
        root: run.el,
        lib,
        options: given,
        params: run.params ?? {},
        editor: canvas,
        reducedMotion,
        lang: ck.lang,
        rtl: ck.rtl,
        sound: ck.sound,
        onDispose: function onDispose(fn: () => void): void {
          ck.onDispose(fn);
        },
      };
      return (kit.createScene as (context: CkSceneContext) => unknown)(context);
    });
  }

  function silentBands(): CkAudioBands {
    return { level: 0, bass: 0, mid: 0, treble: 0, beat: false, active: false };
  }

  /*
    `ck.sound` (DESIGN §C.3): a proxy that loads ck-sound.js on first use — never on the editor
    canvas, where it stays a silent stub. Before the engine arrives `play` is a no-op (false), an
    ambient bed waits for it, `analyser` reads zeros. The engine alone decides when anything is
    audible: muted by default, unlocked only inside the reader's gesture.
  */
  function createSound(run: Run): CkSoundApi {
    let real: CkSoundApi | null = null;
    let loading: Promise<unknown> | null = null;
    let wantMuted: boolean | null = null;
    const listeners: (() => void)[] = [];
    function load(): Promise<unknown> | null {
      if (canvas) return null;
      if (loading !== null) return loading;
      const pending = provided(
        'sound',
        'The ck-sound.js engine did not load. Call ck.sound literally (or use data-ck-sound) so the page knows to ship it.',
      ).then(function got(engine: unknown) {
        const api = engine as CkSoundApi;
        real = api;
        if (wantMuted !== null) api.setMuted(wantMuted);
        for (const fn of listeners) api.onChange(fn);
        listeners.length = 0;
        return engine;
      });
      loading = pending;
      pending.then(undefined, function failed(error: unknown): void {
        loading = null;
        fail(run, error);
      });
      return pending;
    }
    function noop(): void {
      /* nothing is playing */
    }
    const proxy = {
      play: function play(
        ref: string | readonly number[],
        playOptions?: Readonly<Record<string, unknown>>,
      ): boolean {
        if (canvas) return false;
        if (real !== null) return real.play(ref, playOptions);
        void load();
        return false;
      },
      ambient: function ambient(
        ref: string | readonly number[],
        ambientOptions?: Readonly<Record<string, unknown>>,
      ): () => void {
        if (canvas || reducedMotion) return noop;
        let stopped = false;
        let stopReal: (() => void) | null = null;
        function stop(): void {
          if (stopped) return;
          stopped = true;
          if (stopReal !== null) stopReal();
        }
        function begin(): void {
          if (stopped || real === null) return;
          const result = real.ambient(ref, ambientOptions);
          stopReal = typeof result === 'function' ? result : null;
        }
        if (real !== null) begin();
        else load()?.then(begin, noop);
        run.cleanups.push(stop);
        return stop;
      },
      analyser: function analyser(): CkAudioBands {
        if (real !== null && !reducedMotion) return real.analyser();
        if (!canvas) void load();
        return silentBands();
      },
      setMuted: function setMuted(muted: boolean): void {
        wantMuted = muted;
        if (real !== null) real.setMuted(wantMuted);
        else void load();
      },
      onChange: function onChange(fn: () => void): void {
        if (typeof fn !== 'function') return;
        if (real !== null) real.onChange(fn);
        else listeners.push(fn);
      },
    };
    Object.defineProperty(proxy, 'muted', {
      enumerable: true,
      get: function muted(): boolean {
        return real === null ? true : real.muted;
      },
    });
    Object.defineProperty(proxy, 'unlocked', {
      enumerable: true,
      get: function unlocked(): boolean {
        return real === null ? false : real.unlocked;
      },
    });
    return proxy as unknown as CkSoundApi;
  }

  /* ── end pixi-studio:runtime-wiring additions ── */

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
    const ck: CkScriptApi = {
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
      // pixi-studio:runtime-wiring additions (2026-10-10)
      params: function params<T extends Record<string, CkScriptParamValue>>(defaults: T): T {
        return mergeParams(run, defaults) as T;
      },
      use: function use(): Promise<Record<string, unknown>> {
        // `arguments`, not a rest parameter: the body stays plain ES2015 for every target.
        // eslint-disable-next-line prefer-rest-params -- see above
        return loadLibraries(run, Array.prototype.slice.call(arguments) as unknown[]);
      },
      scene: function scene(sceneOptions?: CkSceneOptions): Promise<unknown> {
        return openScene(run, ck, sceneOptions);
      },
      sound: createSound(run),
      lang: langOf(el),
      rtl: rtlOf(el),
      // end pixi-studio:runtime-wiring additions
    };
    return ck;
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
    const paramsText = el.getAttribute(PARAMS_ATTRIBUTE) ?? ''; // pixi-studio:runtime-wiring (2026-10-10)
    const run: Run = { el, code, id, cleanups: [], stopped: false, paramsText };
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
      // pixi-studio:runtime-wiring (2026-10-10): a params edit re-runs the region too.
      if (
        run?.code === (el.getAttribute(ATTRIBUTE) ?? '') &&
        run.paramsText === (el.getAttribute(PARAMS_ATTRIBUTE) ?? '')
      )
        continue;
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
      attributeFilter: [ATTRIBUTE, PARAMS_ATTRIBUTE], // pixi-studio:runtime-wiring (2026-10-10): + params
    });
  }

  return function dispose() {
    if (disposed) return;
    disposed = true;
    if (watcher !== null) watcher.disconnect();
    for (const run of Array.from(runs.values())) stop(run);
  };
}
