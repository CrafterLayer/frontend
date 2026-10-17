import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ckEnginesShimOf,
  ensureCkEngines,
  type CkEngineContext,
  type CkEngines,
  type CkEnginesHost,
} from '../../engines/ck-engines-shim';
import { ENGINES_PACK_CSS, mountEngines } from './engines';

/* The pack keys `window.ckEngines` on the root's own window: jsdom's global one here. */
function engines(): CkEngines | undefined {
  return (window as unknown as CkEnginesHost).ckEngines;
}

const flush = () => new Promise((done) => setTimeout(done, 0));

function host(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

let observers: { callback: IntersectionObserverCallback; targets: Element[]; options?: IntersectionObserverInit }[] = [];

function intersect(): void {
  for (const observer of observers) {
    observer.callback(
      observer.targets.map((target) => ({ isIntersecting: true, target }) as unknown as IntersectionObserverEntry),
      {} as IntersectionObserver,
    );
  }
}

beforeEach(() => {
  delete (window as unknown as CkEnginesHost).ckEngines;
  observers = [];
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      private readonly record: (typeof observers)[number];
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        this.record = { callback, targets: [], ...(options === undefined ? {} : { options }) };
        observers.push(this.record);
      }
      observe(target: Element): void {
        this.record.targets.push(target);
      }
      disconnect(): void {
        this.record.targets = [];
      }
      unobserve(): void {
        // not used
      }
    },
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  delete (window as unknown as CkEnginesHost).ckEngines;
});

describe('mountEngines — the handshake', () => {
  it('queues each marker, and ready() mounts the queued entries with their context', () => {
    const root = host(
      '<section dir="rtl" lang="ar"><div data-ck-scene="particles"><img src="a.jpg" alt=""></div><h2 data-ck-timeline="split-reveal">مرحبا</h2></section>',
    );
    const dispose = mountEngines(root);
    const api = engines();
    expect(api?.queue.map((entry) => entry.kind)).toEqual(['scene', 'timeline']);
    const scene = root.querySelector<HTMLElement>('[data-ck-scene]')!;
    expect(scene.hasAttribute('data-ck-engine-mounted')).toBe(true);

    const stop = vi.fn();
    const mount = vi.fn((_el: HTMLElement, _ctx: CkEngineContext) => stop);
    api?.ready('scene', { mount });
    expect(mount).toHaveBeenCalledTimes(1);
    const [el, ctx] = mount.mock.calls[0] ?? [];
    expect(el).toBe(scene);
    expect(ctx?.still).toBe(false);
    expect(ctx?.canvas).toBe(false);
    expect(ctx?.rtl).toBe(true);
    expect(ctx?.lang).toBe('ar');
    expect(api?.queue.map((entry) => entry.kind)).toEqual(['timeline']);

    dispose();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(api?.queue).toEqual([]);
    expect(scene.hasAttribute('data-ck-engine-mounted')).toBe(false);
  });

  it('mounts at once when the engine registered first (the asset ran before the pack)', () => {
    const mount = vi.fn(() => () => undefined);
    ensureCkEngines(window as unknown as CkEnginesHost).ready('lottie', { mount });
    const root = host('<div data-ck-lottie="" data-ck-src="https://a.example/x.json"><img src="p.png" alt=""></div>');
    mountEngines(root);
    expect(mount).toHaveBeenCalledTimes(1);
    expect(engines()?.queue).toEqual([]);
  });

  it('is idempotent, and a disposed mount is never drained by a late ready()', () => {
    const root = host('<div data-ck-scene="mural"></div>');
    const dispose = mountEngines(root);
    mountEngines(root);
    expect(engines()?.queue).toHaveLength(1);
    dispose();
    const mount = vi.fn(() => () => undefined);
    engines()?.ready('scene', { mount });
    expect(mount).not.toHaveBeenCalled();
  });

  it('does nothing under reduced motion: no queue, no request', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({ matches: query.includes('reduce'), addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    );
    document.head.innerHTML = '<link rel="prefetch" as="script" href="/assets/ck-timeline.js" data-ck-engine="timeline">';
    const root = host('<h2 data-ck-timeline="split-reveal">x</h2>');
    mountEngines(root);
    expect(engines()).toBeUndefined();
    expect(document.querySelector('script[data-ck-engine]')).toBeNull();
    expect(root.querySelector('h2')?.hasAttribute('data-ck-engine-mounted')).toBe(false);
  });

  it('embeds a copy of ensureCkEngines identical to the shim', () => {
    expect(ckEnginesShimOf(mountEngines.toString())).toBe(ckEnginesShimOf(ensureCkEngines.toString()));
  });
});

