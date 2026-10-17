import type {
  CkEngine,
  CkEngineContext,
  CkEngineKind,
  CkEngines,
  CkEnginesHost,
} from './ck-engines-shim';

/*
 * The minimal anime.js v4 surface the recipes use: the subset bundled into TIMELINE_SOURCE
 * (anime.js 4.5.0, MIT — createTimeline, animate, stagger, onScroll, splitText), published as
 * `window.ckAnime`. Types only: they vanish at compile time, so the serialised runner still has
 * no imports.
 */
export type AnimeParams = Record<string, unknown>;

export interface AnimePlayableLike {
  /** Total length in ms. */
  readonly duration: number;
  play(): unknown;
  pause(): unknown;
  restart(): unknown;
  /** Renders `time` (ms); a paused animation stays paused. */
  seek(time: number, muteCallbacks?: boolean): unknown;
  cancel(): unknown;
  /** Cancels and restores every inline value the animation touched. */
  revert(): unknown;
}

export interface AnimeTimelineLike extends AnimePlayableLike {
  add(targets: unknown, params: AnimeParams, position?: number | string): AnimeTimelineLike;
  /** Renders every child's initial (from) state, staggered ones included; keeps it paused. */
  init(): unknown;
}

export interface AnimeScrollObserverLike {
  /** Scroll speed of the observed container, in px per ms. */
  readonly velocity: number;
  /** True while the container scrolls back (up). */
  readonly backward: boolean;
  revert(): unknown;
}

export interface AnimeTextSplitterLike {
  readonly words: HTMLElement[];
  /** Restores the element's original markup. */
  revert(): unknown;
}

export interface AnimeLike {
  createTimeline(params: AnimeParams): AnimeTimelineLike;
  animate(targets: unknown, params: AnimeParams): AnimePlayableLike;
  stagger(value: number, params?: AnimeParams): unknown;
  onScroll(params: AnimeParams): AnimeScrollObserverLike;
  splitText(target: Element, params: AnimeParams): AnimeTextSplitterLike;
}

export interface TimelineWindow extends CkEnginesHost {
  ckAnime?: AnimeLike;
  /**
   * Canvas only: the element+recipe keys that already played while in view. It lives on the
   * frame window so a React re-commit (dispose + mount of the same element) does not replay.
   */
  ckTimelinePlayed?: Record<string, boolean>;
  matchMedia?: (query: string) => { matches: boolean };
}

