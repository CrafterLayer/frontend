import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  type CkEngine,
  type CkEngineContext,
  type CkEngineQueueEntry,
  ensureCkEngines,
} from './ck-engines-shim';
import {
  type AnimeLike,
  type AnimeParams,
  type AnimePlayableLike,
  type AnimeScrollObserverLike,
  type AnimeTextSplitterLike,
  type AnimeTimelineLike,
  installTimelineEngine,
  type TimelineWindow,
} from './timeline-runner';

function nth<T>(list: readonly T[], index = 0): T {
  const value = list[index];
  if (value === undefined) throw new Error(`no item ${String(index)}`);
  return value;
}

/* ---------- a recording fake of the anime.js surface the runner uses ---------- */

interface Added {
  targets: unknown;
  params: AnimeParams;
  position: number | string | undefined;
}

class FakeTimeline implements AnimeTimelineLike {
  added: Added[] = [];
  seeks: number[] = [];
  restarted = 0;
  played = 0;
  paused = 0;
  reverted = 0;
  inits = 0;
  readonly duration = 1_000;
  constructor(public params: AnimeParams) {}
  init(): this {
    this.inits += 1;
    return this;
  }
  add(targets: unknown, params: AnimeParams, position?: number | string): this {
    this.added.push({ targets, params, position });
    return this;
  }
  play(): this {
    this.played += 1;
    return this;
  }
  pause(): this {
    this.paused += 1;
    return this;
  }
  restart(): this {
    this.restarted += 1;
    return this;
  }
  seek(time: number): this {
    this.seeks.push(time);
    return this;
  }
  cancel(): this {
    return this;
  }
  revert(): this {
    this.reverted += 1;
    return this;
  }
}

class FakeObserver implements AnimeScrollObserverLike {
  velocity = 0;
  backward = false;
  reverted = 0;
  constructor(public params: AnimeParams) {}
  revert(): this {
    this.reverted += 1;
    return this;
  }
}

class FakeAnimation implements AnimePlayableLike {
  readonly duration = 250;
  cancelled = 0;
  constructor(
    public targets: unknown,
    public params: AnimeParams,
  ) {}
  play(): this {
    return this;
  }
  pause(): this {
    return this;
  }
  restart(): this {
    return this;
  }
  seek(): this {
    return this;
  }
  cancel(): this {
    this.cancelled += 1;
    return this;
  }
  revert(): this {
    return this;
  }
  /** Runs the animation to its end: sets the target values, calls onUpdate then onComplete. */
  finish(): void {
    const target = this.targets as Record<string, unknown>;
    for (const key of Object.keys(this.params)) {
      if (['duration', 'ease', 'onUpdate', 'onComplete'].includes(key)) continue;
      target[key] = this.params[key];
    }
    (this.params['onUpdate'] as (() => void) | undefined)?.();
    (this.params['onComplete'] as (() => void) | undefined)?.();
  }
}

class FakeSplitter implements AnimeTextSplitterLike {
  words: HTMLElement[];
  reverted = 0;
  constructor(
    public target: Element,
    public params: AnimeParams,
  ) {
    this.words = target.textContent
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => {
        const span = target.ownerDocument.createElement('span');
        span.textContent = word;
        return span;
      });
  }
  revert(): this {
    this.reverted += 1;
    return this;
  }
}

interface Fake {
  win: TimelineWindow & { ckAnime: AnimeLike };
  timelines: FakeTimeline[];
  observers: FakeObserver[];
  animations: FakeAnimation[];
  splits: FakeSplitter[];
}

function fakeAnime(): Fake {
  const timelines: FakeTimeline[] = [];
  const observers: FakeObserver[] = [];
  const animations: FakeAnimation[] = [];
  const splits: FakeSplitter[] = [];
  const ckAnime: AnimeLike = {
    createTimeline: (params) => {
      const tl = new FakeTimeline(params);
      timelines.push(tl);
      return tl;
    },
    animate: (targets, params) => {
      const animation = new FakeAnimation(targets, params);
      animations.push(animation);
      return animation;
    },
    stagger: (value, params) => ({ stagger: value, ...params }),
    onScroll: (params) => {
      const observer = new FakeObserver(params);
      observers.push(observer);
      return observer;
    },
    splitText: (target, params) => {
      const split = new FakeSplitter(target, params);
      splits.push(split);
      return split;
    },
  };
  return { win: { ckAnime }, timelines, observers, animations, splits };
}

