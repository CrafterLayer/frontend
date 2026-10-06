import { afterEach, describe, expect, it } from 'vitest';

import {
  type CkEngine,
  type CkEngineContext,
  type CkEngineQueueEntry,
  ensureCkEngines,
} from './ck-engines-shim';
import {
  type GsapLike,
  type GsapTimelineLike,
  installTimelineEngine,
  type ScrollTriggerLike,
  type SplitTextInstanceLike,
  type SplitTextLike,
  type TimelineWindow,
} from './timeline-runner';

function nth<T>(list: readonly T[], index = 0): T {
  const value = list[index];
  if (value === undefined) throw new Error(`no item ${String(index)}`);
  return value;
}

/* ---------- a recording fake of the GSAP surface the runner uses ---------- */

interface Call {
  method: 'from' | 'to' | 'fromTo';
  target: unknown;
  vars: Record<string, unknown>;
  from?: Record<string, unknown>;
}

class FakeTimeline implements GsapTimelineLike {
  calls: Call[] = [];
  progressed: number[] = [];
  restarted = 0;
  paused = 0;
  reverted = false;
  scrollTrigger?: { vars: Record<string, unknown>; killed: boolean; kill(): void };

  constructor(public vars: Record<string, unknown>) {
    const st = vars['scrollTrigger'] as Record<string, unknown> | undefined;
    if (st) {
      this.scrollTrigger = {
        vars: st,
        killed: false,
        kill() {
          this.killed = true;
        },
      };
    }
  }
  from(target: unknown, vars: Record<string, unknown>): this {
    this.calls.push({ method: 'from', target, vars });
    return this;
  }
  to(target: unknown, vars: Record<string, unknown>): this {
    this.calls.push({ method: 'to', target, vars });
    return this;
  }
  fromTo(target: unknown, from: Record<string, unknown>, to: Record<string, unknown>): this {
    this.calls.push({ method: 'fromTo', target, vars: to, from });
    return this;
  }
  progress(value: number): this {
    this.progressed.push(value);
    return this;
  }
  restart(): this {
    this.restarted += 1;
    return this;
  }
  pause(): this {
    this.paused += 1;
    return this;
  }
  kill(): void {
    this.reverted = true;
  }
  revert(): void {
    this.reverted = true;
  }
}

class FakeSplit implements SplitTextInstanceLike {
  static made: FakeSplit[] = [];
  words: Element[];
  reverted = false;
  constructor(
    public target: Element,
    public vars: Record<string, unknown>,
  ) {
    this.words = target.textContent
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => {
        const span = target.ownerDocument.createElement('span');
        span.textContent = word;
        return span;
      });
    FakeSplit.made.push(this);
  }
  revert(): void {
    this.reverted = true;
  }
}

interface Fake {
  win: TimelineWindow & {
    gsap: GsapLike;
    ScrollTrigger: ScrollTriggerLike;
    SplitText: SplitTextLike;
  };
  timelines: FakeTimeline[];
  plugins: unknown[];
  triggers: { vars: Record<string, unknown>; killed: boolean }[];
  media: { reverted: number };
}

function fakeWindow(options: { motion?: boolean } = {}): Fake {
  const timelines: FakeTimeline[] = [];
  const plugins: unknown[] = [];
  const triggers: Fake['triggers'] = [];
  const media = { reverted: 0 };
  const motion = options.motion ?? true;
  const gsap: GsapLike = {
    registerPlugin: (...list: unknown[]) => {
      plugins.push(...list);
    },
    timeline: (vars) => {
      const tl = new FakeTimeline(vars);
      timelines.push(tl);
      return tl;
    },
    to: () => ({ kill: () => undefined }),
    matchMedia: () => {
      let cleanup: (() => void) | undefined;
      return {
        add: (query, fn) => {
          expect(query).toBe('(prefers-reduced-motion: no-preference)');
          if (motion) cleanup = fn();
        },
        revert: () => {
          media.reverted += 1;
          if (typeof cleanup === 'function') cleanup();
        },
      };
    },
  };
  const ScrollTrigger = {
    create: (vars: Record<string, unknown>) => {
      const st = {
        vars,
        killed: false,
        getVelocity: () => 0,
        kill() {
          st.killed = true;
        },
      };
      triggers.push(st);
      return st;
    },
  };
  FakeSplit.made = [];
  return {
    win: { gsap, ScrollTrigger, SplitText: FakeSplit },
    timelines,
    plugins,
    triggers,
    media,
  };
}