describe('mountEngines — requesting the asset (export)', () => {
  it('injects the timeline script at once, from the prefetch link, once per document', () => {
    document.head.innerHTML = '<link rel="prefetch" as="script" href="/assets/ck-timeline.js" data-ck-engine="timeline">';
    mountEngines(host('<h2 data-ck-timeline="split-reveal">x</h2>'));
    mountEngines(host('<h2 data-ck-timeline="stagger-in">y</h2>'));
    const scripts = document.querySelectorAll('script[data-ck-engine="timeline"]');
    expect(scripts).toHaveLength(1);
    expect((scripts[0] as HTMLScriptElement).src).toMatch(/\/assets\/ck-timeline\.js$/u);
  });

  it('loads a scene only after idle AND near the viewport (rootMargin 25%)', () => {
    vi.useFakeTimers();
    document.head.innerHTML = '<link rel="prefetch" as="script" href="/assets/ck-scene.js" data-ck-engine="scene">';
    mountEngines(host('<div data-ck-scene="particles"><img src="a.jpg" alt=""></div>'));
    const present = () => document.querySelector('script[data-ck-engine="scene"]') !== null;
    expect(present()).toBe(false);
    expect(observers[0]?.options?.rootMargin).toBe('25%');
    vi.advanceTimersByTime(200);
    expect(present()).toBe(false);
    intersect();
    expect(present()).toBe(true);
  });

  it('waits for idle when the scene is already near', () => {
    vi.useFakeTimers();
    document.head.innerHTML = '<link rel="prefetch" as="script" href="/assets/ck-lottie.js" data-ck-engine="lottie">';
    mountEngines(host('<div data-ck-lottie="" data-ck-src="https://a.example/x.json"></div>'));
    intersect();
    expect(document.querySelector('script[data-ck-engine="lottie"]')).toBeNull();
    vi.advanceTimersByTime(200);
    expect(document.querySelector('script[data-ck-engine="lottie"]')).not.toBeNull();
  });

  it('requests nothing without a prefetch link (the canvas: mount.ts injects), and nothing after dispose', () => {
    vi.useFakeTimers();
    mountEngines(host('<h2 data-ck-timeline="split-reveal">x</h2>'));
    expect(document.querySelector('script[data-ck-engine]')).toBeNull();
    document.head.innerHTML = '<link rel="prefetch" as="script" href="/assets/ck-scene.js" data-ck-engine="scene">';
    const dispose = mountEngines(host('<div data-ck-scene="particles"></div>'));
    dispose();
    intersect();
    vi.advanceTimersByTime(500);
    expect(document.querySelector('script[data-ck-engine]')).toBeNull();
  });
});

