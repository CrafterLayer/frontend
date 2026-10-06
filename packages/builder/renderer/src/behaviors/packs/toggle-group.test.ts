import { gzipSync } from 'node:zlib';

import { afterEach, describe, expect, it } from 'vitest';

import { declarationsOf } from '../../motion/css-test-utils';
import { mountToggleGroup } from './toggle-group';
import { WIDGETS_PACK_CSS } from './widgets-css';

const OPTIONS =
  '<p data-ck-option="a">10</p><p data-ck-option="b" hidden>100</p><span data-ck-option="a">/mo</span><span data-ck-option="b" hidden>/yr</span>';

function group(inner: string, attrs = ''): HTMLElement {
  document.body.innerHTML = `<div data-ck-behavior="toggle-group" ${attrs}>${inner}</div>`;
  return document.body.firstElementChild as HTMLElement;
}

function hiddenOf(el: Element, option: 'a' | 'b'): boolean[] {
  return Array.from(el.querySelectorAll(`[data-ck-option='${option}']`)).map((node) =>
    node.hasAttribute('hidden'),
  );
}

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('lang');
});

describe('mountToggleGroup', () => {
  it('adopts the first button as a switch and flips hidden between a and b', () => {
    const el = group(`<button></button>${OPTIONS}`);
    const dispose = mountToggleGroup(document);
    const button = el.querySelector('button')!;
    expect(button.getAttribute('role')).toBe('switch');
    expect(button.getAttribute('aria-checked')).toBe('false');
    expect(button.getAttribute('aria-label')).toBe('Monthly / Yearly');
    expect(button.hasAttribute('data-ck-switch')).toBe(true);
    expect(hiddenOf(el, 'a')).toEqual([false, false]);
    expect(hiddenOf(el, 'b')).toEqual([true, true]);
    button.click();
    expect(button.getAttribute('aria-checked')).toBe('true');
    expect(hiddenOf(el, 'a')).toEqual([true, true]);
    expect(hiddenOf(el, 'b')).toEqual([false, false]);
    button.click();
    expect(hiddenOf(el, 'a')).toEqual([false, false]);
    dispose();
  });

  it('keeps a button that has its own text unlabelled, and skips buttons inside an option', () => {
    const el = group(`<div data-ck-option="a"><button>Buy</button></div>${OPTIONS}<button>Monthly</button>`);
    const dispose = mountToggleGroup(document);
    const buttons = el.querySelectorAll('button');
    expect(buttons[0]?.hasAttribute('role')).toBe(false);
    expect(buttons[1]?.getAttribute('role')).toBe('switch');
    expect(buttons[1]?.hasAttribute('aria-label')).toBe(false);
    dispose();
  });

  it('restores every attribute on dispose, hidden included', () => {
    const el = group(`<button></button>${OPTIONS}`);
    const dispose = mountToggleGroup(el);
    el.querySelector('button')!.click();
    dispose();
    const button = el.querySelector('button')!;
    expect(['role', 'aria-checked', 'aria-label', 'data-ck-switch'].map((name) => button.hasAttribute(name))).toEqual([
      false,
      false,
      false,
      false,
    ]);
    expect(hiddenOf(el, 'a')).toEqual([false, false]);
    expect(hiddenOf(el, 'b')).toEqual([true, true]);
    expect(el.hasAttribute('data-ck-mounted')).toBe(false);
    button.click();
    expect(hiddenOf(el, 'b')).toEqual([true, true]);
  });

  it('inserts an Arabic switch when there is no button, and removes it on dispose', () => {
    const el = group(OPTIONS, 'lang="ar"');
    const dispose = mountToggleGroup(document);
    const button = el.firstElementChild as HTMLButtonElement;
    expect(button.tagName).toBe('BUTTON');
    expect(button.textContent).toBe('شهري / سنوي');
    expect(button.getAttribute('role')).toBe('switch');
    dispose();
    expect(el.querySelector('button')).toBeNull();
  });

  it('is idempotent', () => {
    const el = group(OPTIONS);
    const first = mountToggleGroup(document);
    const second = mountToggleGroup(document);
    expect(el.querySelectorAll('button')).toHaveLength(1);
    el.querySelector('button')!.click();
    // One listener: a double mount would flip twice and land back on a.
    expect(hiddenOf(el, 'b')).toEqual([false, false]);
    second();
    first();
    expect(el.querySelector('button')).toBeNull();
  });

  it('shows a and is inert on the canvas', () => {
    const el = group(OPTIONS);
    const dispose = mountToggleGroup(document, { interactive: false });
    const button = el.querySelector('button')!;
    expect(button.tabIndex).toBe(-1);
    expect(button.style.pointerEvents).toBe('none');
    button.click();
    expect(button.getAttribute('aria-checked')).toBe('false');
    expect(hiddenOf(el, 'a')).toEqual([false, false]);
    expect(hiddenOf(el, 'b')).toEqual([true, true]);
    dispose();
  });

  it('is a no-op without both option sets', () => {
    const el = group('<button></button><p data-ck-option="a">10</p>');
    mountToggleGroup(document);
    expect(el.querySelector('button')?.hasAttribute('role')).toBe(false);
    expect(el.hasAttribute('data-ck-mounted')).toBe(false);
  });

  it('moves the knob by the inline start, so it mirrors under RTL, with no physical side anywhere', () => {
    const declarations = declarationsOf(WIDGETS_PACK_CSS);
    const knob = declarations.filter((item) => item.selector === "[data-ck-switch][aria-checked='true']::after");
    expect(knob.map((item) => item.property)).toEqual(['inset-inline-start']);
    const resting = declarations.find(
      (item) => item.selector === '[data-ck-switch]::after' && item.property === 'inset-inline-start',
    );
    expect(resting?.value).toBe('0.1875rem');
    const physical = declarations.filter((item) =>
      /^(?:left|right|margin-(?:left|right)|padding-(?:left|right)|border-(?:left|right)|width|height)$/u.test(
        item.property,
      ),
    );
    expect(physical).toEqual([]);
    // Every colour is a builder token.
    for (const item of declarations) {
      if (/^(?:background|color|border-color)$/u.test(item.property) && item.value !== 'transparent' && item.value !== 'none') {
        expect(item.value).toMatch(/^var\(--bldr-/u);
      }
    }
  });

  it('serialises: evaluated alone in a fresh document, it mounts', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const fresh = frame.contentDocument!;
    fresh.body.innerHTML = `<div data-ck-behavior="toggle-group" lang="ar">${OPTIONS}</div>`;
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- evaluating the serialised pack IS the test
    new Function('document', `(${mountToggleGroup.toString()})(document);`)(fresh);
    const button = fresh.querySelector('button')!;
    expect(button.getAttribute('role')).toBe('switch');
    button.click();
    expect(fresh.querySelector("[data-ck-option='b']")?.hasAttribute('hidden')).toBe(false);
    frame.remove();
  });

  it('weighs at most 2 kB gzip serialised', () => {
    expect(gzipSync(mountToggleGroup.toString()).length).toBeLessThanOrEqual(2048);
  });
});