function ctx(overrides: Partial<CkEngineContext> = {}): CkEngineContext & {
  play: () => void;
  stop: () => void;
} {
  let onPlay = (): void => undefined;
  let onStop = (): void => undefined;
  return {
    still: false,
    rtl: false,
    lang: 'en',
    onPlay: (cb) => {
      onPlay = cb;
    },
    onStop: (cb) => {
      onStop = cb;
    },
    play: () => {
      onPlay();
    },
    stop: () => {
      onStop();
    },
    ...overrides,
  };
}

function element(html: string, top = 2_000): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  const el = host.firstElementChild as HTMLElement;
  document.body.appendChild(host);
  el.getBoundingClientRect = () => ({ top }) as DOMRect;
  return el;
}

function engineOf(fake: Fake): CkEngine {
  installTimelineEngine(fake.win);
  const engine = fake.win.ckEngines?.engines.timeline;
  if (!engine) throw new Error('timeline engine not registered');
  return engine;
}

afterEach(() => {
  document.body.innerHTML = '';
});

/* ---------- tests ---------- */

describe('installTimelineEngine: registration', () => {
  it('registers ScrollTrigger and SplitText, then ready() drains the queued timeline entries', () => {
    const fake = fakeWindow();
    const api = ensureCkEngines(fake.win);
    const el = element('<h2 data-ck-timeline="stagger-in"><span>a</span><span>b</span></h2>');
    const sceneEl = element('<div data-ck-scene="particles"></div>');
    const entry: CkEngineQueueEntry = { kind: 'timeline', el, ctx: ctx() };
    api.queue.push(entry, { kind: 'scene', el: sceneEl, ctx: ctx() });

    installTimelineEngine(fake.win);

    expect(fake.plugins).toEqual([fake.win.ScrollTrigger, FakeSplit]);
    expect(api.engines.timeline).toBeDefined();
    expect(typeof entry.dispose).toBe('function');
    expect(api.queue.map((queued) => queued.kind)).toEqual(['scene']);
    expect(fake.timelines).toHaveLength(1);
  });

  it('creates ckEngines itself when the asset loads before the pack', () => {
    const fake = fakeWindow();
    installTimelineEngine(fake.win);
    expect(fake.win.ckEngines?.engines.timeline).toBeDefined();
    expect(fake.win.ckEngines?.queue).toEqual([]);
  });

  it('does nothing without gsap (a broken asset leaves the markup as is)', () => {
    const win: TimelineWindow = {};
    installTimelineEngine(win);
    expect(win.ckEngines).toBeUndefined();
  });

  it('ignores a recipe outside the closed list', () => {
    const fake = fakeWindow();
    const dispose = engineOf(fake).mount(element('<div data-ck-timeline="explode"></div>'), ctx());
    expect(fake.timelines).toHaveLength(0);
    dispose();
  });
});