/**
 * The timeline engine (media-motion DESIGN §C.2, §C.3; gsap-pixi SPEC runtime contract 1, 2, 5):
 * registers `win.ckEngines.engines.timeline` and mounts every queued `data-ck-timeline` element.
 *
 * It runs AFTER the anime.js subset in `assets/ck-timeline.js` (export) or in the canvas frame's
 * injected script, and reads `win.ckAnime`. GSAP is gone: its licence prohibits no-code visual
 * animation builders (durable/gsap-pixi/LICENCE.md). Recipe names and attributes are unchanged.
 *
 * ## Why one self-contained function
 *
 * It is serialised with `Function.prototype.toString` (export: banner + TIMELINE_SOURCE +
 * `;(installTimelineEngine)(window);`), so it has NO runtime imports and reads NO module-scope
 * identifier; the `ensureCkEngines` declaration below is a verbatim copy of
 * `./ck-engines-shim.ts` (held equal by `ckEnginesShimOf` in the tests).
 *
 * ## Modes
 *
 * - **Published / Preview** (`ctx.canvas` and `ctx.still` false): scroll-driven. An entrance
 *   (`split-reveal`, `stagger-in`, `fade-in`, `slide-in`) plays once when the element's top
 *   reaches 85% of the viewport, or follows the scroll with `data-ck-scrub="true"`. The
 *   scroll-linked recipes follow the scroll, smoothed unless `data-ck-scrub="false"`.
 *   Content already on screen at mount is never hidden: such an entrance does nothing.
 * - **Canvas** (`ctx.canvas`): never restructures the DOM React owns (no word spans, no pin)
 *   and listens to no pointer. Each recipe is a plain timeline that rests at its final state,
 *   AUTOPLAYS when the element enters the frame viewport, replays on Preview (`ctx.onPlay`) and
 *   when it re-enters after fully leaving. A re-mount of the same element+recipe while in view
 *   does not replay (keys on `window.ckTimelinePlayed`); a newly chosen recipe plays at once.
 *   Scroll-linked recipes play a demo, 0 → 1 → rest.
 * - **Still** (legacy `ctx.still`, not canvas): the rest state; Preview plays it.
 * - Reduced motion: nothing at all (and the pack never loads this asset).
 *
 * ## Recipes
 *
 * `split-reveal` words rise in (published: anime `splitText`, words only — never chars, so
 * Arabic keeps its joined letters; canvas: the whole element). `stagger-in` direct children
 * (not scene layers, not marquee clones). `fade-in` opacity + a small rise. `slide-in` from the
 * inline-start side (mirrored under RTL). `pin-sequence` the steps after the first child reveal
 * while the element is held. `horizontal-scroll` the first child (the track) slides sideways
 * while the element is held (RTL mirrored). `parallax-depth` `[data-ck-depth]` layers drift at
 * three depths, or the element itself when it has none. `scrub-scale` the media grows to full
 * size. `velocity-marquee` a marquee skews and speeds up with the scroll velocity.
 *
 * ## The pin (anime.js has none)
 *
 * Emulated without reparenting: while held, the element is translated down by exactly the
 * scrolled distance (a direct, unsmoothed scroll link) and its `margin-block-end` grows by the
 * held distance so the content after it waits. The transform follows scroll events, so a fast
 * threaded scroll can lag it by a frame; it is rebuilt when the viewport width changes.
 */
