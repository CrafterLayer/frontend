import { gzipSync } from 'node:zlib';

import { afterEach, describe, expect, it } from 'vitest';

import { mountCompare } from './compare';
import { WIDGETS_PACK_CSS } from './widgets-css';

const PAIR =
  '<img src="https://example.com/before.jpg" alt="before"><img src="https://example.com/after.jpg" alt="after">';

function host(html: string, attrs = ''): HTMLElement {
  document.body.innerHTML = `<div data-ck-behavior="compare" ${attrs}>${html}</div>`;
  return document.body.firstElementChild as HTMLElement;
}

function rangeOf(el: Element): HTMLInputElement | null {
  return el.querySelector('input[data-ck-compare-range]');
}

afterEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  document.documentElement.removeAttribute('dir');
  document.documentElement.removeAttribute('lang');
});

describe('mountCompare', () => {
  it('appends a 0–100 range at 50, writes --ck-compare, and follows the input', () => {
    const el = host(PAIR);
    const dispose = mountCompare(document);
    const range = rangeOf(el);
    expect(range).not.toBeNull();
    expect(range?.type).toBe('range');
    expect([range?.min, range?.max, range?.value]).toEqual(['0', '100', '50']);
    expect(range?.getAttribute('aria-label')).toBe('Before / after');
    expect(range?.getAttribute('aria-valuetext')).toBe('50%');
    expect(el.style.getPropertyValue('--ck-compare')).toBe('50%');
    expect(el.hasAttribute('data-ck-mounted')).toBe(true);
    range!.value = '30';
    range!.dispatchEvent(new Event('input'));
    expect(el.style.getPropertyValue('--ck-compare')).toBe('30%');
    expect(range?.getAttribute('aria-valuetext')).toBe('30%');
    dispose();
  });

  it('disposes completely: control, custom property and marker', () => {
    const el = host(PAIR, 'style="--ck-compare: 20%"');
    const dispose = mountCompare(el);
    expect(el.style.getPropertyValue('--ck-compare')).toBe('50%');
    dispose();
    dispose();
    expect(rangeOf(el)).toBeNull();
    expect(el.style.getPropertyValue('--ck-compare')).toBe('20%');
    expect(el.hasAttribute('data-ck-mounted')).toBe(false);
    expect(el.children).toHaveLength(2);
  });

  it('is idempotent, and mounts again after dispose', () => {
    const el = host(PAIR);
    const first = mountCompare(document);
    const second = mountCompare(document);
    expect(el.querySelectorAll('[data-ck-compare-range]')).toHaveLength(1);
    second();
    expect(rangeOf(el)).not.toBeNull();
    first();
    expect(rangeOf(el)).toBeNull();
    const third = mountCompare(document);
    expect(rangeOf(el)).not.toBeNull();
    third();
  });

  it('is a no-op without exactly two images', () => {
    const one = host('<img src="https://example.com/a.jpg" alt="">');
    mountCompare(document);
    expect(rangeOf(one)).toBeNull();
    expect(one.hasAttribute('data-ck-mounted')).toBe(false);
    const three = host(`${PAIR}<img src="https://example.com/c.jpg" alt="">`);
    mountCompare(document);
    expect(rangeOf(three)).toBeNull();
  });

  it('labels in Arabic with Arabic-Indic digits on an Arabic page', () => {
    document.documentElement.setAttribute('lang', 'ar');
    const el = host(PAIR);
    const dispose = mountCompare(document);
    const range = rangeOf(el);
    expect(range?.getAttribute('aria-label')).toBe('قبل / بعد');
    expect(range?.getAttribute('aria-valuetext')).toContain('٥٠');
    dispose();
  });

  it('is drawn at 50% and inert on the canvas', () => {
    const el = host(PAIR);
    const dispose = mountCompare(document, { interactive: false });
    const range = rangeOf(el)!;
    expect(range.tabIndex).toBe(-1);
    expect(range.style.pointerEvents).toBe('none');
    range.value = '10';
    range.dispatchEvent(new Event('input'));
    expect(el.style.getPropertyValue('--ck-compare')).toBe('50%');
    dispose();
  });

  it('clips the after image from the inline start: left under LTR, right under RTL', () => {
    const style = document.createElement('style');
    style.textContent = WIDGETS_PACK_CSS;
    document.head.appendChild(style);
    document.body.innerHTML = `
      <div dir="ltr"><div data-ck-behavior="compare">${PAIR}</div></div>
      <div dir="rtl"><div data-ck-behavior="compare">${PAIR}</div>
        <div dir="ltr"><div data-ck-behavior="compare">${PAIR}</div></div></div>`;
    const dispose = mountCompare(document);
    const [ltr, rtl, nested] = Array.from(document.querySelectorAll("[data-ck-behavior='compare']"));
    const clip = (el: Element | undefined) =>
      getComputedStyle(el!.querySelectorAll('img')[1]!).getPropertyValue('clip-path');
    expect(clip(ltr)).toBe('inset(0 0 0 var(--ck-compare))');
    expect(clip(rtl)).toBe('inset(0 var(--ck-compare) 0 0)');
    expect(clip(nested)).toBe('inset(0 0 0 var(--ck-compare))');
    // The before image is never clipped.
    expect(getComputedStyle(rtl!.querySelector('img')!).getPropertyValue('clip-path')).not.toContain('inset');
    dispose();
  });

  it('serialises: evaluated alone in a fresh document, it mounts', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const fresh = frame.contentDocument!;
    fresh.documentElement.setAttribute('lang', 'ar');
    fresh.body.innerHTML = `<div data-ck-behavior="compare">${PAIR}</div>`;
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- evaluating the serialised pack IS the test
    new Function('document', `(${mountCompare.toString()})(document);`)(fresh);
    const range = fresh.querySelector('input[data-ck-compare-range]');
    expect(range?.getAttribute('aria-label')).toBe('قبل / بعد');
    frame.remove();
  });

  it('weighs at most 2 kB gzip serialised', () => {
    expect(gzipSync(mountCompare.toString()).length).toBeLessThanOrEqual(2048);
  });
});
