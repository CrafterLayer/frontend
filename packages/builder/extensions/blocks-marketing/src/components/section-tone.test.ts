import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { darkTheme, lightTheme, type Theme } from '@craftkit/builder-renderer';

import { TONE_CLASSES } from './section-classes';
import { sectionTones } from './section-options';
import {
  SLAB_CLASS,
  SLAB_CLASSES,
  contrastOf,
  hexToOklch,
  mixOklab,
  oklchToHex,
  slabColours,
  slabCss,
} from './section-tone';

/**
 * blocks-polish (2026-10-08): every tone, in the light AND the dark token
 * table, keeps its text legible and its slabs dark.
 *
 * The colours are computed by `slabColours`, the TypeScript twin of the CSS
 * `slabCss()` writes; the last block holds the stylesheet to that function
 * verbatim, so the numbers measured here are the numbers a browser paints.
 */

const AA = 4.5;
const THEMES: Readonly<Record<'light' | 'dark', Theme>> = { light: lightTheme, dark: darkTheme };

interface ToneColours {
  readonly ground: string;
  readonly ink: string;
  readonly muted: string;
  readonly accent: string;
}

/* What each tone paints: transparent and light sit on the page's surface; dark is a slab. */
function toneColours(theme: Theme, tone: (typeof sectionTones)[number]): ToneColours {
  if (tone === 'dark') return slabColours(theme);
  return { ground: theme.surface, ink: theme.text, muted: theme.textMuted, accent: theme.accent };
}

describe('tone contrast over the light and dark token tables', () => {
  const cases = Object.entries(THEMES).flatMap(([scheme, theme]) =>
    sectionTones.map((tone) => [scheme, tone, theme] as const),
  );

  it.each(cases)('%s theme, tone %s: text, muted text and accent text read at 4.5:1', (_scheme, tone, theme) => {
    const colours = toneColours(theme, tone);
    expect(contrastOf(colours.ink, colours.ground), 'ink').toBeGreaterThanOrEqual(AA);
    expect(contrastOf(colours.muted, colours.ground), 'muted').toBeGreaterThanOrEqual(AA);
    expect(contrastOf(colours.accent, colours.ground), 'accent').toBeGreaterThanOrEqual(AA);
  });

  it.each(Object.entries(THEMES))('%s theme: a slab stays dark', (_scheme, theme) => {
    const { ground, ink } = slabColours(theme);
    expect(hexToOklch(ground).l).toBeLessThanOrEqual(0.3);
    expect(hexToOklch(ink).l).toBeGreaterThanOrEqual(0.9);
  });

  it('measured the defects it fixes: the dark theme inverse is light, the raw accent on a slab is 2.82', () => {
    /* Before: a dark-tone section painted this near-white in dark mode. */
    expect(hexToOklch(darkTheme.surfaceInverse).l).toBeGreaterThan(0.9);
    /* Before: stat values, eyebrows and secondary actions on a slab. */
    expect(contrastOf(lightTheme.accent, lightTheme.surfaceInverse)).toBeLessThan(3);
  });

  it('leaves a ground that is already dark exactly as the design system set it', () => {
    const slab = slabColours(lightTheme);
    expect(slab.ground).toBe(lightTheme.surfaceInverse);
    expect(slab.ink).toBe(lightTheme.textInverse);
  });

  it('keeps the slab legible for any design system, light or dark inverse', () => {
    const systems = [
      { surfaceInverse: '#1e293b', textInverse: '#ffffff', accent: '#0ea5e9' },
      { surfaceInverse: '#ffffff', textInverse: '#000000', accent: '#be123c' },
      { surfaceInverse: '#fef3c7', textInverse: '#451a03', accent: '#b45309' },
      { surfaceInverse: '#052e16', textInverse: '#f0fdf4', accent: '#16a34a' },
    ];
    for (const system of systems) {
      const slab = slabColours(system);
      expect(contrastOf(slab.ink, slab.ground), JSON.stringify(system)).toBeGreaterThanOrEqual(AA);
      expect(contrastOf(slab.muted, slab.ground), JSON.stringify(system)).toBeGreaterThanOrEqual(AA);
      expect(contrastOf(slab.accent, slab.ground), JSON.stringify(system)).toBeGreaterThanOrEqual(AA);
    }
  });
});