function ctx(overrides: Partial<CkEngineContext> = {}): CkEngineContext & {
  play: () => void;
  stop: () => void;
} {
  const onPlay: (() => void)[] = [];
  const onStop: (() => void)[] = [];
  return {
    still: false,
    rtl: false,
    lang: 'en',
    onPlay: (cb) => {
      onPlay.push(cb);
    },
    onStop: (cb) => {
      onStop.push(cb);
    },
    play: () => {
      for (const cb of onPlay) cb();
    },
    stop: () => {
      for (const cb of onStop) cb();
    },
    ...overrides,
  };
}

/** Mounts `html` in the document; its first element's top sits at `top` px (viewport 768 px). */
function element(html: string, top = 2_000): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  const el = host.firstElementChild as HTMLElement;
  document.body.appendChild(host);
  el.getBoundingClientRect = () => ({ top }) as DOMRect;
  for (const child of Array.from(el.children)) {
    (child as HTMLElement).getBoundingClientRect = () => ({ top: top + 100 }) as DOMRect;
  }
  return el;
}

function engineOf(fake: Fake): CkEngine {
  installTimelineEngine(fake.win);
  const engine = fake.win.ckEngines?.engines.timeline;
  if (!engine) throw new Error('timeline engine not registered');
  return engine;
}

/** A controllable IntersectionObserver stand-in for the canvas frame. */
class FakeIntersection {
  static made: FakeIntersection[] = [];
  observed: Element[] = [];
  disconnected = false;
  constructor(public callback: (entries: Partial<IntersectionObserverEntry>[]) => void) {
    FakeIntersection.made.push(this);
  }
  observe(el: Element): void {
    this.observed.push(el);
  }
  disconnect(): void {
    this.disconnected = true;
  }
  /** Reports the observed element entering (true) or fully leaving (false). */
  report(isIntersecting: boolean): void {
    this.callback([{ isIntersecting, target: nth(this.observed) }]);
  }
}

function last(): FakeIntersection {
  const io = FakeIntersection.made.at(-1);
  if (!io) throw new Error('no IntersectionObserver');
  return io;
}

afterEach(() => {
  document.body.innerHTML = '';
  FakeIntersection.made = [];
  delete (window as TimelineWindow).ckTimelinePlayed;
  vi.unstubAllGlobals();
});

/* ---------- registration ---------- */

describe('installTimelineEngine: registration', () => {
  it('ready() drains the queued timeline entries and keeps the others', () => {
    const fake = fakeAnime();
    const api = ensureCkEngines(fake.win);
    const el = element('<ul data-ck-timeline="stagger-in"><li>a</li><li>b</li></ul>');
    const sceneEl = element('<div data-ck-scene="particles"></div>');
    const entry: CkEngineQueueEntry = { kind: 'timeline', el, ctx: ctx() };
    api.queue.push(entry, { kind: 'scene', el: sceneEl, ctx: ctx() });

    installTimelineEngine(fake.win);

    expect(api.engines.timeline).toBeDefined();
    expect(typeof entry.dispose).toBe('function');
    expect(api.queue.map((queued) => queued.kind)).toEqual(['scene']);
    expect(fake.timelines).toHaveLength(1);
  });

  it('creates ckEngines itself when the asset loads before the pack', () => {
    const fake = fakeAnime();
    installTimelineEngine(fake.win);
    expect(fake.win.ckEngines?.engines.timeline).toBeDefined();
    expect(fake.win.ckEngines?.queue).toEqual([]);
  });

  it('does nothing without the library (a broken asset leaves the markup as is)', () => {
    const win: TimelineWindow = {};
    installTimelineEngine(win);
    expect(win.ckEngines).toBeUndefined();
  });

  it('ignores a recipe outside the closed list', () => {
    const fake = fakeAnime();
    const dispose = engineOf(fake).mount(element('<div data-ck-timeline="explode"></div>'), ctx());
    expect(fake.timelines).toHaveLength(0);
    dispose();
  });
});

