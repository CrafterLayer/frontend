import { gzipSync } from 'node:zlib';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { pageBehaviorPacks } from '../script';
import { mountDismiss } from './dismiss';

function host(text = 'Free delivery this week'): HTMLElement {
  document.body.innerHTML = `<div data-ck-behavior="dismiss" role="region" aria-label="Announcement"><p>${text}</p><a href="/offer">See the offer</a><button type="button" aria-label="Close" hidden>×</button></div><main><h1>Shop</h1></main>`;
  return document.body.firstElementChild as HTMLElement;
}

const closeOf = (el: Element) => el.querySelector('button')!;

afterEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('mountDismiss', () => {
  it('reveals the close button; a press hides the notice and remembers it', () => {
    const el = host();
    const dispose = mountDismiss(document);
    expect(closeOf(el).hidden).toBe(false);
    closeOf(el).focus();
    closeOf(el).click();
    expect(el.hidden).toBe(true);
    expect(Object.values(localStorage)).toEqual(['1']);
    expect(Object.keys(localStorage)[0]).toMatch(/^ck-dismiss:[0-9a-z]+$/u);
    const main = document.querySelector('main');
    expect(document.activeElement).toBe(main);
    expect(main?.getAttribute('tabindex')).toBe('-1');
    dispose();
  });

  it('stays closed on the next visit, and a changed notice shows again', () => {
    const el = host();
    mountDismiss(document);
    closeOf(el).click();
    const next = host();
    const dispose = mountDismiss(document);
    expect(next.hidden).toBe(true);
    dispose();
    const changed = host('Closed on Friday');
    const again = mountDismiss(document);
    expect(changed.hidden).toBe(false);
    again();
  });

  it('closes for this visit when storage is refused', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const el = host();
    const dispose = mountDismiss(document);
    closeOf(el).click();
    expect(el.hidden).toBe(true);
    dispose();
  });

  it('shows the button on the canvas and never hides the notice', () => {
    const el = host();
    localStorage.setItem('ck-dismiss:anything', '1');
    const dispose = mountDismiss(document, { interactive: false });
    expect(closeOf(el).hidden).toBe(false);
    closeOf(el).click();
    expect(el.hidden).toBe(false);
    dispose();
    expect(closeOf(el).hidden).toBe(true);
  });

  it('is idempotent and restores the markup on dispose', () => {
    const el = host();
    const before = el.outerHTML;
    const dispose = mountDismiss(document);
    mountDismiss(el)();
    dispose();
    dispose();
    expect(el.outerHTML).toBe(before);
    closeOf(el).click();
    expect(el.hidden).toBe(false);
  });

  it('ships only to a page that names it, within 1.3 kB gzip', () => {
    expect(pageBehaviorPacks("<div data-ck-behavior='dismiss'>")).toContain(mountDismiss);
    expect(pageBehaviorPacks('<button popovertargetaction="hide">')).not.toContain(mountDismiss);
    expect(gzipSync(mountDismiss.toString()).length).toBeLessThanOrEqual(1330);
  });
});