describe('colour maths', () => {
  it.each(['#111827', '#f9fafb', '#4f46e5', '#818cf8', '#0b1120', '#ffffff', '#000000'])(
    'round-trips %s through OKLCH',
    (hex) => {
      expect(oklchToHex(hexToOklch(hex))).toBe(hex);
    },
  );

  it('mixes in OKLab like color-mix(in oklab)', () => {
    expect(mixOklab('#ffffff', '#000000', 1)).toBe('#ffffff');
    expect(mixOklab('#ffffff', '#000000', 0)).toBe('#000000');
    expect(hexToOklch(mixOklab('#ffffff', '#000000', 0.5)).l).toBeCloseTo(0.5, 2);
  });
});

describe('the slab in the stylesheet and the classes', () => {
  const css = readFileSync(join(import.meta.dirname, 'section-layout.css'), 'utf8');

  it('section-layout.css carries slabCss() verbatim, inside the marked block', () => {
    expect(css).toContain(slabCss());
    const start = css.indexOf('/* blocks-polish additions (2026-10-08) */');
    const end = css.indexOf('/* end blocks-polish additions */');
    expect(start).toBeGreaterThan(-1);
    expect(css.indexOf(slabCss())).toBeGreaterThan(start);
    expect(css.indexOf(slabCss())).toBeLessThan(end);
  });

  it('leaves a light card its own ink, whether the ink sits on the card or inside it', () => {
    /* A boxed table is `bg-surface text-text` on one element: before 2026-10-12 it took the slab's light ink. */
    expect(slabCss()).toContain(':is(.bg-surface, .bg-accent) :is(.text-text,');
    expect(slabCss()).toContain(':is(.bg-surface, .bg-accent):is(.text-text,');
  });

  it('derives every slab colour from a theme token, never a literal', () => {
    const block = slabCss();
    expect(block).not.toMatch(/#[0-9a-f]{3,8}\b/iu);
    expect(block).toContain('var(--t-surface-inverse)');
    expect(block).toContain('var(--t-text-inverse)');
    expect(block).toContain('var(--t-accent)');
  });

  it('applies the derived ground only while the inverse utility is still on the element', () => {
    /* A caller who repaints the block merges `bg-surface-inverse` away; the slab rule then stops matching. */
    for (const selector of slabCss().match(/^\s{2}\S[^{]*\{/gmu) ?? []) {
      if (selector.trim().startsWith(`.${SLAB_CLASS} {`)) continue;
      expect(selector).toMatch(/\.mkt-slab\.(?:bg-surface-inverse|border-surface-inverse)/u);
    }
  });

  it('marks the dark tone as a slab without dropping its inverse utilities', () => {
    expect(TONE_CLASSES.dark).toBe(SLAB_CLASSES);
    expect(TONE_CLASSES.dark.split(' ')).toEqual(
      expect.arrayContaining(['bg-surface-inverse', 'text-text-inverse', SLAB_CLASS]),
    );
  });

  it('marks every opaque inverse ground a block paints as a slab', () => {
    const root = import.meta.dirname;
    const files = [
      'AnnouncementBar/AnnouncementBar.tsx',
      'BentoGrid/BentoGrid.tsx',
      'ComparisonTable/ComparisonTable.tsx',
      'FormSection/FormSection.tsx',
      'Newsletter/Newsletter.tsx',
      'PromoBanner/PromoBanner.tsx',
      'Stats/Stats.tsx',
      'VideoSection/VideoSection.tsx',
    ];
    for (const file of files) {
      const lines = readFileSync(join(root, file), 'utf8').split('\n');
      const grounds = lines.filter(
        (line) => /bg-surface-inverse(?![/\w-])/u.test(line) && /['"`]/u.test(line),
      );
      expect(grounds.length, file).toBeGreaterThan(0);
      for (const line of grounds) expect(line, file).toContain(SLAB_CLASS);
    }
  });
});