/* ---------- published: scroll-driven ---------- */

describe('recipes (published, scroll-driven)', () => {
  it('an entrance plays ONCE when its top reaches 85% of the viewport', () => {
    const fake = fakeAnime();
    const el = element('<p data-ck-timeline="fade-in">Hello</p>');
    engineOf(fake).mount(el, ctx());
    const tl = nth(fake.timelines);
    expect(tl.params['autoplay']).toBe(false);
    // Every from-state (staggered ones too) is rendered at mount, so nothing flashes at the fold.
    expect(tl.inits).toBe(1);
    const watcher = nth(fake.observers);
    expect(watcher.params['target']).toBe(el);
    expect(watcher.params['enter']).toEqual({ container: '85%', target: 'top' });
    expect(watcher.params['repeat']).toBe(false);
    const enter = watcher.params['onEnter'] as () => void;
    enter();
    enter();
    expect(tl.played).toBe(1);
    expect(nth(tl.added)).toMatchObject({
      targets: el,
      params: { opacity: { from: 0 }, translateY: { from: 24 } },
    });
  });

  it('split-reveal splits into WORDS only (never chars, so Arabic stays joined) and staggers them', () => {
    const fake = fakeAnime();
    const engine = engineOf(fake);
    engine.mount(element('<h2 lang="ar" data-ck-timeline="split-reveal">قائمة جديدة</h2>'), ctx());
    engine.mount(element('<h2 data-ck-timeline="split-reveal">Fresh menu</h2>'), ctx());
    expect(fake.splits.map((split) => split.params)).toEqual([
      { words: true, chars: false, lines: false, accessible: true },
      { words: true, chars: false, lines: false, accessible: true },
    ]);
    const arabic = nth(nth(fake.timelines, 0).added);
    expect((arabic.targets as Element[]).map((word) => word.textContent)).toEqual(['قائمة', 'جديدة']);
    expect(arabic.params).toMatchObject({
      opacity: { from: 0 },
      translateY: { from: '0.6em' },
      delay: { stagger: 50, start: 0 },
    });
  });

  it('stagger-in animates the direct children, never a scene layer or a marquee clone', () => {
    const fake = fakeAnime();
    engineOf(fake).mount(
      element(
        '<ul data-ck-timeline="stagger-in"><div data-ck-scene-layer aria-hidden="true"></div><li>a</li><li>b</li><li data-ck-clone>a</li></ul>',
      ),
      ctx(),
    );
    const added = nth(nth(fake.timelines).added);
    expect((added.targets as Element[]).map((item) => item.textContent)).toEqual(['a', 'b']);
    expect(added.params).toMatchObject({ translateY: { from: 32 }, delay: { stagger: 100 } });
  });

  it('slide-in comes from the inline-start side: the left in LTR, the right in RTL', () => {
    const fake = fakeAnime();
    const engine = engineOf(fake);
    engine.mount(element('<p data-ck-timeline="slide-in">a</p>'), ctx({ rtl: false }));
    engine.mount(element('<p data-ck-timeline="slide-in">a</p>'), ctx({ rtl: true }));
    expect(nth(nth(fake.timelines, 0).added).params['translateX']).toEqual({ from: -48 });
    expect(nth(nth(fake.timelines, 1).added).params['translateX']).toEqual({ from: 48 });
  });

  it('maps the closed params through fixed tables; data-ck-scrub="true" makes an entrance follow the scroll', () => {
    const fake = fakeAnime();
    engineOf(fake).mount(
      element(
        '<ul data-ck-timeline="stagger-in" data-ck-ease="emphasized" data-ck-speed="slow" data-ck-stagger="lg" data-ck-delay="2" data-ck-scrub="true"><li>a</li></ul>',
      ),
      ctx(),
    );
    const tl = nth(fake.timelines);
    expect(tl.params['defaults']).toEqual({ ease: 'outExpo', duration: 1_300 });
    expect(nth(tl.added).params['delay']).toEqual({ stagger: 180, start: 160 });
    // Scrubbed: the timeline is linked to the observer (autoplay), smoothed.
    const observer = tl.params['autoplay'] as FakeObserver;
    expect(observer).toBeInstanceOf(FakeObserver);
    expect(observer.params).toMatchObject({
      enter: { container: '85%', target: 'top' },
      leave: { container: '55%', target: 'bottom' },
      sync: 0.25,
    });
  });

  it('parallax-depth drifts the depth layers, smoothed; data-ck-scrub="false" makes it direct', () => {
    const fake = fakeAnime();
    const engine = engineOf(fake);
    engine.mount(
      element('<div data-ck-timeline="parallax-depth"><img data-ck-depth="1" alt=""><img data-ck-depth="3" alt=""></div>'),
      ctx(),
    );
    engine.mount(
      element('<div data-ck-timeline="parallax-depth" data-ck-scrub="false"><i data-ck-depth="2"></i></div>'),
      ctx(),
    );
    const smooth = nth(fake.timelines, 0);
    expect(smooth.added.map((add) => add.params['translateY'])).toEqual([
      [24, -24],
      [96, -96],
    ]);
    expect((smooth.params['autoplay'] as FakeObserver).params['sync']).toBe(0.25);
    expect((nth(fake.timelines, 1).params['autoplay'] as FakeObserver).params['sync']).toBe(true);
  });

  it('parallax-depth with no [data-ck-depth] moves the element itself', () => {
    const fake = fakeAnime();
    const el = element('<section data-ck-timeline="parallax-depth"><h2>a</h2></section>');
    engineOf(fake).mount(el, ctx());
    const added = nth(nth(fake.timelines).added);
    expect(added.targets).toBe(el);
    expect(added.params['translateY']).toEqual([24, -24]);
  });

  it('scrub-scale grows the media to its own size', () => {
    const fake = fakeAnime();
    engineOf(fake).mount(element('<figure data-ck-timeline="scrub-scale"><img alt=""></figure>'), ctx());
    const added = nth(nth(fake.timelines).added);
    expect((added.targets as Element).tagName).toBe('IMG');
    expect(added.params).toMatchObject({ scale: { from: 0.86 }, borderRadius: { from: '24px' } });
  });

  it('pin-sequence holds the element (transform pin + reserved room) while the steps reveal', () => {
    const fake = fakeAnime();
    const el = element('<section data-ck-timeline="pin-sequence"><h2>t</h2><p>1</p><p>2</p></section>');
    const dispose = engineOf(fake).mount(el, ctx());
    const tl = nth(fake.timelines);
    const distance = Math.round(2 * 0.8 * window.innerHeight);
    expect((tl.params['autoplay'] as FakeObserver).params).toMatchObject({
      target: el,
      enter: { container: 'top', target: 'top' },
      leave: { container: 'top', target: distance },
      sync: true,
    });
    expect(nth(tl.added)).toMatchObject({ targets: el, params: { translateY: [0, distance] }, position: 0 });
    // The steps after the first: the first stays visible.
    expect(tl.added.slice(1).map((add) => (add.targets as Element).textContent)).toEqual(['1', '2']);
    expect(el.style.getPropertyValue('margin-block-end')).toBe(`${String(distance)}px`);
    expect(tl.inits).toBe(1); // the steps start hidden
    dispose();
    expect(el.style.getPropertyValue('margin-block-end')).toBe('');
    expect(tl.reverted).toBe(1);
  });

  it('horizontal-scroll slides the track by its overflow, mirrored under RTL; nothing without overflow', () => {
    const fake = fakeAnime();
    const engine = engineOf(fake);
    const make = (overflow = 1_000): HTMLElement => {
      const el = element('<section data-ck-timeline="horizontal-scroll"><div>track</div></section>');
      Object.defineProperty(el, 'clientWidth', { value: 400 });
      Object.defineProperty(el.firstElementChild, 'scrollWidth', { value: overflow });
      return el;
    };
    engine.mount(make(), ctx({ rtl: false }));
    engine.mount(make(), ctx({ rtl: true }));
    engine.mount(make(400), ctx());
    expect(fake.timelines).toHaveLength(2);
    expect(nth(nth(fake.timelines, 0).added, 1).params['translateX']).toEqual([0, -600]);
    expect(nth(nth(fake.timelines, 1).added, 1).params['translateX']).toEqual([0, 600]);
  });

  it('velocity-marquee skews with the scroll velocity and restores the marquee on dispose', () => {
    const fake = fakeAnime();
    const el = element(
      '<div data-ck-timeline="velocity-marquee"><div data-ck-behavior="marquee" style="transform: translateZ(0)"><span>a</span></div></div>',
    );
    const marquee = el.firstElementChild as HTMLElement;
    const dispose = engineOf(fake).mount(el, ctx({ rtl: true }));
    const observer = nth(fake.observers);
    expect(observer.params['target']).toBe(el);
    observer.velocity = 1.5; // px per ms = 1500 px/s, scrolling down
    (observer.params['onUpdate'] as (self: FakeObserver) => void)(observer);
    // 1500 / -300 * (-1 under RTL) = 5 deg.
    expect(nth(fake.animations).params['skewX']).toBe(5);
    marquee.style.transform = 'skewX(5deg)';
    dispose();
    expect(observer.reverted).toBe(1);
    expect(nth(fake.animations).cancelled).toBe(1);
    expect(marquee.style.transform).toBe('translateZ(0)');
  });

  it('never hides content that already painted: an entrance on screen does nothing', () => {
    const fake = fakeAnime();
    const engine = engineOf(fake);
    engine.mount(element('<ul data-ck-timeline="stagger-in"><li>a</li></ul>', 10), ctx());
    engine.mount(element('<h2 data-ck-timeline="split-reveal">Hi there</h2>', 10), ctx());
    engine.mount(element('<section data-ck-timeline="pin-sequence"><h2>t</h2><p>1</p></section>', 10), ctx());
    expect(fake.timelines).toHaveLength(0);
    expect(fake.splits).toHaveLength(0);
    // A scroll-linked recipe on screen still runs (it moves, it does not hide).
    engine.mount(element('<div data-ck-timeline="parallax-depth"><i data-ck-depth="1"></i></div>', 10), ctx());
    expect(fake.timelines).toHaveLength(1);
  });

  it('prints the end state of an entrance still below the fold, and stops listening on dispose', () => {
    const fake = fakeAnime();
    const dispose = engineOf(fake).mount(element('<ul data-ck-timeline="stagger-in"><li>a</li></ul>'), ctx());
    const tl = nth(fake.timelines);
    window.dispatchEvent(new Event('beforeprint'));
    expect(tl.seeks).toEqual([1_000]);
    dispose();
    window.dispatchEvent(new Event('beforeprint'));
    expect(tl.seeks).toEqual([1_000]);
  });

  it('dispose reverts the timeline (inline styles), the word split and the scroll watcher', () => {
    const fake = fakeAnime();
    const dispose = engineOf(fake).mount(element('<h2 data-ck-timeline="split-reveal">Hello you</h2>'), ctx());
    dispose();
    expect(nth(fake.timelines).reverted).toBe(1);
    expect(nth(fake.splits).reverted).toBe(1);
    expect(nth(fake.observers).reverted).toBe(1);
  });

  it('runs nothing under reduced motion, and stops when the preference turns on later', () => {
    let reduce = true;
    const listeners: (() => void)[] = [];
    vi.stubGlobal('matchMedia', (query: string) => ({
      get matches() {
        return query.includes('reduce') && reduce;
      },
      addEventListener: (_: string, cb: () => void) => listeners.push(cb),
      removeEventListener: () => undefined,
    }));
    const fake = fakeAnime();
    const engine = engineOf(fake);
    engine.mount(element('<h2 data-ck-timeline="split-reveal">Hi there</h2>'), ctx());
    engine.mount(element('<p data-ck-timeline="fade-in">a</p>'), ctx({ canvas: true }));
    expect(fake.timelines).toHaveLength(0);
    expect(fake.splits).toHaveLength(0);

    reduce = false;
    engine.mount(element('<div data-ck-timeline="parallax-depth"><i data-ck-depth="1"></i></div>'), ctx());
    const tl = nth(fake.timelines);
    reduce = true;
    for (const cb of listeners) cb();
    expect(tl.reverted).toBe(1);
  });
});

