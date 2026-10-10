import { gzipSync } from 'node:zlib';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mountCarousel } from './carousel';
import { CAROUSEL_PACK_CSS } from './gallery-css';

let reducedMotion = false;
let observers: IntersectionObserverCallback[] = [];

class StubObserver {
  readonly callback: IntersectionObserverCallback;
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    observers.push(callback);
  }
  observe(): void {
    // Visibility is reported by hand with `seen`.
  }
  disconnect(): void {
    observers = observers.filter((callback) => callback !== this.callback);
  }
  unobserve(): void {
    // The stub observes until disconnect.
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

function seen(isIntersecting: boolean): void {
  for (const callback of observers) {
    callback([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);
  }
}

beforeEach(() => {
  reducedMotion = false;
  observers = [];
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: query.includes('reduce') && reducedMotion,
        media: query,
        addEventListener() {
          // The preference never changes in a test.
        },
        removeEventListener() {
          // Nothing was added.
        },
      }) as unknown as MediaQueryList,
  );
  vi.stubGlobal('IntersectionObserver', StubObserver);
});

afterEach(() => {
  Reflect.deleteProperty(window, 'ckCarouselFactory');
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

function mount(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
}

/* jsdom lays nothing out: give the track and its slides a 300px geometry. */
function layout(host: HTMLElement, width = 300): HTMLElement {
  const track = host.querySelector<HTMLElement>('[data-ck-behavior="carousel"] > ul')!;
  const slides = [...track.children] as HTMLElement[];
  Object.defineProperty(track, 'clientWidth', { configurable: true, value: width });
  Object.defineProperty(track, 'scrollWidth', { configurable: true, value: width * slides.length });
  slides.forEach((slide, at) => {
    Object.defineProperty(slide, 'offsetWidth', { configurable: true, value: width });
    Object.defineProperty(slide, 'offsetLeft', { configurable: true, value: width * at });
  });
  return track;
}

function scrollTo(track: HTMLElement, left: number): void {
  track.scrollLeft = left;
  track.dispatchEvent(new Event('scroll'));
}

const SLIDES =
  '<ul><li>1</li><li>2</li><li>3</li></ul><div><button>prev</button><button>next</button></div>';

describe('lazy snap engine seam', () => {
  it('mounts once when the asset arrives late, updates indicators, and destroys on dispose', () => {
    const host = mount(carousel('data-ck-indicator="dots"', 'ar', 'rtl'));
    const track = layout(host);
    const dispose = mountCarousel(host);
    let selected = 0;
    const listeners: (() => void)[] = [];
    const engine = {
      scrollPrev: vi.fn(),
      scrollNext: vi.fn(),
      scrollTo: vi.fn((at: number) => {
        selected = at;
        listeners.forEach((fn) => {
          fn();
        });
      }),
      selectedScrollSnap: () => selected,
      on: (_event: string, fn: () => void) => {
        listeners.push(fn);
      },
      destroy: vi.fn(),
    };
    const factory = vi.fn(() => engine);
    Object.assign(window, { ckCarouselFactory: factory });
    window.dispatchEvent(new Event('ck-carousel-ready'));
    window.dispatchEvent(new Event('ck-carousel-ready'));
    expect(factory).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledWith(track, expect.objectContaining({ direction: 'rtl' }));
    dots(host)[2]?.click();
    expect(engine.scrollTo).toHaveBeenCalledWith(2, false);
    expect(dots(host)[2]).toHaveAttribute('aria-current', 'true');
    track.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(engine.scrollNext).toHaveBeenCalledWith(false);
    dispose();
    window.dispatchEvent(new Event('ck-carousel-ready'));
    expect(engine.destroy).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[data-ck-carousel-engine]')).toBeNull();
  });

  it('does not invoke a ready engine on the editing canvas or after disposal', () => {
    const factory = vi.fn();
    Object.assign(window, { ckCarouselFactory: factory });
    const host = mount(carousel(''));
    mountCarousel(host, { interactive: false })();
    expect(factory).not.toHaveBeenCalled();
    Reflect.deleteProperty(window, 'ckCarouselFactory');
    const dispose = mountCarousel(host);
    dispose();
    Object.assign(window, { ckCarouselFactory: factory });
    window.dispatchEvent(new Event('ck-carousel-ready'));
    expect(factory).not.toHaveBeenCalled();
  });

  it('uses instant snap with reduced motion and ignores keys from slide fields', () => {
    reducedMotion = true;
    const next = vi.fn();
    const factory = vi.fn(() => ({
      scrollPrev: vi.fn(),
      scrollNext: next,
      scrollTo: vi.fn(),
      selectedScrollSnap: () => 0,
      on: vi.fn(),
      destroy: vi.fn(),
    }));
    Object.assign(window, { ckCarouselFactory: factory });
    const host = mount(carousel(''));
    const track = layout(host);
    const field = document.createElement('input');
    track.firstElementChild?.append(field);
    const dispose = mountCarousel(host);
    expect(factory).toHaveBeenCalledWith(track, expect.objectContaining({ duration: 0 }));
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(next).not.toHaveBeenCalled();
    track.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(next).toHaveBeenCalledWith(true);
    dispose();
  });
});

function carousel(attrs: string, lang = 'en', dir = 'ltr'): string {
  return `<div lang="${lang}" dir="${dir}"><div data-ck-behavior="carousel" ${attrs}>${SLIDES}</div></div>`;
}

function dots(host: HTMLElement): HTMLButtonElement[] {
  return [...host.querySelectorAll<HTMLButtonElement>('[data-ck-carousel-dots] > button')];
}

describe('mountCarousel — the ported core (from runtime.ts)', () => {
  it('scrolls the carousel track the other way in RTL; the buttons are derived', () => {
    const host = mount(
      '<div dir="rtl" data-ck-behavior="carousel"><ul><li>1</li><li>2</li></ul><div><button>prev</button><button>next</button></div></div>',
    );
    mountCarousel(host);
    const track = host.querySelector<HTMLElement>('ul')!;
    expect(track.hasAttribute('data-ck-track')).toBe(true);
    expect(track.getAttribute('tabindex')).toBe('0');
    const [prev, next] = [...host.querySelectorAll('button')];
    next?.click();
    expect(track.scrollLeft).toBeLessThan(0);
    prev?.click();
    prev?.click();
    expect(track.scrollLeft).toBeGreaterThan(0);
  });

  it('scrolls forward in LTR by most of the track width', () => {
    const host = mount(carousel(''));
    const track = layout(host, 400);
    mountCarousel(host);
    host.querySelectorAll('button')[1]?.click();
    expect(track.scrollLeft).toBe(340);
  });

  it('builds nothing extra without indicator or autoplay params', () => {
    const host = mount(carousel(''));
    mountCarousel(host);
    expect(host.querySelector('[data-ck-carousel-ui]')).toBeNull();
    expect(host.querySelectorAll('button')).toHaveLength(2);
  });
});

describe('mountCarousel — indicators', () => {
  it('adds labelled dots after the derived buttons, marks the current one, and jumps on click', () => {
    const host = mount(carousel('data-ck-indicator="dots"'));
    const track = layout(host);
    mountCarousel(host);
    const all = dots(host);
    expect(all.map((dot) => dot.getAttribute('aria-label'))).toEqual([
      'Slide 1 of 3',
      'Slide 2 of 3',
      'Slide 3 of 3',
    ]);
    expect(all[0]?.getAttribute('aria-current')).toBe('true');
    scrollTo(track, 300);
    expect(all[1]?.getAttribute('aria-current')).toBe('true');
    expect(all[0]?.hasAttribute('aria-current')).toBe(false);
    all[2]?.click();
    expect(track.scrollLeft).toBe(600);
    // The derived prev/next still drive the track, not the dots.
    host.querySelector<HTMLElement>('[data-ck-behavior="carousel"] > div > button')?.click();
    expect(track.scrollLeft).toBeLessThan(600);
  });

  it('labels the dots in Arabic and reads the negative RTL scrollLeft', () => {
    const host = mount(carousel('data-ck-indicator="dots"', 'ar', 'rtl'));
    const track = layout(host);
    mountCarousel(host);
    const all = dots(host);
    expect(all[1]?.getAttribute('aria-label')).toBe('الشريحة ٢ من ٣');
    expect(host.querySelector('[data-ck-carousel-dots]')?.getAttribute('aria-label')).toBe(
      'الشرائح',
    );
    scrollTo(track, -300);
    expect(all[1]?.getAttribute('aria-current')).toBe('true');
    all[2]?.click();
    expect(track.scrollLeft).toBe(-600);
  });

  it('shows a polite counter, in Arabic-Indic digits under lang=ar; the end of the track is the last slide', () => {
    const host = mount(carousel('data-ck-indicator="counter"', 'ar', 'rtl'));
    const track = layout(host);
    mountCarousel(host);
    const counter = host.querySelector('[data-ck-carousel-counter]');
    expect(counter?.textContent).toBe('١ / ٣');
    expect(counter?.getAttribute('aria-live')).toBe('polite');
    scrollTo(track, -599);
    expect(counter?.textContent).toBe('٣ / ٣');
  });
});

describe('mountCarousel — autoplay', () => {
  it('advances every data-ck-speed, wraps at the end, and the toggle pauses and resumes', () => {
    vi.useFakeTimers();
    const host = mount(carousel('data-ck-autoplay="true" data-ck-speed="fast"'));
    const track = layout(host);
    mountCarousel(host);
    const toggle = host.querySelector<HTMLButtonElement>('[data-ck-carousel-play]')!;
    expect(toggle.getAttribute('aria-label')).toBe('Pause slideshow');
    vi.advanceTimersByTime(3_500);
    expect(track.scrollLeft).toBe(300);
    scrollTo(track, 600);
    vi.advanceTimersByTime(3_500);
    expect(track.scrollLeft).toBe(0);
    toggle.click();
    expect(toggle.getAttribute('aria-label')).toBe('Play slideshow');
    vi.advanceTimersByTime(10_000);
    expect(track.scrollLeft).toBe(0);
    toggle.click();
    vi.advanceTimersByTime(3_500);
    expect(track.scrollLeft).toBe(300);
  });

  it('pauses on hover, on focus within, and off screen', () => {
    vi.useFakeTimers();
    const host = mount(carousel('data-ck-autoplay="true"'));
    const track = layout(host);
    mountCarousel(host);
    const el = host.querySelector('[data-ck-behavior="carousel"]')!;
    el.dispatchEvent(new Event('pointerenter'));
    vi.advanceTimersByTime(5_000);
    expect(track.scrollLeft).toBe(0);
    el.dispatchEvent(new Event('pointerleave'));
    track.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    vi.advanceTimersByTime(5_000);
    expect(track.scrollLeft).toBe(0);
    track.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    seen(false);
    vi.advanceTimersByTime(5_000);
    expect(track.scrollLeft).toBe(0);
    seen(true);
    vi.advanceTimersByTime(5_000);
    expect(track.scrollLeft).toBe(300);
  });

  it('keeps the counter quiet while it plays and polite once paused', () => {
    vi.useFakeTimers();
    const host = mount(carousel('data-ck-autoplay="true" data-ck-indicator="counter"'));
    layout(host);
    mountCarousel(host);
    const counter = host.querySelector('[data-ck-carousel-counter]');
    expect(counter?.getAttribute('aria-live')).toBe('off');
    host.querySelector<HTMLButtonElement>('[data-ck-carousel-play]')?.click();
    expect(counter?.getAttribute('aria-live')).toBe('polite');
  });

  it('never autoplays under reduced motion, and moves without smooth scrolling', () => {
    vi.useFakeTimers();
    reducedMotion = true;
    const host = mount(carousel('data-ck-autoplay="true" data-ck-indicator="dots"'));
    const track = layout(host);
    const calls: ScrollToOptions[] = [];
    Object.defineProperty(track, 'scrollTo', {
      configurable: true,
      value: (options: ScrollToOptions) => {
        calls.push(options);
      },
    });
    mountCarousel(host);
    expect(host.querySelector('[data-ck-carousel-play]')).toBeNull();
    vi.advanceTimersByTime(20_000);
    expect(calls).toHaveLength(0);
    dots(host)[1]?.click();
    expect(calls).toEqual([{ left: 300, behavior: 'auto' }]);
    expect(
      host.querySelector('[data-ck-behavior="carousel"]')?.getAttribute('data-ck-mounted'),
    ).toBe('static');
  });

  it('is still on the editing canvas: no autoplay, dots drawn but inert', () => {
    vi.useFakeTimers();
    const host = mount(carousel('data-ck-autoplay="true" data-ck-indicator="dots"'));
    const track = layout(host);
    mountCarousel(host, { interactive: false });
    expect(host.querySelector('[data-ck-carousel-play]')).toBeNull();
    vi.advanceTimersByTime(20_000);
    expect(track.scrollLeft).toBe(0);
    const [first, second] = dots(host);
    expect(first?.tabIndex).toBe(-1);
    expect(first?.style.pointerEvents).toBe('none');
    second?.click();
    expect(track.scrollLeft).toBe(0);
  });
});

describe('mountCarousel — idempotence, dispose, serialisation', () => {
  it('is idempotent: a second mount builds no second row', () => {
    const host = mount(carousel('data-ck-indicator="dots"'));
    mountCarousel(host);
    const again = mountCarousel(host);
    expect(host.querySelectorAll('[data-ck-carousel-ui]')).toHaveLength(1);
    again();
    expect(host.querySelectorAll('[data-ck-carousel-ui]')).toHaveLength(1);
  });

  it('the disposer restores the DOM and stops the timer', () => {
    vi.useFakeTimers();
    const host = mount(carousel('data-ck-autoplay="true" data-ck-indicator="dots"'));
    const before = host.innerHTML;
    const track = layout(host);
    const dispose = mountCarousel(host);
    dispose();
    expect(host.innerHTML).toBe(before);
    vi.advanceTimersByTime(20_000);
    expect(track.scrollLeft).toBe(0);
    host.querySelectorAll('button')[1]?.click();
    expect(track.scrollLeft).toBe(0);
  });

  it('is self-contained: its serialised form mounts in a fresh document', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const fresh = frame.contentDocument!;
    fresh.documentElement.setAttribute('lang', 'ar');
    fresh.body.innerHTML = `<div data-ck-behavior="carousel" data-ck-indicator="counter">${SLIDES}</div>`;
    const script = `(${mountCarousel.toString()})(document);`;
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- evaluating the serialised pack IS the test
    new Function('document', script)(fresh);
    expect(fresh.querySelector('ul')?.hasAttribute('data-ck-track')).toBe(true);
    expect(fresh.querySelector('[data-ck-carousel-counter]')?.textContent).toBe('١ / ٣');
    frame.remove();
  });

  it('stays within 4 kB gzipped', () => {
    expect(gzipSync(mountCarousel.toString()).length).toBeLessThanOrEqual(4096);
  });

  it('carries the old track rules verbatim and gates its transitions on the preference', () => {
    expect(CAROUSEL_PACK_CSS).toContain(
      "[data-ck-behavior='carousel'] [data-ck-track] > * {\n  scroll-snap-align: start;\n}",
    );
    expect(CAROUSEL_PACK_CSS).toContain('@media (prefers-reduced-motion: no-preference)');
    expect(CAROUSEL_PACK_CSS).not.toMatch(/(?:^|[\s;{])(?:left|right)\s*:/mu);
    expect(CAROUSEL_PACK_CSS).toContain(
      "[data-ck-carousel-dots] > button[aria-current='true']::before",
    );
  });
});
