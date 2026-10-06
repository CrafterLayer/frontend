import type {
  CkEngine,
  CkEngineContext,
  CkEngineKind,
  CkEngines,
  CkEnginesHost,
} from './ck-engines-shim';

/*
 * The minimal GSAP surface the recipes use (gsap 3.15.0, ScrollTrigger, SplitText). Types only:
 * they vanish at compile time, so the serialised runner still has no imports.
 */
export interface GsapTimelineLike {
  from(
    target: unknown,
    vars: Record<string, unknown>,
    position?: number | string,
  ): GsapTimelineLike;
  to(target: unknown, vars: Record<string, unknown>, position?: number | string): GsapTimelineLike;
  fromTo(
    target: unknown,
    from: Record<string, unknown>,
    to: Record<string, unknown>,
    position?: number | string,
  ): GsapTimelineLike;
  progress(value: number): GsapTimelineLike;
  restart(): GsapTimelineLike;
  pause(): GsapTimelineLike;
  kill(): void;
  revert?(): void;
  scrollTrigger?: { kill(): void };
}

export interface GsapMatchMediaLike {
  add(query: string, fn: () => (() => void) | undefined): void;
  revert(): void;
}

export interface GsapLike {
  registerPlugin(...plugins: unknown[]): void;
  timeline(vars: Record<string, unknown>): GsapTimelineLike;
  to(target: unknown, vars: Record<string, unknown>): { kill(): void };
  matchMedia(): GsapMatchMediaLike;
}

export interface ScrollTriggerInstanceLike {
  getVelocity(): number;
  kill(): void;
}

export interface ScrollTriggerLike {
  create(vars: Record<string, unknown>): ScrollTriggerInstanceLike;
}

export interface SplitTextInstanceLike {
  words: Element[];
  lines?: Element[];
  revert(): void;
}

export type SplitTextLike = new (
  target: Element,
  vars: Record<string, unknown>,
) => SplitTextInstanceLike;

export interface TimelineWindow extends CkEnginesHost {
  gsap?: GsapLike;
  ScrollTrigger?: ScrollTriggerLike;
  SplitText?: SplitTextLike;
  matchMedia?: (query: string) => { matches: boolean };
}