describe('recipes (live)', () => {
  it('dispatches each recipe to its own timeline, scrolled by the element’s window', () => {
    const fake = fakeWindow();
    const engine = engineOf(fake);
    const markup: Record<string, string> = {
      'split-reveal': '<h2 data-ck-timeline="split-reveal">Bold new menu</h2>',
      'stagger-in': '<ul data-ck-timeline="stagger-in"><li>a</li><li>b</li></ul>',
      'pin-sequence': '<section data-ck-timeline="pin-sequence"><p>1</p><p>2</p><p>3</p></section>',
      'horizontal-scroll':
        '<section data-ck-timeline="horizontal-scroll"><div>track</div></section>',
      'parallax-depth':
        '<div data-ck-timeline="parallax-depth"><img data-ck-depth="1" alt=""><img data-ck-depth="3" alt=""></div>',
      'scrub-scale': '<figure data-ck-timeline="scrub-scale"><img alt=""></figure>',
    };
    for (const [recipe, html] of Object.entries(markup)) {
      const el = element(html);
      engine.mount(el, ctx());
      const tl = fake.timelines.at(-1);
      expect(tl, recipe).toBeDefined();
      expect(tl?.vars['paused'], recipe).toBe(false);
      expect(tl?.scrollTrigger?.vars['trigger'], recipe).toBe(el);
      expect(tl?.scrollTrigger?.vars['scroller'], recipe).toBe(document.defaultView);
    }
    expect(fake.timelines).toHaveLength(6);
    const split = nth(fake.timelines, 0);
    const stagger = nth(fake.timelines, 1);
    const pin = nth(fake.timelines, 2);
    const horizontal = nth(fake.timelines, 3);
    const parallax = nth(fake.timelines, 4);
    const scale = nth(fake.timelines, 5);
    expect(nth(split.calls).method).toBe('from');
    expect(split.scrollTrigger?.vars['toggleActions']).toBe('play none none none');
    expect((nth(stagger.calls).target as Element[]).map((li) => li.textContent)).toEqual([
      'a',
      'b',
    ]);
    expect(pin.scrollTrigger?.vars['pin']).toBe(true);
    // Steps after the first: the first stays visible.
    expect(pin.calls).toHaveLength(2);
    expect(horizontal.scrollTrigger?.vars['pin']).toBe(true);
    expect(parallax.calls.map((call) => call.from?.['y'])).toEqual([24, 96]);
    expect(parallax.scrollTrigger?.vars['scrub']).toBe(0.6);
    expect(nth(scale.calls).from).toEqual({ scale: 0.86, borderRadius: '24px' });
  });

  it('maps the closed params through fixed tables', () => {
    const fake = fakeWindow();
    engineOf(fake).mount(
      element(
        '<ul data-ck-timeline="stagger-in" data-ck-ease="emphasized" data-ck-speed="slow" data-ck-stagger="lg" data-ck-delay="2" data-ck-scrub="true"><li>a</li></ul>',
      ),
      ctx(),
    );
    const tl = nth(fake.timelines);
    expect(tl.vars['defaults']).toEqual({ ease: 'expo.out', duration: 1.3 });
    expect(nth(tl.calls).vars['stagger']).toBe(0.18);
    expect(nth(tl.calls).vars['delay']).toBeCloseTo(0.16);
    expect(tl.scrollTrigger?.vars['scrub']).toBe(0.6);
  });

  it('data-ck-scrub="false" on a scrubbed recipe drops the smoothing, not the scrub', () => {
    const fake = fakeWindow();
    engineOf(fake).mount(
      element(
        '<div data-ck-timeline="parallax-depth" data-ck-scrub="false"><i data-ck-depth="2"></i></div>',
      ),
      ctx(),
    );
    expect(nth(fake.timelines, 0).scrollTrigger?.vars['scrub']).toBe(true);
  });

  it('flips the x sign under RTL (horizontal-scroll)', () => {
    const fake = fakeWindow();
    const engine = engineOf(fake);
    const make = (): HTMLElement => {
      const el = element(
        '<section data-ck-timeline="horizontal-scroll"><div>track</div></section>',
      );
      Object.defineProperty(el, 'clientWidth', { value: 400 });
      Object.defineProperty(el.firstElementChild, 'scrollWidth', { value: 1_000 });
      return el;
    };
    engine.mount(make(), ctx({ rtl: false }));
    engine.mount(make(), ctx({ rtl: true }));
    const ltr = nth(nth(fake.timelines, 0).calls).vars['x'] as () => number;
    const rtl = nth(nth(fake.timelines, 1).calls).vars['x'] as () => number;
    expect(ltr()).toBe(-600);
    expect(rtl()).toBe(600);
  });

  it('splits Arabic into words only (by lang or by content), other text into words and lines', () => {
    const fake = fakeWindow();
    const engine = engineOf(fake);
    engine.mount(element('<h2 lang="ar" data-ck-timeline="split-reveal">قائمة جديدة</h2>'), ctx());
    engine.mount(
      element('<h2 data-ck-timeline="split-reveal">قائمة الطعام</h2>'),
      ctx({ lang: 'en' }),
    );
    engine.mount(element('<h2 data-ck-timeline="split-reveal">Fresh menu</h2>'), ctx());
    const inArabicRegion = element(
      '<div lang="ar-JO"><h2 data-ck-timeline="split-reveal">Menu</h2></div>',
    ).firstElementChild as HTMLElement;
    inArabicRegion.getBoundingClientRect = () => ({ top: 2_000 }) as DOMRect;
    engine.mount(inArabicRegion, ctx());
    expect(FakeSplit.made.map((split) => split.vars['type'])).toEqual([
      'words',
      'words',
      'words,lines',
      'words',
    ]);
    expect(FakeSplit.made.every((split) => split.vars['type'] !== 'chars')).toBe(true);
    // The words are what animates.
    expect(
      (nth(nth(fake.timelines, 0).calls).target as Element[]).map((word) => word.textContent),
    ).toEqual(['قائمة', 'جديدة']);
  });

  it('hides the from-state only for elements starting below the viewport', () => {
    const fake = fakeWindow();
    const engine = engineOf(fake);
    engine.mount(element('<ul data-ck-timeline="stagger-in"><li>a</li></ul>', 2_000), ctx());
    expect(fake.timelines).toHaveLength(1);
    expect(nth(nth(fake.timelines, 0).calls).vars['immediateRender']).toBe(true);
    // Already on screen: an entrance would hide painted content, so nothing runs.
    engine.mount(element('<ul data-ck-timeline="stagger-in"><li>a</li></ul>', 10), ctx());
    engine.mount(element('<h2 data-ck-timeline="split-reveal">Hi there</h2>', 10), ctx());
    expect(fake.timelines).toHaveLength(1);
    expect(FakeSplit.made).toHaveLength(0);
    // A scroll-driven recipe on screen still runs (it moves, it does not hide).
    engine.mount(
      element('<div data-ck-timeline="parallax-depth"><i data-ck-depth="1"></i></div>', 10),
      ctx(),
    );
    expect(fake.timelines).toHaveLength(2);
  });

  it('prints the end state of an entrance still below the fold, and stops listening on dispose (fix pass 2026-10-06)', () => {
    const fake = fakeWindow();
    const dispose = engineOf(fake).mount(element('<ul data-ck-timeline="stagger-in"><li>a</li></ul>', 2_000), ctx());
    const tl = nth(fake.timelines);
    window.dispatchEvent(new Event('beforeprint'));
    expect(tl.progressed).toEqual([1]);
    dispose();
    window.dispatchEvent(new Event('beforeprint'));
    expect(tl.progressed).toEqual([1]);
  });

  it('runs nothing when reduced motion is preferred', () => {
    const fake = fakeWindow({ motion: false });
    engineOf(fake).mount(element('<h2 data-ck-timeline="split-reveal">Hi there</h2>'), ctx());
    expect(fake.timelines).toHaveLength(0);
    expect(FakeSplit.made).toHaveLength(0);
  });

  it('velocity-marquee listens to scroll velocity and stops on dispose', () => {
    const fake = fakeWindow();
    const el = element(
      '<div data-ck-timeline="velocity-marquee"><div data-ck-behavior="marquee"><span>a</span></div></div>',
    );
    const dispose = engineOf(fake).mount(el, ctx());
    expect(fake.triggers).toHaveLength(1);
    expect(nth(fake.triggers).vars['scroller']).toBe(document.defaultView);
    expect(typeof nth(fake.triggers).vars['onUpdate']).toBe('function');
    dispose();
    expect(nth(fake.triggers).killed).toBe(true);
  });

  it('dispose kills the ScrollTrigger, reverts SplitText and the tweens, and the matchMedia', () => {
    const fake = fakeWindow();
    const dispose = engineOf(fake).mount(
      element('<h2 data-ck-timeline="split-reveal">Hello you</h2>'),
      ctx(),
    );
    const tl = nth(fake.timelines);
    dispose();
    expect(tl.scrollTrigger?.killed).toBe(true);
    expect(tl.reverted).toBe(true);
    expect(nth(FakeSplit.made).reverted).toBe(true);
    expect(fake.media.reverted).toBe(1);
  });
});

