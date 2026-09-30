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