export function installTimelineEngine(win: TimelineWindow): void {
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

  const animeRef = win.ckAnime;
  if (!animeRef) return;
  const anime: AnimeLike = animeRef;

  /* The fixed param tables (closed vocabulary: data-ck-ease/speed/stagger/delay/scrub/depth). */
  const EASES: Record<string, string> = {
    standard: 'outCubic',
    emphasized: 'outExpo',
    spring: 'outBack(1.6)',
    bounce: 'outBounce',
    linear: 'linear',
  };
  /** ms */
  const DURATIONS: Record<string, number> = { slow: 1300, normal: 800, fast: 500 };
  /** ms between two targets */
  const STAGGERS: Record<string, number> = { sm: 50, md: 100, lg: 180 };
  /** data-ck-delay is a step count; one step is 80 ms, like the CSS presets. */
  const DELAY_STEP = 80;
  const DELAYS: Record<string, number> = { '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6 };
  /** px a layer drifts each way, by data-ck-depth. */
  const DEPTH_SHIFT: Record<string, number> = { '1': 24, '2': 56, '3': 96 };
  /** Where an entrance starts: the element's top reaches 85% of the viewport height. */
  const ENTRANCE_START = 0.85;
  /** One scroll-linked timeline spans this many ms; only its progress matters. */
  const SPAN = 1000;
  /** anime.js `sync` smoothing for scrubbed recipes (1 = direct, lower = smoother). */
  const SMOOTH = 0.25;
  /** pin-sequence holds the element this many viewport heights per step. */
  const HOLD_PER_STEP = 0.8;
  /** Canvas demo of a scroll-linked recipe: ms to play 0 → 1, then back to rest. */
  const DEMO_OUT = 1600;
  const DEMO_BACK = 900;
  const RECIPES = [
    'split-reveal',
    'stagger-in',
    'pin-sequence',
    'horizontal-scroll',
    'parallax-depth',
    'scrub-scale',
    'velocity-marquee',
    'fade-in',
    'slide-in',
  ];
  /** Recipes whose from-state hides the element (gated on "starts below the fold"). */
  const ENTRANCES = ['split-reveal', 'stagger-in', 'fade-in', 'slide-in'];
  /** Recipes that hold the element (the emulated pin). */
  const PINNED = ['pin-sequence', 'horizontal-scroll'];

  function pick<T>(table: Record<string, T>, key: string | null, fallback: T): T {
    if (key === null || !Object.prototype.hasOwnProperty.call(table, key)) return fallback;
    return table[key] ?? fallback;
  }

  function filled(value: string | null | undefined): string {
    return typeof value === 'string' ? value : '';
  }

  function viewOf(el: HTMLElement): Window & TimelineWindow {
    return (el.ownerDocument.defaultView ?? win) as Window & TimelineWindow;
  }

  function prefersMotion(view: TimelineWindow): boolean {
    try {
      return view.matchMedia?.('(prefers-reduced-motion: reduce)').matches !== true;
    } catch {
      return true;
    }
  }

  function viewportHeight(el: HTMLElement, view: Window): number {
    return view.innerHeight > 0 ? view.innerHeight : el.ownerDocument.documentElement.clientHeight;
  }

  /** Direct children that are content: not a scene layer, not a marquee clone. */
  function childrenOf(el: Element): HTMLElement[] {
    const out: HTMLElement[] = [];
    for (const child of Array.from(el.children)) {
      if (child.hasAttribute('data-ck-clone') || child.hasAttribute('data-ck-scene-layer')) continue;
      out.push(child as HTMLElement);
    }
    return out;
  }

  /**
   * Whether the recipe may start now without hiding content that already painted: an entrance
   * needs its element below 85% of the viewport, pin-sequence needs every step below the fold.
   */
  function due(recipe: string, el: HTMLElement, view: Window): boolean {
    const height = viewportHeight(el, view);
    if (recipe === 'pin-sequence') {
      const steps = childrenOf(el).slice(1);
      if (steps.length === 0) return false;
      return steps.every(function below(step) {
        return step.getBoundingClientRect().top > height;
      });
    }
    if (ENTRANCES.includes(recipe)) return el.getBoundingClientRect().top > height * ENTRANCE_START;
    return true;
  }

  function setRate(marquee: Element, rate: number): void {
    for (const child of Array.from(marquee.children)) {
      const animated = child as Element & { getAnimations?: () => { playbackRate: number }[] };
      if (typeof animated.getAnimations !== 'function') continue;
      for (const animation of animated.getAnimations()) animation.playbackRate = rate;
    }
  }

  /** Grows `margin-block-end` by `extra` px (room for the held element); returns the undo. */
  function reserve(el: HTMLElement, view: Window, extra: number): () => void {
    const before = el.style.getPropertyValue('margin-block-end');
    let current = 0;
    try {
      current = parseFloat(view.getComputedStyle(el).getPropertyValue('margin-block-end')) || 0;
    } catch {
      current = 0;
    }
    el.style.setProperty('margin-block-end', String(current + extra) + 'px');
    return function release(): void {
      if (before === '') el.style.removeProperty('margin-block-end');
      else el.style.setProperty('margin-block-end', before);
    };
  }

  /** The canvas memory key: the block node, the element's path inside it, the recipe. */
  function playedKey(el: HTMLElement, recipe: string): string {
    const node = el.closest('[data-bldr-node]');
    const id = node === null ? '' : filled(node.getAttribute('data-bldr-node'));
    const written = filled(el.getAttribute('data-ck-path'));
    if (written !== '') return id + '|' + written + '|' + recipe;
    const top = node ?? el.ownerDocument.body;
    const path: string[] = [];
    let at: HTMLElement = el;
    while (at !== top) {
      const parent = at.parentElement;
      if (parent === null) break;
      path.unshift(String(childrenOf(parent).indexOf(at)));
      at = parent;
    }
    return id + '|' + path.join('.') + '|' + recipe;
  }

  function playedOf(view: TimelineWindow): Record<string, boolean> {
    const existing = view.ckTimelinePlayed;
    if (existing) return existing;
    const created: Record<string, boolean> = {};
    view.ckTimelinePlayed = created;
    return created;
  }

  interface Built {
    tl: AnimeTimelineLike | null;
    /** Timeline progress at rest: 1 for entrances, 0 for the track, 0.5 for parallax. */
    rest: number;
    /** A scroll-linked recipe: on the canvas it plays a demo 0 → 1 → rest. */
    demo: boolean;
    cleanup: (() => void)[];
  }

  /**
   * Builds a recipe. `live`: published, scroll-driven (anime `onScroll`), may split words and
   * pin. Not live: a paused plain timeline, no observer, no DOM restructuring (canvas, still).
   */
  function build(recipe: string, el: HTMLElement, ctx: CkEngineContext, live: boolean): Built {
    const view = viewOf(el);
    const sign = ctx.rtl ? -1 : 1;
    const ease = pick(EASES, el.getAttribute('data-ck-ease'), 'outCubic');
    const duration = pick(DURATIONS, el.getAttribute('data-ck-speed'), 800);
    const delay = pick(DELAYS, el.getAttribute('data-ck-delay'), 0) * DELAY_STEP;
    const scrubAttr = el.getAttribute('data-ck-scrub');
    /* Scroll-linked recipes: smoothed unless data-ck-scrub="false" (direct). Entrances: play once
       on enter unless data-ck-scrub="true". */
    const sync: number | boolean = scrubAttr === 'false' ? true : SMOOTH;
    const cleanup: (() => void)[] = [];
    const none: Built = { tl: null, rest: 1, demo: false, cleanup: cleanup };

    function timeline(observer: AnimeParams | null): AnimeTimelineLike {
      const params: AnimeParams = { autoplay: false, defaults: { ease: ease, duration: duration } };
      if (observer && live) {
        const watch: AnimeParams = { target: el };
        for (const key of Object.keys(observer)) watch[key] = observer[key];
        params['autoplay'] = anime.onScroll(watch);
      }
      return anime.createTimeline(params);
    }

    /** An entrance: plays once at 85% (or follows the scroll with data-ck-scrub="true"). */
    function entrance(): AnimeTimelineLike {
      if (!live) return timeline(null);
      const start = { container: String(ENTRANCE_START * 100) + '%', target: 'top' };
      if (scrubAttr === 'true') {
        return timeline({ enter: start, leave: { container: '55%', target: 'bottom' }, sync: sync });
      }
      const tl = timeline(null);
      let played = false;
      const watcher = anime.onScroll({
        target: el,
        enter: start,
        repeat: false,
        onEnter: function entered(): void {
          if (played) return;
          played = true;
          tl.play();
        },
      });
      cleanup.push(function unwatch() {
        watcher.revert();
      });
      return tl;
    }

    /** The held element (published only): the transform pin plus the room after it. */
    function hold(distance: number): AnimeTimelineLike {
      cleanup.push(reserve(el, view, distance));
      const tl = timeline({
        enter: { container: 'top', target: 'top' },
        leave: { container: 'top', target: distance },
        /* Direct: a smoothed pin would float behind the scroll. */
        sync: true,
      });
      tl.add(el, { translateY: [0, distance], ease: 'linear', duration: SPAN }, 0);
      return tl;
    }

    if (recipe === 'split-reveal') {
      let targets: Element[] = [el];
      if (live) {
        /* Words only, never chars: Arabic letters stay joined. */
        const split = anime.splitText(el, {
          words: true,
          chars: false,
          lines: false,
          accessible: true,
        });
        if (split.words.length > 0) targets = split.words;
        cleanup.push(function unsplit() {
          split.revert();
        });
      }
      const tl = entrance();
      tl.add(targets, {
        opacity: { from: 0 },
        translateY: { from: '0.6em' },
        delay: anime.stagger(pick(STAGGERS, el.getAttribute('data-ck-stagger'), 50), {
          start: delay,
        }),
      });
      return { tl: tl, rest: 1, demo: false, cleanup: cleanup };
    }

    if (recipe === 'stagger-in') {
      const items = childrenOf(el);
      const tl = entrance();
      tl.add(items.length > 0 ? items : [el], {
        opacity: { from: 0 },
        translateY: { from: 32 },
        delay: anime.stagger(pick(STAGGERS, el.getAttribute('data-ck-stagger'), 100), {
          start: delay,
        }),
      });
      return { tl: tl, rest: 1, demo: false, cleanup: cleanup };
    }

    if (recipe === 'fade-in') {
      const tl = entrance();
      tl.add(el, { opacity: { from: 0 }, translateY: { from: 24 }, delay: delay });
      return { tl: tl, rest: 1, demo: false, cleanup: cleanup };
    }

    if (recipe === 'slide-in') {
      /* From the inline-start side: the left in LTR, the right in RTL. */
      const tl = entrance();
      tl.add(el, { opacity: { from: 0 }, translateX: { from: -48 * sign }, delay: delay });
      return { tl: tl, rest: 1, demo: false, cleanup: cleanup };
    }

    if (recipe === 'pin-sequence') {
      const steps = childrenOf(el).slice(1);
      if (steps.length === 0) return none;
      if (!live) {
        const tl = timeline(null);
        steps.forEach(function step(item, index) {
          tl.add(item, { opacity: { from: 0 }, translateY: { from: 40 } }, index * duration * 0.6);
        });
        return { tl: tl, rest: 1, demo: false, cleanup: cleanup };
      }
      const distance = Math.round(steps.length * HOLD_PER_STEP * viewportHeight(el, view));
      const tl = hold(distance);
      const slot = SPAN / steps.length;
      steps.forEach(function step(item, index) {
        tl.add(
          item,
          { opacity: { from: 0 }, translateY: { from: 40 }, duration: slot, ease: ease },
          index * slot,
        );
      });
      return { tl: tl, rest: 1, demo: true, cleanup: cleanup };
    }

    if (recipe === 'horizontal-scroll') {
      const track = childrenOf(el)[0];
      if (!track) return none;
      const distance = Math.max(0, Math.round(track.scrollWidth - el.clientWidth));
      if (distance === 0) return none;
      const tl = live ? hold(distance) : timeline(null);
      tl.add(track, { translateX: [0, -distance * sign], ease: 'linear', duration: SPAN }, 0);
      return { tl: tl, rest: 0, demo: true, cleanup: cleanup };
    }

    if (recipe === 'parallax-depth') {
      const tl = timeline({
        enter: { container: 'bottom', target: 'top' },
        leave: { container: 'top', target: 'bottom' },
        sync: sync,
      });
      let layered = false;
      for (const layer of Array.from(el.querySelectorAll('[data-ck-depth]'))) {
        if (layer.closest('[data-ck-scene-layer]') !== null) continue;
        const shift = pick(DEPTH_SHIFT, layer.getAttribute('data-ck-depth'), 0);
        if (shift === 0) continue;
        tl.add(layer, { translateY: [shift, -shift], ease: 'linear', duration: SPAN }, 0);
        layered = true;
      }
      if (!layered) {
        /* No depth layers: the element itself drifts, gently (depth 1 unless it names one). */
        const shift = pick(DEPTH_SHIFT, el.getAttribute('data-ck-depth'), 24);
        tl.add(el, { translateY: [shift, -shift], ease: 'linear', duration: SPAN }, 0);
      }
      return { tl: tl, rest: 0.5, demo: true, cleanup: cleanup };
    }

    if (recipe === 'scrub-scale') {
      const media = el.matches('img, video, picture')
        ? el
        : (el.querySelector('img, video, picture') ?? el);
      const tl = timeline({
        enter: { container: 'bottom', target: 'top' },
        leave: { container: 'center', target: 'center' },
        sync: sync,
      });
      tl.add(media, {
        scale: { from: 0.86 },
        borderRadius: { from: '24px' },
        ease: 'linear',
        duration: SPAN,
      });
      return { tl: tl, rest: 1, demo: true, cleanup: cleanup };
    }

    if (recipe === 'velocity-marquee') {
      const marquee = el.matches('[data-ck-behavior="marquee"]')
        ? el
        : (el.querySelector<HTMLElement>('[data-ck-behavior="marquee"]') ?? el);
      if (!live) {
        const tl = timeline(null);
        tl.add(marquee, { skewX: -6 * sign, duration: 300, ease: 'outQuad' }).add(marquee, {
          skewX: 0,
          duration: 600,
          ease: 'outQuart',
        });
        return { tl: tl, rest: 1, demo: false, cleanup: cleanup };
      }
      const base = marquee.style.transform;
      let skew: AnimePlayableLike | null = null;
      const watcher = anime.onScroll({
        target: el,
        enter: { container: 'bottom', target: 'top' },
        leave: { container: 'top', target: 'bottom' },
        onUpdate: function onUpdate(self: AnimeScrollObserverLike): void {
          /* px per second, negative while scrolling back. */
          const velocity = Math.abs(self.velocity) * 1000 * (self.backward ? -1 : 1);
          setRate(marquee, 1 + Math.min(3, Math.abs(velocity) / 800));
          skew = anime.animate(marquee, {
            skewX: Math.max(-8, Math.min(8, (velocity / -300) * sign)),
            duration: 250,
            ease: 'outQuad',
            onComplete: function settle(): void {
              setRate(marquee, 1);
              skew = anime.animate(marquee, { skewX: 0, duration: 600, ease: 'outQuart' });
            },
          });
        },
      });
      cleanup.push(function unvelocity() {
        watcher.revert();
        if (skew) skew.cancel();
        skew = null;
        setRate(marquee, 1);
        marquee.style.transform = base;
      });
      return { tl: null, rest: 1, demo: false, cleanup: cleanup };
    }

    return none;
  }

  function teardown(built: Built | null): void {
    if (!built) return;
    const tl = built.tl;
    built.tl = null;
    if (tl) {
      try {
        tl.revert();
      } catch {
        /* a failed revert must not stop the cleanups */
      }
    }
    for (let at = built.cleanup.length - 1; at >= 0; at -= 1) {
      try {
        built.cleanup[at]?.();
      } catch {
        /* a failed undo must not stop the others */
      }
    }
    built.cleanup.length = 0;
  }

  /** Canvas (and legacy still): a plain timeline at rest; plays on entry (canvas) and Preview. */
  function mountStage(
    recipe: string,
    el: HTMLElement,
    ctx: CkEngineContext,
    view: Window & TimelineWindow,
    canvas: boolean,
  ): () => void {
    let built: Built | null = build(recipe, el, ctx, false);
    let driver: AnimePlayableLike | null = null;
    let disposed = false;

    function stopDriver(): void {
      if (driver) driver.cancel();
      driver = null;
    }

    function toRest(): void {
      stopDriver();
      const tl = built?.tl;
      if (!built || !tl) return;
      tl.pause();
      tl.seek(tl.duration * built.rest, true);
    }

    function play(): void {
      const tl = built?.tl;
      if (disposed || !built || !tl || !prefersMotion(view)) return;
      stopDriver();
      if (!built.demo) {
        tl.restart();
        return;
      }
      /* A scroll-linked recipe on the canvas: scrub 0 → 1, then back to its rest. */
      const rest = built.rest;
      const state = { p: 0 };
      const render = function render(): void {
        tl.seek(tl.duration * state.p, true);
      };
      tl.pause();
      tl.seek(0, true);
      driver = anime.animate(state, {
        p: 1,
        duration: DEMO_OUT,
        ease: 'inOutQuad',
        onUpdate: render,
        onComplete: function back(): void {
          if (disposed || rest === 1) {
            driver = null;
            return;
          }
          driver = anime.animate(state, {
            p: rest,
            duration: DEMO_BACK,
            ease: 'inOutQuad',
            onUpdate: render,
          });
        },
      });
    }

    toRest();
    ctx.onPlay(play);
    ctx.onStop(toRest);

    let unobserve = function none(): void {
      /* still: no autoplay */
    };
    if (canvas && built.tl) {
      const key = playedKey(el, recipe);
      const played = playedOf(view);
      const Intersection = (view as unknown as { IntersectionObserver?: typeof IntersectionObserver })
        .IntersectionObserver;
      if (typeof Intersection !== 'function') {
        if (played[key] !== true) {
          played[key] = true;
          play();
        }
      } else {
        let inView = false;
        const observer = new Intersection(
          function seen(entries: IntersectionObserverEntry[]) {
            const last = entries[entries.length - 1];
            if (!last) return;
            if (!last.isIntersecting) {
              /* Fully left: the next entry replays. */
              inView = false;
              Reflect.deleteProperty(played, key);
              return;
            }
            if (inView) return;
            inView = true;
            /* Already played while in view: a re-mount (React re-commit) stays at rest. */
            if (played[key] === true) return;
            played[key] = true;
            play();
          },
          { threshold: 0 },
        );
        observer.observe(el);
        unobserve = function disconnect(): void {
          observer.disconnect();
        };
      }
    }

    return function dispose(): void {
      disposed = true;
      unobserve();
      stopDriver();
      teardown(built);
      built = null;
    };
  }

  /** Published / Preview: scroll-driven, off under reduced motion (also when it changes later). */
  function mountScroll(
    recipe: string,
    el: HTMLElement,
    ctx: CkEngineContext,
    view: Window & TimelineWindow,
  ): () => void {
    let live: Built | null = null;
    let disposed = false;

    function start(checked: boolean): void {
      if (live || disposed || !prefersMotion(view)) return;
      /* An entrance on content already on screen would hide what painted: leave it be. */
      if (!checked && !due(recipe, el, view)) return;
      live = build(recipe, el, ctx, true);
      /* A recipe that hides (it was due: below the fold) renders EVERY child's from-state now:
         anime renders a paused timeline only when asked, and a seek skips the staggered tweens
         that have not started, so later words or steps would show, vanish, then fade in. */
      const tl = live.tl;
      if (tl && (ENTRANCES.includes(recipe) || recipe === 'pin-sequence')) tl.init();
    }

    function stop(): void {
      teardown(live);
      live = null;
    }

    start(false);
    const cleanups: (() => void)[] = [];

    const query = (function reducedQuery() {
      try {
        return view.matchMedia('(prefers-reduced-motion: reduce)') as MediaQueryList | undefined;
      } catch {
        return undefined;
      }
    })();
    if (query && typeof query.addEventListener === 'function') {
      const changed = function changed(): void {
        if (prefersMotion(view)) start(false);
        else stop();
      };
      query.addEventListener('change', changed);
      cleanups.push(function unchanged() {
        query.removeEventListener('change', changed);
      });
    }

    /* fix pass (2026-10-06): a print (or a print-mode capture) shows the end state, not the
       from-state of entrances still below the fold (inline opacity 0). */
    const printed = function printed(): void {
      const built = live;
      const tl = built?.tl;
      if (built && tl) tl.seek(tl.duration * built.rest, true);
    };
    view.addEventListener('beforeprint', printed);
    cleanups.push(function unprinted() {
      view.removeEventListener('beforeprint', printed);
    });

    /* The held distance depends on the layout: rebuild when the viewport WIDTH changes (a
       mobile URL bar only changes the height). */
    if (PINNED.includes(recipe)) {
      let width = view.innerWidth;
      let timer = 0;
      const resized = function resized(): void {
        view.clearTimeout(timer);
        timer = view.setTimeout(function settled() {
          if (view.innerWidth === width || !live) return;
          width = view.innerWidth;
          stop();
          start(true);
        }, 200);
      };
      view.addEventListener('resize', resized);
      cleanups.push(function unresized() {
        view.clearTimeout(timer);
        view.removeEventListener('resize', resized);
      });
    }

    return function dispose(): void {
      disposed = true;
      for (let at = cleanups.length - 1; at >= 0; at -= 1) cleanups[at]?.();
      stop();
    };
  }

  function mount(el: HTMLElement, ctx: CkEngineContext): () => void {
    const recipe = filled(el.getAttribute('data-ck-timeline'));
    const view = viewOf(el);
    if (!RECIPES.includes(recipe) || !prefersMotion(view)) {
      return function noop(): void {
        /* not a recipe this engine knows, or reduced motion: the markup stays as written */
      };
    }
    if (ctx.canvas === true || ctx.still) return mountStage(recipe, el, ctx, view, ctx.canvas === true);
    return mountScroll(recipe, el, ctx, view);
  }

  const engine: CkEngine = { mount: mount };
  ensureCkEngines(win).ready('timeline', engine);
}