describe('recipes (still: the canvas)', () => {
  it('sets the final state with no ScrollTrigger and no SplitText; Preview replays from 0', () => {
    const fake = fakeWindow();
    const c = ctx({ still: true });
    const dispose = engineOf(fake).mount(
      element('<h2 data-ck-timeline="split-reveal">Hello you</h2>', 10),
      c,
    );
    const tl = nth(fake.timelines);
    expect(tl.vars['paused']).toBe(true);
    expect(tl.scrollTrigger).toBeUndefined();
    expect(tl.progressed).toEqual([1]);
    expect(FakeSplit.made).toHaveLength(0);
    expect(fake.media.reverted).toBe(0);

    c.play();
    expect(tl.restarted).toBe(1);
    c.stop();
    expect(tl.progressed).toEqual([1, 1]);

    dispose();
    expect(tl.reverted).toBe(true);
    c.play();
    expect(tl.restarted).toBe(1);
  });

  it('rests the horizontal track at its start and parallax at its middle', () => {
    const fake = fakeWindow();
    const engine = engineOf(fake);
    engine.mount(
      element('<section data-ck-timeline="horizontal-scroll"><div>t</div></section>'),
      ctx({ still: true }),
    );
    engine.mount(
      element('<div data-ck-timeline="parallax-depth"><i data-ck-depth="2"></i></div>'),
      ctx({ still: true }),
    );
    expect(fake.timelines.map((tl) => tl.progressed)).toEqual([[0], [0.5]]);
    expect(fake.timelines.every((tl) => tl.scrollTrigger === undefined)).toBe(true);
  });
});

describe('serialised runner', () => {
  it('evaluates alone in a fresh document and mounts there, scrolled by that frame', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const frameWindow = frame.contentWindow as unknown as Window & TimelineWindow;
    const fake = fakeWindow();
    frameWindow.gsap = fake.win.gsap;
    frameWindow.ScrollTrigger = fake.win.ScrollTrigger;
    frameWindow.SplitText = fake.win.SplitText;
    const script = `(${installTimelineEngine.toString()})(window);`;
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- evaluating the serialised runner IS the test
    new Function('window', script)(frameWindow);

    const engine = frameWindow.ckEngines?.engines.timeline;
    expect(engine).toBeDefined();
    const doc = frame.contentDocument!;
    doc.body.innerHTML = '<ul data-ck-timeline="stagger-in"><li>a</li></ul>';
    const el = doc.querySelector('ul') as HTMLElement;
    el.getBoundingClientRect = () => ({ top: 5_000 }) as DOMRect;
    engine?.mount(el, ctx());
    expect(nth(fake.timelines, 0).scrollTrigger?.vars['scroller']).toBe(frameWindow);
    frame.remove();
  });
});