/* ---------- canvas: live, never restructured ---------- */

describe('recipes (canvas: autoplay on entry, rest = final state)', () => {
  function canvas(): void {
    vi.stubGlobal('IntersectionObserver', FakeIntersection);
  }

  it('rests at the final state, with no observer, no split and no pin', () => {
    canvas();
    const fake = fakeAnime();
    const engine = engineOf(fake);
    const heading = element('<h2 data-ck-timeline="split-reveal">Hello you</h2>');
    engine.mount(heading, ctx({ canvas: true }));
    const pinned = element('<section data-ck-timeline="pin-sequence"><h2>t</h2><p>1</p></section>');
    engine.mount(pinned, ctx({ canvas: true }));
    const split = nth(fake.timelines, 0);
    expect(split.params['autoplay']).toBe(false);
    expect(split.seeks).toEqual([1_000]);
    // The whole element: React owns its text, so no word spans.
    expect(nth(split.added).targets).toEqual([heading]);
    expect(fake.splits).toHaveLength(0);
    expect(fake.observers).toHaveLength(0);
    expect(pinned.style.getPropertyValue('margin-block-end')).toBe('');
    expect(nth(fake.timelines, 1).added.map((add) => add.targets)).toEqual([pinned.lastElementChild]);
  });

  it('autoplays on entering the frame viewport, and again only after fully leaving', () => {
    canvas();
    const fake = fakeAnime();
    engineOf(fake).mount(element('<p data-ck-timeline="fade-in">a</p>'), ctx({ canvas: true }));
    const tl = nth(fake.timelines);
    const io = last();
    io.report(true);
    io.report(true);
    expect(tl.restarted).toBe(1);
    io.report(false);
    io.report(true);
    expect(tl.restarted).toBe(2);
  });

  it('a re-mount of the same element+recipe while in view does NOT replay; a new recipe plays at once', () => {
    canvas();
    const fake = fakeAnime();
    const engine = engineOf(fake);
    const host = element('<div data-bldr-node="hero"><p data-ck-timeline="fade-in">a</p></div>');
    const p = host.firstElementChild as HTMLElement;
    const first = engine.mount(p, ctx({ canvas: true }));
    last().report(true);
    expect(nth(fake.timelines, 0).restarted).toBe(1);

    // React re-commit after an unrelated edit: dispose + mount of the same element and recipe.
    first();
    const second = engine.mount(p, ctx({ canvas: true }));
    last().report(true);
    expect(nth(fake.timelines, 1).restarted).toBe(0);
    expect(nth(fake.timelines, 1).seeks).toEqual([1_000]);

    // The owner picks another recipe: live preview.
    second();
    p.setAttribute('data-ck-timeline', 'slide-in');
    engine.mount(p, ctx({ canvas: true }));
    last().report(true);
    expect(nth(fake.timelines, 2).restarted).toBe(1);
    expect(Object.keys((window as TimelineWindow).ckTimelinePlayed ?? {})).toEqual([
      'hero|0|fade-in',
      'hero|0|slide-in',
    ]);
  });

  it('Preview replays even in view; stop returns to rest; dispose reverts and stops observing', () => {
    canvas();
    const fake = fakeAnime();
    const c = ctx({ canvas: true });
    const dispose = engineOf(fake).mount(element('<p data-ck-timeline="fade-in">a</p>'), c);
    const tl = nth(fake.timelines);
    last().report(true);
    c.play();
    expect(tl.restarted).toBe(2);
    c.stop();
    expect(tl.seeks).toEqual([1_000, 1_000]);
    dispose();
    expect(tl.reverted).toBe(1);
    expect(last().disconnected).toBe(true);
    c.play();
    expect(tl.restarted).toBe(2);
  });

  it('a scroll-linked recipe plays a demo: 0 → 1, then back to its rest', () => {
    canvas();
    const fake = fakeAnime();
    const el = element('<section data-ck-timeline="horizontal-scroll"><div>track</div></section>');
    Object.defineProperty(el, 'clientWidth', { value: 400 });
    Object.defineProperty(el.firstElementChild, 'scrollWidth', { value: 1_000 });
    engineOf(fake).mount(el, ctx({ canvas: true }));
    const tl = nth(fake.timelines);
    expect(tl.params['autoplay']).toBe(false);
    expect(nth(tl.added).params['translateX']).toEqual([0, -600]);
    expect(tl.seeks).toEqual([0]); // rest: the track at its start
    last().report(true);
    const out = nth(fake.animations);
    expect(out.params).toMatchObject({ p: 1 });
    out.finish();
    expect(tl.seeks.slice(-1)).toEqual([1_000]);
    const back = nth(fake.animations, 1);
    expect(back.params).toMatchObject({ p: 0 });
    back.finish();
    expect(tl.seeks.slice(-1)).toEqual([0]);
  });

  it('legacy still: rest state, no autoplay, Preview plays', () => {
    canvas();
    const fake = fakeAnime();
    const c = ctx({ still: true });
    engineOf(fake).mount(element('<div data-ck-timeline="parallax-depth"><i data-ck-depth="2"></i></div>'), c);
    const tl = nth(fake.timelines);
    expect(tl.seeks).toEqual([500]);
    expect(FakeIntersection.made).toHaveLength(0);
    c.play();
    expect(fake.animations).toHaveLength(1);
  });
});

