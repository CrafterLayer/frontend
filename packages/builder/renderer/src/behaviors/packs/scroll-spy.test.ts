import { gzipSync } from 'node:zlib';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pageBehaviorPacks } from '../script';
import { mountScrollSpy } from './scroll-spy';

/** jsdom lays nothing out: each section's top and the header's height are given here. */
function page(tops: Readonly<Record<string, number>>): HTMLElement {
  document.body.innerHTML = `<header style="position: sticky; top: 0">
    <nav data-ck-behavior="scroll-spy" aria-label="Sections">
      <a href="#services">Services</a><a href="#prices">Prices</a><a href="#missing">Gone</a><a href="/about">About</a>
    </nav>
    <nav id="sheet" popover data-ck-behavior="scroll-spy"><a href="#prices">Prices</a></nav>
  </header>
  <section id="services">S</section><section id="prices">P</section>`;
  const header = document.querySelector('header')!;
  vi.spyOn(header, 'getBoundingClientRect').mockReturnValue({ height: 64, top: 0 } as DOMRect);
  for (const [id, top] of Object.entries(tops)) {
    const section = document.getElementById(id)!;
    vi.spyOn(section, 'getBoundingClientRect').mockReturnValue({ top, height: 600 } as DOMRect);
  }
  return document.querySelector('nav')!;
}

function moveTo(tops: Readonly<Record<string, number>>): void {
  for (const [id, top] of Object.entries(tops)) {
    const section = document.getElementById(id)!;
    vi.spyOn(section, 'getBoundingClientRect').mockReturnValue({ top, height: 600 } as DOMRect);
  }
  window.dispatchEvent(new Event('scroll'));
  vi.runAllTimers();
}

const current = (nav: Element) =>
  Array.from(nav.querySelectorAll('a[aria-current]')).map((link) => link.textContent);

function reduceMotion(matches: boolean): void {
  vi.stubGlobal('matchMedia', () => ({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
  reduceMotion(false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('style');
  document.documentElement.className = '';
});

describe('mountScrollSpy', () => {
  it('marks the link of the section the reader is in, below the sticky header', () => {
    const nav = page({ services: 900, prices: 1600 });
    const dispose = mountScrollSpy(document);
    expect(current(nav)).toEqual([]);
    expect(document.documentElement.style.scrollPaddingTop).toBe('72px');
    moveTo({ services: 200, prices: 900 });
    expect(current(nav)).toEqual(['Services']);
    moveTo({ services: -500, prices: 250 });
    expect(current(nav)).toEqual(['Prices']);
    expect(nav.querySelector('a[href="/about"]')?.hasAttribute('aria-current')).toBe(false);
    dispose();
    expect(current(nav)).toEqual([]);
    expect(document.documentElement.style.scrollPaddingTop).toBe('');
  });

  it('marks the last link at the very bottom of the page', () => {
    const nav = page({ services: 100, prices: 700 });
    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(
      window.innerHeight + 500,
    );
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(500);
    const dispose = mountScrollSpy(document);
    expect(current(nav)).toEqual(['Prices']);
    dispose();
  });

  it('turns on smooth scrolling for a tracked link and closes its popover sheet', () => {
    const nav = page({ services: 900, prices: 1600 });
    const sheet = document.getElementById('sheet') as HTMLElement & { hidePopover: () => void };
    const hide = vi.fn();
    sheet.hidePopover = hide;
    const dispose = mountScrollSpy(document);
    const away = nav.querySelector<HTMLAnchorElement>('a[href="/about"]')!;
    away.addEventListener('click', (event) => {
      event.preventDefault();
    });
    away.click();
    expect(document.documentElement.style.scrollBehavior).toBe('');
    (sheet.querySelector('a') as HTMLElement).click();
    expect(document.documentElement.style.scrollBehavior).toBe('smooth');
    expect(hide).toHaveBeenCalledOnce();
    dispose();
    expect(document.documentElement.style.scrollBehavior).toBe('');
  });

  it('leaves the jump instant under reduced motion and under Lenis', () => {
    reduceMotion(true);
    const nav = page({ services: 900, prices: 1600 });
    const dispose = mountScrollSpy(document);
    (nav.querySelector('a') as HTMLElement).click();
    expect(document.documentElement.style.scrollBehavior).toBe('');
    dispose();
    reduceMotion(false);
    document.documentElement.classList.add('lenis');
    const again = mountScrollSpy(document);
    (nav.querySelector('a') as HTMLElement).click();
    expect(document.documentElement.style.scrollBehavior).toBe('');
    again();
  });

  it('does nothing on the editing canvas', () => {
    const nav = page({ services: 0, prices: 600 });
    const dispose = mountScrollSpy(document, { interactive: false });
    expect(current(nav)).toEqual([]);
    expect(document.documentElement.style.scrollPaddingTop).toBe('');
    dispose();
  });

  it('is idempotent and keeps a page style someone else rewrote', () => {
    const nav = page({ services: 200, prices: 900 });
    const dispose = mountScrollSpy(document);
    mountScrollSpy(nav)();
    expect(current(nav)).toEqual(['Services']);
    document.documentElement.style.scrollPaddingTop = '10px';
    dispose();
    dispose();
    expect(document.documentElement.style.scrollPaddingTop).toBe('10px');
    moveTo({ services: -500, prices: 250 });
    expect(current(nav)).toEqual([]);
  });

  it('ships only to a page that names it, within 1.85 kB gzip', () => {
    expect(pageBehaviorPacks('<nav data-ck-behavior="scroll-spy">')).toContain(mountScrollSpy);
    expect(pageBehaviorPacks('<nav><a href="#a">A</a></nav>')).not.toContain(mountScrollSpy);
    expect(gzipSync(mountScrollSpy.toString()).length).toBeLessThanOrEqual(1890);
  });
});
