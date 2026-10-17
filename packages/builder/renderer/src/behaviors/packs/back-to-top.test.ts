import { gzipSync } from 'node:zlib';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pageBehaviorPacks } from '../script';
import { mountBackToTop } from './back-to-top';

function host(href = '#top'): HTMLAnchorElement {
  document.body.innerHTML = `<main><h1>Roastery</h1><p>Long page</p><a href="${href}" data-ck-behavior="back-to-top" aria-label="Back to top">↑</a></main>`;
  return document.querySelector('a')!;
}

function scrollTo(y: number): void {
  vi.spyOn(window, 'scrollY', 'get').mockReturnValue(y);
  window.dispatchEvent(new Event('scroll'));
}

function reduceMotion(matches: boolean): void {
  vi.stubGlobal('matchMedia', () => ({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

let scroll: ReturnType<typeof vi.fn>;

beforeEach(() => {
  scroll = vi.fn();
  vi.stubGlobal('scrollTo', scroll);
  reduceMotion(false);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('mountBackToTop', () => {
  it('stays out of sight (and out of the tab order) until the reader is a screen down', () => {
    const link = host();
    const dispose = mountBackToTop(document);
    expect(link.style.visibility).toBe('hidden');
    expect(link.style.opacity).toBe('0');
    expect(link.style.transition).toBe('');
    scrollTo(window.innerHeight + 1);
    expect(link.style.transition).toContain('opacity');
    expect(link.style.visibility).toBe('');
    expect(link.style.opacity).toBe('');
    scrollTo(0);
    expect(link.style.visibility).toBe('hidden');
    dispose();
  });

  it('scrolls smoothly to the top and moves focus to the first heading', () => {
    const link = host();
    const dispose = mountBackToTop(document);
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(scroll).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    const heading = document.querySelector('h1');
    expect(document.activeElement).toBe(heading);
    expect(heading?.getAttribute('tabindex')).toBe('-1');
    link.focus();
    expect(heading?.hasAttribute('tabindex')).toBe(false);
    dispose();
  });

  it('focuses the href target when it exists', () => {
    const link = host('#start');
    const start = document.createElement('div');
    start.id = 'start';
    document.body.prepend(start);
    const dispose = mountBackToTop(document);
    link.click();
    expect(document.activeElement).toBe(start);
    dispose();
  });

  it('jumps without smoothing or fading under reduced motion', () => {
    reduceMotion(true);
    const link = host();
    const dispose = mountBackToTop(document);
    scrollTo(window.innerHeight + 1);
    expect(link.style.transition).toBe('');
    link.click();
    expect(scroll).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
    dispose();
  });

  it('does nothing on the editing canvas', () => {
    const link = host();
    const dispose = mountBackToTop(document, { interactive: false });
    expect(link.style.visibility).toBe('');
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(click);
    expect(scroll).not.toHaveBeenCalled();
    dispose();
  });

  it('is idempotent and disposes completely', () => {
    const link = host();
    const first = mountBackToTop(document);
    const second = mountBackToTop(link);
    second();
    expect(link.style.visibility).toBe('hidden');
    first();
    first();
    expect(link.getAttribute('style') ?? '').toBe('');
    link.click();
    expect(scroll).not.toHaveBeenCalled();
    const again = mountBackToTop(document);
    expect(link.style.visibility).toBe('hidden');
    again();
  });

  it('ships only to a page that names it, within 1.25 kB gzip', () => {
    expect(pageBehaviorPacks("<a data-ck-behavior='back-to-top' href='#top'>")).toContain(
      mountBackToTop,
    );
    expect(pageBehaviorPacks('<a href="#top">')).not.toContain(mountBackToTop);
    expect(gzipSync(mountBackToTop.toString()).length).toBeLessThanOrEqual(1280);
  });
});