/**
 * The timeline engine (media-motion DESIGN §C.2, §C.3): registers
 * `win.ckEngines.engines.timeline` and mounts every queued `data-ck-timeline` element.
 *
 * It runs AFTER the vendored GSAP files in `assets/ck-timeline.js` (export) or in the canvas
 * frame's injected script, and reads `win.gsap`, `win.ScrollTrigger`, `win.SplitText`.
 *
 * ## Why one self-contained function
 *
 * It is serialised with `Function.prototype.toString` (export: banner + TIMELINE_SOURCE +
 * `;(installTimelineEngine)(window);`), so it has NO runtime imports and reads NO module-scope
 * identifier; the `ensureCkEngines` declaration below is a verbatim copy of
 * `./ck-engines-shim.ts` (held equal by `ckEnginesShimOf` in the tests).
 *
 * ## Rules
 *
 * - Every live recipe runs inside `gsap.matchMedia()` under
 *   `(prefers-reduced-motion: no-preference)`; under reduce nothing runs (and the pack never
 *   loads this asset).
 * - The hidden "from" state is set only for elements whose ScrollTrigger start lies below the
 *   viewport at mount (§C.3): content already on screen is never hidden after it painted, so an
 *   entrance recipe on a visible element does nothing.
 * - RTL flips every x sign (`horizontal-scroll`, `velocity-marquee`).
 * - `split-reveal` splits Arabic (by `lang` or by content) into words only, never chars;
 *   other text into words and lines.
 * - `ctx.still` (canvas): a paused timeline with no ScrollTrigger and no SplitText, set to its
 *   rest state (the final state for an entrance); `ctx.onPlay` replays it from 0 (Preview) and
 *   `ctx.onStop` returns it to rest.
 * - The scroller is the element's own window (the iframe realm on the canvas).
 * - Dispose kills the tweens and ScrollTriggers, reverts SplitText and reverts inline styles.
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

  const gsapRef = win.gsap;
  if (!gsapRef) return;
  const gsap: GsapLike = gsapRef;
  const ScrollTrigger = win.ScrollTrigger;
  const SplitText = win.SplitText;
  const plugins: unknown[] = [];
  if (ScrollTrigger) plugins.push(ScrollTrigger);
  if (SplitText) plugins.push(SplitText);
  if (plugins.length > 0) gsap.registerPlugin(...plugins);

  /* The fixed param tables (closed vocabulary: data-ck-ease/speed/stagger/delay/scrub/depth). */
  const EASES: Record<string, string> = {
    standard: 'power2.out',
    emphasized: 'expo.out',
    spring: 'back.out(1.6)',
    bounce: 'bounce.out',
    linear: 'none',
  };
  const DURATIONS: Record<string, number> = { slow: 1.3, normal: 0.8, fast: 0.5 };
  const STAGGERS: Record<string, number> = { sm: 0.05, md: 0.1, lg: 0.18 };
  /** data-ck-delay is a step count; one step is 80 ms, like the CSS presets. */
  const DELAY_STEP = 0.08;
  const DELAYS: Record<string, number> = { '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6 };
  const DEPTH_SHIFT: Record<string, number> = { '1': 24, '2': 56, '3': 96 };
  /** Where an entrance starts: the element's top reaches 85% of the viewport height. */
  const ENTRANCE_START = 0.85;
  const RECIPES = [
    'split-reveal',
    'stagger-in',
    'pin-sequence',
    'horizontal-scroll',
    'parallax-depth',
    'scrub-scale',
    'velocity-marquee',
  ];
  /** Recipes whose from-state hides content (gated on "start below the viewport"). */
  const ENTRANCES = ['split-reveal', 'stagger-in', 'pin-sequence'];
  /** Recipes driven by scroll position by default (data-ck-scrub="false" removes the smoothing). */
  const SCRUBBED = ['pin-sequence', 'horizontal-scroll', 'parallax-depth', 'scrub-scale'];
  const ARABIC = /[؀-ۿ]/;

  function pick<T>(table: Record<string, T>, key: string | null, fallback: T): T {
    if (key === null || !Object.prototype.hasOwnProperty.call(table, key)) return fallback;
    return table[key] ?? fallback;
  }

  function filled(value: string | null | undefined): string {
    return typeof value === 'string' ? value : '';
  }

  function langOf(el: HTMLElement, ctx: CkEngineContext): string {
    const own = filled(el.closest('[lang]')?.getAttribute('lang'));
    const page = filled(el.ownerDocument.documentElement.getAttribute('lang'));
    const lang = own !== '' ? own : ctx.lang !== '' ? ctx.lang : page;
    return lang.toLowerCase();
  }

  function isArabic(el: HTMLElement, ctx: CkEngineContext): boolean {
    const lang = langOf(el, ctx);
    return lang === 'ar' || lang.startsWith('ar-') || ARABIC.test(filled(el.textContent));
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

  function startsBelow(el: HTMLElement, view: Window, fraction: number): boolean {
    const height =
      view.innerHeight > 0 ? view.innerHeight : el.ownerDocument.documentElement.clientHeight;
    return el.getBoundingClientRect().top > height * fraction;
  }

  function childrenOf(el: Element): Element[] {
    return Array.from(el.children).filter(function own(child) {
      return !child.hasAttribute('data-ck-clone');
    });
  }

  function setRate(marquee: Element, rate: number): void {
    for (const child of Array.from(marquee.children)) {
      const animated = child as Element & { getAnimations?: () => { playbackRate: number }[] };
      if (typeof animated.getAnimations !== 'function') continue;
      for (const animation of animated.getAnimations()) animation.playbackRate = rate;
    }
  }

  interface Built {
    tl: GsapTimelineLike | null;
    /** Timeline progress at rest: 1 for entrances, 0 for the track, 0.5 for parallax. */
    rest: number;
    cleanup: (() => void)[];
  }

  /**
   * Builds a recipe. `live`: ScrollTrigger-driven (and `hide` decides whether from-states render
   * now). Not live: paused, no ScrollTrigger, no SplitText — the canvas stand-in.
   */
  function build(
    recipe: string,
    el: HTMLElement,
    ctx: CkEngineContext,
    live: boolean,
    hide: boolean,
  ): Built {
    const view = viewOf(el);
    const sign = ctx.rtl ? -1 : 1;
    const ease = pick(EASES, el.getAttribute('data-ck-ease'), 'power2.out');
    const duration = pick(DURATIONS, el.getAttribute('data-ck-speed'), 0.8);
    const delay = pick(DELAYS, el.getAttribute('data-ck-delay'), 0) * DELAY_STEP;
    const scrubAttr = el.getAttribute('data-ck-scrub');
    /* Scrubbed recipes: smoothed (0.6 s) unless data-ck-scrub="false" (direct). Entrances: play
       once on enter unless data-ck-scrub="true". */
    const scrub: number | boolean = SCRUBBED.includes(recipe)
      ? scrubAttr === 'false'
        ? true
        : 0.6
      : scrubAttr === 'true'
        ? 0.6
        : false;
    const cleanup: (() => void)[] = [];

    function trigger(extra: Record<string, unknown>): Record<string, unknown> | undefined {
      if (!live) return undefined;
      const vars: Record<string, unknown> = { trigger: el, scroller: view };
      for (const key of Object.keys(extra)) vars[key] = extra[key];
      return vars;
    }

    function timeline(scrollTrigger: Record<string, unknown> | undefined): GsapTimelineLike {
      const vars: Record<string, unknown> = {
        paused: !live,
        defaults: { ease: ease, duration: duration },
      };
      if (scrollTrigger) vars['scrollTrigger'] = scrollTrigger;
      return gsap.timeline(vars);
    }

    const entranceStart = 'top ' + String(ENTRANCE_START * 100) + '%';
    const entranceTrigger =
      scrub === false
        ? { start: entranceStart, toggleActions: 'play none none none' }
        : { start: entranceStart, end: 'bottom 55%', scrub: scrub };

    if (recipe === 'split-reveal') {
      let targets: Element[] = [el];
      if (live && SplitText) {
        const split = new SplitText(el, {
          type: isArabic(el, ctx) ? 'words' : 'words,lines',
          aria: 'auto',
        });
        if (split.words.length > 0) targets = split.words;
        cleanup.push(function unsplit() {
          split.revert();
        });
      }
      const tl = timeline(trigger(entranceTrigger));
      tl.from(targets, {
        y: '0.6em',
        autoAlpha: 0,
        stagger: pick(STAGGERS, el.getAttribute('data-ck-stagger'), 0.05),
        delay: delay,
        immediateRender: hide,
      });
      return { tl: tl, rest: 1, cleanup: cleanup };
    }

    if (recipe === 'stagger-in') {
      const items = childrenOf(el);
      const tl = timeline(trigger(entranceTrigger));
      tl.from(items.length > 0 ? items : [el], {
        y: 32,
        autoAlpha: 0,
        stagger: pick(STAGGERS, el.getAttribute('data-ck-stagger'), 0.1),
        delay: delay,
        immediateRender: hide,
      });
      return { tl: tl, rest: 1, cleanup: cleanup };
    }

    if (recipe === 'pin-sequence') {
      const steps = childrenOf(el).slice(1);
      const tl = timeline(
        trigger({
          start: 'top top',
          end: '+=' + String(Math.max(1, steps.length) * 80) + '%',
          pin: true,
          scrub: scrub,
        }),
      );
      for (const step of steps) tl.from(step, { y: 40, autoAlpha: 0, immediateRender: hide });
      return { tl: tl, rest: 1, cleanup: cleanup };
    }

    if (recipe === 'horizontal-scroll') {
      const track = el.firstElementChild;
      if (!track) return { tl: null, rest: 0, cleanup: cleanup };
      const distance = function distance(): number {
        return Math.max(0, track.scrollWidth - el.clientWidth);
      };
      const tl = timeline(
        trigger({
          start: 'top top',
          end: function end(): string {
            return '+=' + String(distance());
          },
          pin: true,
          scrub: scrub,
          invalidateOnRefresh: true,
        }),
      );
      tl.to(track, {
        x: function x(): number {
          return -distance() * sign;
        },
        ease: 'none',
      });
      return { tl: tl, rest: 0, cleanup: cleanup };
    }

    if (recipe === 'parallax-depth') {
      const tl = timeline(trigger({ start: 'top bottom', end: 'bottom top', scrub: scrub }));
      for (const layer of Array.from(el.querySelectorAll('[data-ck-depth]'))) {
        const shift = pick(DEPTH_SHIFT, layer.getAttribute('data-ck-depth'), 0);
        if (shift === 0) continue;
        tl.fromTo(layer, { y: shift }, { y: -shift, ease: 'none' }, 0);
      }
      return { tl: tl, rest: 0.5, cleanup: cleanup };
    }

    if (recipe === 'scrub-scale') {
      const media = el.matches('img, video, picture')
        ? el
        : (el.querySelector('img, video, picture') ?? el);
      const tl = timeline(trigger({ start: 'top bottom', end: 'center center', scrub: scrub }));
      tl.fromTo(
        media,
        { scale: 0.86, borderRadius: '24px' },
        { scale: 1, borderRadius: '0px', ease: 'none' },
      );
      return { tl: tl, rest: 1, cleanup: cleanup };
    }

    if (recipe === 'velocity-marquee') {
      const marquee = el.matches('[data-ck-behavior="marquee"]')
        ? el
        : (el.querySelector('[data-ck-behavior="marquee"]') ?? el);
      if (!live || !ScrollTrigger) {
        const tl = timeline(undefined);
        tl.to(marquee, { skewX: -6 * sign, duration: 0.3 }).to(marquee, {
          skewX: 0,
          duration: 0.6,
        });
        return { tl: tl, rest: 1, cleanup: cleanup };
      }
      const st = ScrollTrigger.create({
        trigger: el,
        scroller: view,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: function onUpdate(self: ScrollTriggerInstanceLike): void {
          const velocity = self.getVelocity();
          setRate(marquee, 1 + Math.min(3, Math.abs(velocity) / 800));
          gsap.to(marquee, {
            skewX: Math.max(-8, Math.min(8, (velocity / -300) * sign)),
            duration: 0.25,
            overwrite: 'auto',
            onComplete: function settle(): void {
              setRate(marquee, 1);
              gsap.to(marquee, { skewX: 0, duration: 0.6, ease: 'power3.out', overwrite: 'auto' });
            },
          });
        },
      });
      cleanup.push(function unvelocity() {
        st.kill();
        setRate(marquee, 1);
        gsap.to(marquee, { skewX: 0, duration: 0 });
      });
      return { tl: null, rest: 1, cleanup: cleanup };
    }

    return { tl: null, rest: 1, cleanup: cleanup };
  }

  function teardown(built: Built | null): void {
    if (!built) return;
    for (const undo of built.cleanup) {
      try {
        undo();
      } catch {
        /* a failed undo must not stop the others */
      }
    }
    built.cleanup.length = 0;
    const tl = built.tl;
    if (!tl) return;
    tl.scrollTrigger?.kill();
    if (typeof tl.revert === 'function') tl.revert();
    else tl.kill();
    built.tl = null;
  }

  function mount(el: HTMLElement, ctx: CkEngineContext): () => void {
    const recipe = filled(el.getAttribute('data-ck-timeline'));
    if (!RECIPES.includes(recipe)) {
      return function noop(): void {
        /* not a recipe this engine knows: the markup stays as written */
      };
    }
    const view = viewOf(el);

    if (ctx.still) {
      /* Canvas: the rest (final) state, no ScrollTrigger; Preview replays from 0. */
      let built: Built | null = build(recipe, el, ctx, false, true);
      built.tl?.progress(built.rest).pause();
      let disposed = false;
      ctx.onPlay(function play(): void {
        if (disposed || !built?.tl || !prefersMotion(view)) return;
        built.tl.restart();
      });
      ctx.onStop(function stop(): void {
        if (disposed || !built?.tl) return;
        built.tl.progress(built.rest).pause();
      });
      return function dispose(): void {
        disposed = true;
        teardown(built);
        built = null;
      };
    }

    const media = gsap.matchMedia();
    let live: Built | null = null;
    media.add('(prefers-reduced-motion: no-preference)', function motionAllowed() {
      const entrance = ENTRANCES.includes(recipe);
      const below = startsBelow(el, view, recipe === 'pin-sequence' ? 0 : ENTRANCE_START);
      /* An entrance on content already on screen would hide what painted: leave it be. */
      if (entrance && !below) return undefined;
      live = build(recipe, el, ctx, true, entrance ? below : true);
      return function motionRevoked(): void {
        teardown(live);
        live = null;
      };
    });
    /* fix pass (2026-10-06): a print (or a print-mode capture) shows the end state, not
       the from-state of entrances still below the fold (inline opacity 0). */
    const printed = function printed(): void {
      const built = live;
      if (built?.tl) built.tl.progress(built.rest);
    };
    view.addEventListener('beforeprint', printed);
    return function dispose(): void {
      view.removeEventListener('beforeprint', printed);
      teardown(live);
      live = null;
      media.revert();
    };
  }

  const engine: CkEngine = { mount: mount };
  ensureCkEngines(win).ready('timeline', engine);
}
