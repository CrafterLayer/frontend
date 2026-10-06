import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mountBehaviors } from './runtime';

/* ── stubs: matchMedia (reduced motion), IntersectionObserver, rAF ─────────── */

let reducedMotion = false;
let observed: { callback: IntersectionObserverCallback; targets: Element[] }[] = [];
let frames: FrameRequestCallback[] = [];
let now = 1_000;

class StubObserver {
  readonly entry: { callback: IntersectionObserverCallback; targets: Element[] };
  constructor(callback: IntersectionObserverCallback) {
    this.entry = { callback, targets: [] };
    observed.push(this.entry);
  }
  observe(target: Element): void {
    this.entry.targets.push(target);
  }
  disconnect(): void {
    this.entry.targets = [];
  }
  unobserve(): void {
    // The stub observes until disconnect.
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

function enterAll(): void {
  for (const entry of observed) {
    const records = entry.targets.map(
      (target) => ({ isIntersecting: true, target }) as unknown as IntersectionObserverEntry,
    );
    if (records.length > 0) entry.callback(records, {} as IntersectionObserver);
  }
}

function flushFrames(at: number): void {
  now = at;
  for (let round = 0; round < 20 && frames.length > 0; round += 1) {
    const due = frames;
    frames = [];
    for (const frame of due) frame(at);
  }
}

beforeEach(() => {
  reducedMotion = false;
  observed = [];
  frames = [];
  now = 1_000;
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
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    // Frames are flushed by hand.
  });
  vi.spyOn(window.performance, 'now').mockImplementation(() => now);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

function mount(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
}

describe('mountBehaviors', () => {
  it('counts up to data-ck-to in Arabic-Indic digits under lang=ar, keeping the text around it', () => {
    const host = mount(
      '<section lang="ar"><span data-ck-behavior="count-up" data-ck-to="1500">+0 عميل</span></section>',
    );
    mountBehaviors(host);
    const counter = host.querySelector('span');
    expect(counter?.textContent).toBe('+٠ عميل');
    enterAll();
    flushFrames(1_000 + 5_000);
    expect(counter?.textContent).toBe('+١٬٥٠٠ عميل');
  });

  it('counts in Latin digits on an English page, with the decimals it was given', () => {
    const host = mount('<p lang="en"><span data-ck-behavior="count-up" data-ck-to="4.8">0</span></p>');
    mountBehaviors(host);
    enterAll();
    flushFrames(9_000);
    expect(host.querySelector('span')?.textContent).toBe('4.8');
  });

  it('renders static under reduced motion: final count, revealed, no marquee clones', () => {
    reducedMotion = true;
    const host = mount(
      [
        '<span lang="ar" data-ck-behavior="count-up" data-ck-to="120">0</span>',
        '<div data-ck-behavior="reveal">hi</div>',
        '<ul data-ck-behavior="marquee"><li>a</li><li>b</li></ul>',
      ].join(''),
    );
    mountBehaviors(host);
    expect(host.querySelector('span')?.textContent).toBe('١٢٠');
    expect(host.querySelector('[data-ck-behavior="reveal"]')?.classList.contains('ck-in')).toBe(true);
    expect(host.querySelector('[data-ck-behavior="reveal"]')?.getAttribute('data-ck-mounted')).toBe(
      'static',
    );
    expect(host.querySelectorAll('li')).toHaveLength(2);
    expect(observed).toHaveLength(0);
  });

  it('reveals and staggers only once the element is seen', () => {
    const host = mount(
      '<div data-ck-behavior="reveal">a</div><ul data-ck-behavior="stagger"><li>1</li><li>2</li></ul>',
    );
    mountBehaviors(host);
    const reveal = host.querySelector('[data-ck-behavior="reveal"]');
    expect(reveal?.classList.contains('ck-in')).toBe(false);
    expect((host.querySelectorAll('li')[1] as HTMLElement).style.getPropertyValue('--ck-i')).toBe('1');
    enterAll();
    expect(reveal?.classList.contains('ck-in')).toBe(true);
    expect(host.querySelector('ul')?.classList.contains('ck-in')).toBe(true);
  });

  it('duplicates marquee children as hidden, inert clones and flips the direction in RTL', () => {
    const host = mount('<ul dir="rtl" data-ck-behavior="marquee"><li id="one">a</li><li>b</li></ul>');
    const dispose = mountBehaviors(host);
    const list = host.querySelector('ul') as HTMLElement;
    const clones = list.querySelectorAll('[data-ck-clone]');
    expect(clones).toHaveLength(2);
    expect(clones[0]?.getAttribute('aria-hidden')).toBe('true');
    expect(clones[0]?.hasAttribute('inert')).toBe(true);
    expect(clones[0]?.hasAttribute('id')).toBe(false);
    expect(list.style.getPropertyValue('--ck-marquee-dir')).toBe('1');
    dispose();
    expect(list.querySelectorAll('li')).toHaveLength(2);
    expect(list.style.getPropertyValue('--ck-marquee-dir')).toBe('');
  });

  it('is idempotent: mounting twice is a no-op', () => {
    const open = vi.fn();
    vi.stubGlobal('open', open);
    const host = mount(
      '<ul data-ck-behavior="marquee"><li>a</li></ul><button data-ck-behavior="whatsapp-form" data-ck-phone="962790000000">x</button>',
    );
    mountBehaviors(host);
    const again = mountBehaviors(host);
    expect(host.querySelectorAll('li')).toHaveLength(2);
    host.querySelector('button')?.click();
    expect(open).toHaveBeenCalledTimes(1);
    again();
    // Disposing the no-op second mount leaves the first one standing.
    expect(host.querySelector('button')?.hasAttribute('data-ck-mounted')).toBe(true);
  });

  it('the disposer removes every listener, marker and class it added', () => {
    const open = vi.fn();
    vi.stubGlobal('open', open);
    const removed = vi.spyOn(window, 'removeEventListener');
    const host = mount(
      [
        '<header data-ck-behavior="sticky-header">h</header>',
        '<button data-ck-behavior="whatsapp-form" data-ck-phone="962790000000">x</button>',
        '<div data-ck-behavior="reveal">r</div>',
      ].join(''),
    );
    const dispose = mountBehaviors(host);
    enterAll();
    dispose();
    expect(removed).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });
    host.querySelector('button')?.click();
    expect(open).not.toHaveBeenCalled();
    expect(host.querySelectorAll('[data-ck-mounted]')).toHaveLength(0);
    expect(host.querySelector('.ck-in')).toBeNull();
    // And a fresh mount after dispose works again.
    mountBehaviors(host);
    host.querySelector('button')?.click();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('keeps a value the host rewrote after mounting', () => {
    const host = mount(
      '<div data-ck-behavior="tabs"><div><button>A</button><button>B</button></div><p>1</p><p>2</p></div>',
    );
    const dispose = mountBehaviors(host);
    const tab = host.querySelector('button')!;
    tab.setAttribute('role', 'link');
    dispose();
    expect(tab.getAttribute('role')).toBe('link');
    expect(host.querySelectorAll('[role="tab"]')).toHaveLength(0);
  });

  it('wires tabs with ARIA roles and mirrors the arrow keys in RTL', () => {
    const host = mount(
      '<div dir="rtl" data-ck-behavior="tabs"><div><button>أ</button><button>ب</button><button>ج</button></div><p>1</p><p>2</p><p>3</p></div>',
    );
    mountBehaviors(host);
    const tabs = [...host.querySelectorAll('button')];
    const panels = [...host.querySelectorAll('p')];
    expect(host.querySelector('[role="tablist"]')).not.toBeNull();
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);
    expect(panels.map((panel) => panel.hidden)).toEqual([false, true, true]);
    expect(panels[0]?.getAttribute('aria-labelledby')).toBe(tabs[0]?.id);
    tabs[0]?.focus();
    tabs[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(document.activeElement).toBe(tabs[1]);
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('true');
    expect(panels[1]?.hidden).toBe(false);
    tabs[1]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(tabs[0]);
    tabs[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(tabs[2]);
    tabs[0]?.click();
    expect(panels.map((panel) => panel.hidden)).toEqual([false, true, true]);
  });

  it('moves forward with ArrowRight in LTR tabs', () => {
    const host = mount(
      '<div data-ck-behavior="tabs"><div><button>A</button><button>B</button></div><p>1</p><p>2</p></div>',
    );
    mountBehaviors(host);
    const tabs = [...host.querySelectorAll('button')];
    tabs[0]?.focus();
    tabs[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(tabs[1]);
  });

  it('opens WhatsApp with the phone digits and the encoded message and fields, no network', () => {
    const open = vi.fn();
    vi.stubGlobal('open', open);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const host = mount(
      [
        '<form data-ck-behavior="whatsapp-form" data-ck-phone="+962790000000" data-ck-text="مرحبا & أهلا">',
        '<input aria-label="الاسم" value="علي" />',
        '<input name="guests" placeholder="العدد" value="2" />',
        '<input type="hidden" name="secret" value="x" />',
        '<button type="submit">إرسال</button></form>',
      ].join(''),
    );
    mountBehaviors(host);
    host.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    expect(open).toHaveBeenCalledWith(
      `https://wa.me/962790000000?text=${encodeURIComponent('مرحبا & أهلا\nالاسم: علي\nالعدد: 2')}`,
      '_blank',
      'noopener,noreferrer',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('scrolls the carousel track the other way in RTL; the buttons are derived', () => {
    const host = mount(
      '<div dir="rtl" data-ck-behavior="carousel"><ul><li>1</li><li>2</li></ul><div><button>prev</button><button>next</button></div></div>',
    );
    mountBehaviors(host);
    const track = host.querySelector('ul') as HTMLElement;
    expect(track.hasAttribute('data-ck-track')).toBe(true);
    const [prev, next] = [...host.querySelectorAll('button')];
    next?.click();
    expect(track.scrollLeft).toBeLessThan(0);
    prev?.click();
    prev?.click();
    expect(track.scrollLeft).toBeGreaterThan(0);
  });

  it('counts down to data-ck-until in a polite live region', () => {
    vi.useFakeTimers({ now: new Date('2026-12-31T00:00:00Z') });
    const host = mount(
      '<span lang="en" data-ck-behavior="countdown" data-ck-until="2027-01-01T01:02:03Z">--</span>',
    );
    const dispose = mountBehaviors(host);
    const clock = host.querySelector('span');
    expect(clock?.getAttribute('aria-live')).toBe('polite');
    expect(clock?.textContent).toBe('1:01:02:03');
    vi.advanceTimersByTime(3_000);
    expect(clock?.textContent).toBe('1:01:02:00');
    dispose();
    expect(clock?.textContent).toBe('--');
    expect(clock?.hasAttribute('aria-live')).toBe(false);
    vi.useRealTimers();
  });

  it('opens a lightbox dialog and copies text with the clipboard', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const host = mount(
      '<figure data-ck-behavior="lightbox"><img src="/a.webp" alt="القهوة" /></figure><button data-ck-behavior="copy-text" data-ck-text="IBAN 123">نسخ</button>',
    );
    const dispose = mountBehaviors(host);
    (host.querySelector('figure')!).click();
    const dialog = document.querySelector('dialog[data-ck-lightbox]');
    expect(dialog?.getAttribute('aria-label')).toBe('القهوة');
    expect(dialog?.querySelector('img')?.getAttribute('src')).toMatch(/\/a\.webp$/u);
    host.querySelector('button')?.click();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith('IBAN 123');
    expect(host.querySelector('button')?.classList.contains('ck-copied')).toBe(true);
    dispose();
    expect(document.querySelector('dialog[data-ck-lightbox]')).toBeNull();
  });

  it('leaves the click-driven behaviours inert when not interactive (the canvas)', () => {
    const open = vi.fn();
    vi.stubGlobal('open', open);
    const host = mount(
      '<button data-ck-behavior="whatsapp-form" data-ck-phone="962790000000">x</button><div data-ck-behavior="reveal">r</div>',
    );
    mountBehaviors(host, { interactive: false });
    host.querySelector('button')?.click();
    expect(open).not.toHaveBeenCalled();
    expect(host.querySelector('button')?.hasAttribute('data-ck-mounted')).toBe(false);
    expect(host.querySelector('[data-ck-behavior="reveal"]')?.hasAttribute('data-ck-mounted')).toBe(true);
  });
});

/* ── motion presets (style-manager DESIGN.md §B) ──────────────────────────── */

function enterAt(top: number, height = 100, viewport = 800): void {
  for (const entry of observed) {
    const records = entry.targets.map(
      (target) =>
        ({
          isIntersecting: top < viewport && top + height > 0,
          target,
          boundingClientRect: { top, bottom: top + height, height },
          rootBounds: { height: viewport },
        }) as unknown as IntersectionObserverEntry,
    );
    if (records.length > 0) entry.callback(records, {} as IntersectionObserver);
  }
}

describe('mountBehaviors — motion presets', () => {
  it('splits words into aria-hidden spans with their index, keeps the sentence in aria-label, and undoes it', () => {
    const host = mount('<h2 data-ck-motion="split-words">Hello brave world</h2>');
    const dispose = mountBehaviors(host);
    const heading = host.querySelector('h2');
    expect(heading?.getAttribute('aria-label')).toBe('Hello brave world');
    const units = Array.from(host.querySelectorAll<HTMLElement>('.ck-u'));
    expect(units.map((unit) => unit.textContent)).toEqual(['Hello', 'brave', 'world']);
    expect(units.every((unit) => unit.getAttribute('aria-hidden') === 'true')).toBe(true);
    expect(units.map((unit) => unit.style.getPropertyValue('--ck-u-i'))).toEqual(['0', '1', '2']);
    expect(heading?.hasAttribute('data-ck-mounted')).toBe(true);
    dispose();
    expect(host.querySelectorAll('.ck-u')).toHaveLength(0);
    expect(heading?.textContent).toBe('Hello brave world');
    expect(heading?.hasAttribute('aria-label')).toBe(false);
  });

  it('splits Latin text by character but Arabic by word, so joined letters keep their shapes', () => {
    const host = mount(
      '<h2 data-ck-motion="split-chars">Hi you</h2><h3 dir="rtl" data-ck-motion="split-chars">مرحبا بالعالم</h3>',
    );
    mountBehaviors(host);
    expect(host.querySelectorAll('h2 .ck-c')).toHaveLength(5);
    expect(host.querySelectorAll('h3 .ck-c')).toHaveLength(0);
    expect(Array.from(host.querySelectorAll('h3 .ck-u'), (unit) => unit.textContent)).toEqual(['مرحبا', 'بالعالم']);
    expect(host.querySelector<HTMLElement>('h3')?.style.getPropertyValue('--ck-u-step')).toBe('80ms');
  });

  it('is inert under reduced motion: no split, no meteors, no observer; the final state stays', () => {
    reducedMotion = true;
    const host = mount(
      '<h2 data-ck-motion="split-chars">Hi</h2><div data-ck-motion="fade-up">x</div><div data-ck-motion="meteors"></div><button data-ck-hover="tilt">t</button>',
    );
    mountBehaviors(host);
    expect(host.querySelectorAll('.ck-u, .ck-meteor')).toHaveLength(0);
    expect(host.querySelector('h2')?.hasAttribute('aria-label')).toBe(false);
    expect(observed).toHaveLength(0);
    expect(host.querySelector('[data-ck-motion="fade-up"]')?.getAttribute('data-ck-mounted')).toBe('static');
    expect(host.querySelector('h2')?.hasAttribute('data-ck-mounted')).toBe(false);
  });

  it('plays a click trigger on its data-ck-target, and replays on every click', () => {
    const host = mount(
      '<button data-ck-motion="fade" data-ck-trigger="click" data-ck-target="card">Go</button><div id="card" data-ck-motion="zoom-in" data-ck-trigger="click">x</div>',
    );
    mountBehaviors(host);
    const button = host.querySelector('button');
    const card = host.querySelector('#card');
    button?.click();
    expect(card?.hasAttribute('data-ck-play')).toBe(true);
    expect(button?.hasAttribute('data-ck-play')).toBe(false);
    now = 2_345;
    button?.click();
    expect(card?.getAttribute('data-ck-play')).toBe('2345');
    (card as HTMLElement).click();
    expect(card?.hasAttribute('data-ck-play')).toBe(true);
  });

  it('indexes stagger children (capped) and a grid by row + column', () => {
    const host = mount(
      '<ul data-ck-motion="stagger-up"><li>a</li><li>b</li><li>c</li></ul><div data-ck-motion="stagger-grid"><i></i><i></i><i></i><i></i></div>',
    );
    const cells = Array.from(host.querySelectorAll<HTMLElement>('i'));
    cells.forEach((cell, at) => {
      Object.defineProperty(cell, 'offsetTop', { value: at < 2 ? 0 : 50 });
    });
    mountBehaviors(host);
    const items = Array.from(host.querySelectorAll<HTMLElement>('li'));
    expect(items.map((item) => item.style.getPropertyValue('--ck-i'))).toEqual(['0', '1', '2']);
    expect(host.querySelector<HTMLElement>('ul')?.style.getPropertyValue('--ck-n')).toBe('3');
    expect(cells.map((cell) => cell.style.getPropertyValue('--ck-i'))).toEqual(['0', '1', '1', '2']);
  });

  it('marks a view-triggered element seen, then done once its range has passed (once)', () => {
    const host = mount('<div data-ck-motion="fade-up">x</div><div data-ck-motion="fade-up" data-ck-once="false">y</div>');
    mountBehaviors(host);
    const [once, again] = Array.from(host.querySelectorAll('[data-ck-motion]'));
    enterAt(700);
    expect(once?.hasAttribute('data-ck-inview')).toBe(true);
    expect(once?.hasAttribute('data-ck-done')).toBe(false);
    enterAt(200);
    expect(once?.hasAttribute('data-ck-done')).toBe(true);
    expect(again?.hasAttribute('data-ck-done')).toBe(false);
    enterAt(900);
    expect(again?.hasAttribute('data-ck-inview')).toBe(false);
  });

  it('keeps the canvas still, and builds a DOM preset only while Preview plays it', async () => {
    const host = mount('<h2 data-ck-motion="split-words">Hello world</h2><div data-ck-motion="fade-up">x</div>');
    const dispose = mountBehaviors(host, { interactive: false });
    expect(host.hasAttribute('data-ck-still')).toBe(true);
    expect(host.querySelectorAll('.ck-u')).toHaveLength(0);
    expect(observed).toHaveLength(0);
    const heading = host.querySelector('h2');
    heading?.setAttribute('data-ck-play', '1');
    await Promise.resolve();
    expect(host.querySelectorAll('.ck-u')).toHaveLength(2);
    heading?.removeAttribute('data-ck-play');
    await Promise.resolve();
    expect(host.querySelectorAll('.ck-u')).toHaveLength(0);
    expect(heading?.textContent).toBe('Hello world');
    dispose();
    expect(host.hasAttribute('data-ck-still')).toBe(false);
  });

  it('types a typewriter sentence into an aria-hidden span while aria-label keeps all of it', () => {
    vi.useFakeTimers();
    try {
      const host = mount('<p data-ck-motion="typewriter" data-ck-trigger="load" data-ck-speed="fast">Hi there</p>');
      mountBehaviors(host);
      const line = host.querySelector('p');
      const typed = host.querySelector('.ck-tw');
      expect(line?.getAttribute('aria-label')).toBe('Hi there');
      expect(typed?.getAttribute('aria-hidden')).toBe('true');
      vi.advanceTimersByTime(2_000);
      expect(typed?.textContent).toBe('Hi there');
    } finally {
      vi.useRealTimers();
    }
  });

  it('rotates "a|b|c" words with every word kept for screen readers', () => {
    const host = mount('<h1>Sites that are <span data-ck-motion="word-rotate">fast|simple|secure</span></h1>');
    mountBehaviors(host);
    const words = Array.from(host.querySelectorAll('.ck-wr-word'));
    expect(words.map((word) => word.textContent)).toEqual(['fast', 'simple', 'secure']);
    expect(words[0]?.hasAttribute('data-ck-on')).toBe(true);
    expect(words.every((word) => word.getAttribute('aria-hidden') === 'true')).toBe(true);
    expect(host.querySelector('.ck-sr')?.textContent).toBe('fast, simple, secure');
  });

  it('rolls ticker digits in the page language, with the final value as the label', () => {
    const host = mount('<p lang="en"><span data-ck-behavior="ticker" data-ck-to="250">0 users</span></p>');
    mountBehaviors(host);
    const ticker = host.querySelector('[data-ck-behavior="ticker"]');
    expect(ticker?.getAttribute('aria-label')).toBe('250 users');
    const strips = Array.from(host.querySelectorAll<HTMLElement>('.ck-tick-strip'));
    expect(strips).toHaveLength(3);
    enterAll();
    expect(strips.map((strip) => strip.style.getPropertyValue('--ck-d'))).toEqual(['2', '5', '0']);
  });

  it('sets pathLength on every shape of a draw-line, and aria-hides a reading-progress bar', () => {
    const host = mount(
      '<svg data-ck-motion="draw-line"><path d="M0 0L10 10"></path><circle r="2"></circle></svg><div data-ck-motion="reading-progress"></div>',
    );
    mountBehaviors(host);
    expect(Array.from(host.querySelectorAll('path, circle'), (shape) => shape.getAttribute('pathLength'))).toEqual([
      '1',
      '1',
    ]);
    expect(host.querySelector('[data-ck-motion="reading-progress"]')?.getAttribute('aria-hidden')).toBe('true');
  });
});
