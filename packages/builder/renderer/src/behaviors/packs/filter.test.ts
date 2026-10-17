import { gzipSync } from 'node:zlib';

import { afterEach, describe, expect, it } from 'vitest';

import { pageBehaviorPacks } from '../script';
import { mountFilter } from './filter';

function host(pressed = ''): HTMLElement {
  document.body.innerHTML = `<div data-ck-behavior="filter">
    <div role="group" aria-label="Show">
      <button type="button" data-ck-filter="all">All</button>
      <button type="button" data-ck-filter="web" ${pressed}>Web</button>
      <button type="button" data-ck-filter="print">Print</button>
    </div>
    <ul>
      <li id="a" data-ck-filter="web">A</li>
      <li id="b" data-ck-filter="print">B</li>
      <li id="c" data-ck-filter="web print">C</li>
      <li id="d">No group</li>
    </ul>
  </div>`;
  return document.body.firstElementChild as HTMLElement;
}

const button = (name: string) =>
  document.querySelector<HTMLButtonElement>(`button[data-ck-filter='${name}']`)!;
const shown = () =>
  Array.from(document.querySelectorAll('li[data-ck-filter]'))
    .filter((item) => !item.hasAttribute('hidden'))
    .map((item) => item.id);

afterEach(() => {
  document.body.innerHTML = '';
});

describe('mountFilter', () => {
  it('starts on the first button, then shows only the pressed group', () => {
    host();
    const dispose = mountFilter(document);
    expect(button('all').getAttribute('aria-pressed')).toBe('true');
    expect(button('web').getAttribute('aria-pressed')).toBe('false');
    expect(shown()).toEqual(['a', 'b', 'c']);
    button('print').click();
    expect(shown()).toEqual(['b', 'c']);
    expect(button('print').getAttribute('aria-pressed')).toBe('true');
    expect(button('all').getAttribute('aria-pressed')).toBe('false');
    button('web').click();
    expect(shown()).toEqual(['a', 'c']);
    button('all').click();
    expect(shown()).toEqual(['a', 'b', 'c']);
    expect(document.getElementById('d')?.hasAttribute('hidden')).toBe(false);
    dispose();
  });

  it('starts on the button the markup marks pressed', () => {
    host('aria-pressed="true"');
    const dispose = mountFilter(document);
    expect(shown()).toEqual(['a', 'c']);
    dispose();
  });

  it('does nothing on the editing canvas', () => {
    const el = host();
    const before = el.outerHTML;
    const dispose = mountFilter(document, { interactive: false });
    button('print').click();
    expect(el.outerHTML).toBe(before);
    dispose();
  });

  it('is idempotent and restores every attribute on dispose', () => {
    const el = host();
    const before = el.outerHTML;
    const dispose = mountFilter(document);
    mountFilter(el)();
    button('print').click();
    dispose();
    dispose();
    expect(el.outerHTML).toBe(before);
    button('web').click();
    expect(shown()).toEqual(['a', 'b', 'c']);
  });

  it('ships only to a page that names it, within 1.25 kB gzip', () => {
    expect(pageBehaviorPacks('<div data-ck-behavior="filter">')).toContain(mountFilter);
    expect(pageBehaviorPacks('<div data-ck-behavior="filters">')).not.toContain(mountFilter);
    expect(gzipSync(mountFilter.toString()).length).toBeLessThanOrEqual(1280);
  });
});