describe('mountEngines — the canvas (gsap-pixi 2026-10-08: it runs)', () => {
  it('passes { still: false, canvas: true } and forwards data-ck-play to onPlay / onStop', async () => {
    const play = vi.fn();
    const stop = vi.fn();
    let seen: CkEngineContext | undefined;
    ensureCkEngines(window as unknown as CkEnginesHost).ready('timeline', {
      mount: (_el, ctx) => {
        seen = ctx;
        ctx.onPlay(play);
        ctx.onStop(stop);
        return () => undefined;
      },
    });
    const root = host('<h2 data-ck-timeline="split-reveal">x</h2>');
    const dispose = mountEngines(root, { interactive: false });
    expect(seen?.still).toBe(false);
    expect(seen?.canvas).toBe(true);
    const heading = root.querySelector('h2') as HTMLElement;
    heading.setAttribute('data-ck-play', '1');
    await flush();
    expect(play).toHaveBeenCalledTimes(1);
    heading.removeAttribute('data-ck-play');
    await flush();
    expect(stop).toHaveBeenCalledTimes(1);
    dispose();
    heading.setAttribute('data-ck-play', '2');
    await flush();
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('wires no Preview watcher on a published page', async () => {
    const play = vi.fn();
    ensureCkEngines(window as unknown as CkEnginesHost).ready('timeline', {
      mount: (_el, ctx) => {
        ctx.onPlay(play);
        return () => undefined;
      },
    });
    const root = host('<h2 data-ck-timeline="split-reveal">x</h2>');
    mountEngines(root);
    root.querySelector('h2')?.setAttribute('data-ck-play', '1');
    await flush();
    expect(play).not.toHaveBeenCalled();
  });
});

describe('mountEngines — one element, several engines (gsap-pixi 2026-10-08)', () => {
  it('mounts a scene AND a timeline on the same section, and dispose unmarks both', () => {
    const root = host('<section data-ck-scene="particles" data-ck-timeline="fade-in"><h2>x</h2></section>');
    const section = root.querySelector('section')!;
    const dispose = mountEngines(root);
    expect(engines()?.queue.map((entry) => [entry.kind, entry.el])).toEqual([
      ['scene', section],
      ['timeline', section],
    ]);
    expect(section.getAttribute('data-ck-engine-mounted')).toBe('scene timeline');
    // Idempotent per (kind, element): a second pass queues nothing new.
    mountEngines(root);
    expect(engines()?.queue).toHaveLength(2);
    dispose();
    expect(engines()?.queue).toEqual([]);
    expect(section.hasAttribute('data-ck-engine-mounted')).toBe(false);
  });

  it('a second mount adds only the kind the first one lacked, and each dispose removes its own', () => {
    const root = host('<section data-ck-scene="particles"><h2>x</h2></section>');
    const section = root.querySelector('section')!;
    const first = mountEngines(root);
    section.setAttribute('data-ck-timeline', 'fade-in');
    const second = mountEngines(root);
    expect(engines()?.queue.map((entry) => entry.kind)).toEqual(['scene', 'timeline']);
    expect(section.getAttribute('data-ck-engine-mounted')).toBe('scene timeline');
    first();
    expect(section.getAttribute('data-ck-engine-mounted')).toBe('timeline');
    second();
    expect(section.hasAttribute('data-ck-engine-mounted')).toBe(false);
  });
});

describe('mountEngines — self', () => {
  it('handles only the root itself, never its descendants', () => {
    const root = host('<section data-ck-scene="particles"><h2 data-ck-timeline="split-reveal">x</h2></section>');
    const section = root.querySelector('section')!;
    mountEngines(section, { self: true });
    expect(engines()?.queue.map((entry) => [entry.kind, entry.el])).toEqual([['scene', section]]);
    expect(root.querySelector('h2')?.hasAttribute('data-ck-engine-mounted')).toBe(false);

    const heading = root.querySelector('h2') as HTMLElement;
    expect(mountEngines(root, { self: true })).toBeTypeOf('function');
    expect(engines()?.queue).toHaveLength(1);
    mountEngines(heading, { self: true });
    expect(engines()?.queue.map((entry) => entry.el)).toEqual([section, heading]);
  });

  it('on the canvas, forwards Preview set on an ANCESTOR of a self-mounted element', async () => {
    const play = vi.fn();
    ensureCkEngines(window as unknown as CkEnginesHost).ready('timeline', {
      mount: (_el, ctx) => {
        ctx.onPlay(play);
        return () => undefined;
      },
    });
    const root = host('<section><h2 data-ck-timeline="split-reveal">x</h2></section>');
    const dispose = mountEngines(root.querySelector('h2') as HTMLElement, { interactive: false, self: true });
    root.querySelector('section')?.setAttribute('data-ck-play', '1');
    await flush();
    expect(play).toHaveBeenCalledTimes(1);
    dispose();
  });
});

describe('ENGINES_PACK_CSS', () => {
  it('hides the fallback imgs only once the engine drew, and never a scene host’s content imgs', () => {
    expect(ENGINES_PACK_CSS).toContain('[data-ck-scene][data-ck-ready]:not([data-ck-scene-host]) > img');
    expect(ENGINES_PACK_CSS).toContain('[data-ck-lottie][data-ck-ready] > img');
    expect(ENGINES_PACK_CSS).not.toMatch(/\[data-ck-scene\]\s*>\s*img/u);
    expect(ENGINES_PACK_CSS).not.toMatch(/\[data-ck-scene\]\[data-ck-ready\]\s*>\s*img/u);
  });
});
