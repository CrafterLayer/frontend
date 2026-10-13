import { gzipSync } from 'node:zlib';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { pageBehaviorPacks } from '../script';
import { mountReadMore } from './read-more';

/** jsdom lays nothing out: the text's height and line height are given here. */
function host(height: number, attrs = 'data-ck-text="Show less"'): HTMLElement {
  document.body.innerHTML = `<div data-ck-behavior="read-more" ${attrs}><div style="line-height: 24px;">Long story.</div><button type="button" hidden>Read more<span aria-hidden="true">+</span></button></div>`;
  const el = document.body.firstElementChild as HTMLElement;
  Object.defineProperty(el.firstElementChild, 'scrollHeight', {
    configurable: true,
    value: height,
  });
  return el;
}

const textOf = (el: Element) => el.firstElementChild as HTMLElement;
const buttonOf = (el: Element) => el.querySelector('button')!;

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('mountReadMore', () => {
  it('clamps a long text to four lines and reveals a button that opens it', () => {
    const el = host(400);
    const dispose = mountReadMore(document);
    const text = textOf(el);
    const button = buttonOf(el);
    expect(text.style.maxHeight).toBe('96px');
    expect(text.style.overflow).toBe('hidden');
    expect(text.style.getPropertyValue('mask-image')).toContain('linear-gradient');
    expect(button.hidden).toBe(false);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-controls')).toBe(text.id);
    expect(text.id).toMatch(/^ck-more-/u);
    button.click();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(text.style.maxHeight).toBe('');
    expect(text.style.getPropertyValue('mask-image')).toBe('');
    expect(button.textContent).toBe('Show less+');
    button.click();
    expect(text.style.maxHeight).toBe('96px');
    expect(button.textContent).toBe('Read more+');
    dispose();
  });

  it('reads the clamp from --ck-lines on the text', () => {
    const el = host(400);
    textOf(el).style.setProperty('--ck-lines', '2');
    const dispose = mountReadMore(document);
    expect(textOf(el).style.maxHeight).toBe('48px');
    dispose();
  });

  it('keeps the button hidden when the text already fits', () => {
    const el = host(100);
    const dispose = mountReadMore(document);
    expect(buttonOf(el).hidden).toBe(true);
    expect(textOf(el).style.maxHeight).toBe('');
    dispose();
  });

  it('keeps its label without data-ck-text', () => {
    const el = host(400, '');
    const dispose = mountReadMore(document);
    buttonOf(el).click();
    expect(buttonOf(el).textContent).toBe('Read more+');
    dispose();
  });

  it('shows the button on the canvas and leaves the text whole', () => {
    const el = host(400);
    const dispose = mountReadMore(document, { interactive: false });
    expect(buttonOf(el).hidden).toBe(false);
    expect(textOf(el).style.maxHeight).toBe('');
    buttonOf(el).click();
    expect(buttonOf(el).hasAttribute('aria-expanded')).toBe(false);
    dispose();
    expect(buttonOf(el).hidden).toBe(true);
  });

  it('brings the start back into view when it closes above the screen', () => {
    const el = host(400);
    const into = vi.fn();
    el.scrollIntoView = into;
    const dispose = mountReadMore(document);
    buttonOf(el).click();
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ top: -300 } as DOMRect);
    buttonOf(el).click();
    expect(into).toHaveBeenCalledWith({ block: 'nearest' });
    dispose();
  });

  it('is idempotent and restores everything on dispose', () => {
    const el = host(400);
    const before = el.outerHTML;
    const dispose = mountReadMore(document);
    mountReadMore(el)();
    buttonOf(el).click();
    dispose();
    dispose();
    expect(el.outerHTML).toBe(before);
    buttonOf(el).click();
    expect(buttonOf(el).hasAttribute('aria-expanded')).toBe(false);
  });

  it('ships only to a page that names it, within 1.6 kB gzip', () => {
    expect(pageBehaviorPacks('<div data-ck-behavior="read-more">')).toContain(mountReadMore);
    expect(pageBehaviorPacks('<details><summary>More</summary></details>')).not.toContain(
      mountReadMore,
    );
    expect(gzipSync(mountReadMore.toString()).length).toBeLessThanOrEqual(1640);
  });
});
