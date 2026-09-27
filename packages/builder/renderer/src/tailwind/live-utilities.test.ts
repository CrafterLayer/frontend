import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

import {
  createLiveUtilities as createWithTheme,
  type LiveUtilitiesOptions,
} from './live-utilities';

// The host supplies Tailwind's theme text; a Vite app imports it with `?raw`, the tests read the file.
const tailwindThemeCss = readFileSync(
  createRequire(import.meta.url).resolve('tailwindcss/theme.css'),
  'utf8',
);

function createLiveUtilities(options: Partial<LiveUtilitiesOptions> = {}) {
  return createWithTheme({ tailwindThemeCss, ...options });
}

/*
  Every class below was either refused by the static vocabulary or silently
  stripped on 2026-09-27 — ordinary Tailwind a section plan was sent back for.
*/
describe('live utilities', () => {
  it('judges class names by what Tailwind actually generates', async () => {
    const live = await createLiveUtilities();

    for (const name of [
      'md:flex-row',
      'backdrop-blur',
      'border-emerald-900/20',
      'min-h-[80vh]',
      'group-hover:text-white',
      'bg-accent',
    ]) {
      expect(live.isUtilityClass(name), name).toBe(true);
    }
    expect(live.isUtilityClass('totally-made-up')).toBe(false);
    expect(live.isUtilityClass('ck-hero-glow')).toBe(false);
    expect(live.isUtilityClass('')).toBe(false);
  });

  it('admits the group and peer markers that generate no CSS of their own', async () => {
    const live = await createLiveUtilities();

    expect(live.isUtilityClass('group')).toBe(true);
    expect(live.isUtilityClass('peer/card')).toBe(true);
    expect(live.isUtilityClass('group-x')).toBe(false);
  });

  it('writes CSS for exactly the classes asked for into the document', async () => {
    const live = await createLiveUtilities({ document });

    live.ensure(['md:flex-row', 'totally-made-up', 'group']);

    const sheets = document.head.querySelectorAll('style[data-ck-live-utilities]');
    expect(sheets).toHaveLength(1);
    const css = sheets[0]?.textContent ?? '';
    expect(css).toContain('.md\\:flex-row');
    expect(css).not.toContain('totally-made-up');
    live.dispose();
    expect(document.head.querySelectorAll('style[data-ck-live-utilities]')).toHaveLength(0);
  });

  it('replaces the sheet node on growth so the canvas iframe mirrors the new one', async () => {
    const live = await createLiveUtilities({ document });

    live.ensure(['p-[17px]']);
    const first = document.head.querySelector('style[data-ck-live-utilities]');
    live.ensure(['p-[17px]']);
    expect(document.head.querySelector('style[data-ck-live-utilities]')).toBe(first);

    live.ensure(['bg-emerald-900/20']);
    const second = document.head.querySelectorAll('style[data-ck-live-utilities]');
    expect(second).toHaveLength(1);
    expect(second[0]).not.toBe(first);
    expect(live.css()).toContain('.p-\\[17px\\]');
    expect(live.css()).toContain('.bg-emerald-900\\/20');
    live.dispose();
  });

  it('resolves design-system utilities through the site tokens', async () => {
    const live = await createLiveUtilities();

    live.ensure(['bg-accent']);

    expect(live.css()).toContain('var(--t-accent');
  });
});

describe('live utilities without a real theme', () => {
  it('refuses to start rather than judge every breakpoint class unknown', async () => {
    await expect(createWithTheme({ tailwindThemeCss: '' })).rejects.toThrow(/no breakpoints/u);
  });
});