/* ---------- the serialised runner ---------- */

describe('serialised runner', () => {
  it('evaluates alone in a fresh frame and keeps its canvas memory on that frame window', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const frameWindow = frame.contentWindow as unknown as Window & TimelineWindow;
    const fake = fakeAnime();
    frameWindow.ckAnime = fake.win.ckAnime;
    const script = `(${installTimelineEngine.toString()})(window);`;
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- evaluating the serialised runner IS the test
    new Function('window', script)(frameWindow);

    const engine = frameWindow.ckEngines?.engines.timeline;
    expect(engine).toBeDefined();
    const doc = frame.contentDocument!;
    doc.body.innerHTML = '<p data-ck-timeline="fade-in">a</p>';
    engine?.mount(doc.querySelector('p') as HTMLElement, ctx({ canvas: true }));
    expect(fake.timelines).toHaveLength(1);
    expect(Object.keys(frameWindow.ckTimelinePlayed ?? {})).toEqual(['|0|fade-in']);
    expect((window as TimelineWindow).ckTimelinePlayed).toBeUndefined();
    frame.remove();
  });
});

/* ---------- the real asset: anime.js subset + runner ---------- */

describe('the generated asset (TIMELINE_SOURCE + runner) in jsdom', () => {
  it('defines window.ckAnime, registers the engine and mounts fade-in on the canvas and published', async () => {
    const { TIMELINE_BANNER, TIMELINE_SOURCE } = await import('./timeline-source');
    // jsdom has no ResizeObserver (anime's scroll container needs one); a stand-in that never fires.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {
          /* never fires */
        }
        disconnect(): void {
          /* nothing to stop */
        }
      },
    );
    const host = (): Window & TimelineWindow => window;
    delete host().ckAnime;
    delete host().ckEngines;
    const asset = `${TIMELINE_BANNER}${TIMELINE_SOURCE}\n;(${installTimelineEngine.toString()})(window);\n`;
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- evaluating the shipped asset IS the test
    new Function(asset)();

    expect(typeof host().ckAnime?.createTimeline).toBe('function');
    const engine = host().ckEngines?.engines.timeline;
    expect(engine).toBeDefined();

    const onCanvas = element('<p data-ck-timeline="fade-in" style="color: red">canvas</p>');
    const disposeCanvas = engine?.mount(onCanvas, ctx({ canvas: true }));
    const published = element('<p data-ck-timeline="fade-in" style="color: red">published</p>', 5_000);
    const disposePublished = engine?.mount(published, ctx());
    // The from-state of an entrance below the fold is rendered at once.
    expect(published.style.opacity).toBe('0');
    await new Promise((done) => setTimeout(done, 50));

    disposeCanvas?.();
    disposePublished?.();
    expect(onCanvas.getAttribute('style')).toBe('color: red;');
    expect(published.getAttribute('style')).toBe('color: red;');
    delete host().ckAnime;
    delete host().ckEngines;
  });
});
