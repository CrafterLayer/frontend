import { describe, expect, it } from 'vitest';

import { findRejectedUtilities } from '../blocks/utility-classes';
import {
  CUSTOM_CLASS_PREFIX,
  UTILITY_VOCABULARY,
  expandUtilityPattern,
  unknownUtilityClasses,
  utilitySourceDirectives,
  utilityVocabulary,
} from './utility-vocabulary';

describe('utility pattern expansion', () => {
  it('expands alternates, ranges, and whitespace exactly as Tailwind reads them', () => {
    expect(expandUtilityPattern('p-{0..2}')).toEqual(['p-0', 'p-1', 'p-2']);
    expect(expandUtilityPattern('{bg,text}-accent')).toEqual(['bg-accent', 'text-accent']);
    expect(expandUtilityPattern('flex mx-auto')).toEqual(['flex', 'mx-auto']);
  });

  it('expands the empty alternate, which is how optional prefixes are written', () => {
    expect(expandUtilityPattern('{sm:,}flex')).toEqual(['sm:flex', 'flex']);
  });

  it('expands nested groups combinatorially', () => {
    expect(expandUtilityPattern('{a,b}-{1,2}')).toEqual(['a-1', 'a-2', 'b-1', 'b-2']);
  });

  it('leaves a pattern with no groups untouched', () => {
    expect(expandUtilityPattern('truncate')).toEqual(['truncate']);
  });
});

describe('the vocabulary', () => {
  it('is large enough to express a real design', () => {
    // A vocabulary too narrow costs the free-composition feature its purpose.
    expect(utilityVocabulary().size).toBeGreaterThan(1_500);
  });

  it('admits the utilities a generated page actually needs', () => {
    const needed = [
      'min-h-screen',
      'bg-surface',
      'text-accent',
      'md:grid-cols-3',
      'lg:col-span-2',
      'absolute',
      'inset-0',
      'z-10',
      'aspect-square',
      'backdrop-blur-lg',
      'bg-gradient-to-br',
      'from-accent',
      'rounded-2xl',
      'shadow-xl',
      'hover:scale-105',
      'transition-all',
      'duration-300',
      'line-clamp-3',
      'object-cover',
      'overflow-hidden',
      'text-7xl',
      'tracking-tight',
      'sr-only',
    ];

    expect(unknownUtilityClasses(needed.join(' '))).toEqual([]);
  });

  /*
    Measured on real plans: a strong model writing a landing page reached for
    every one of these and was refused — icon sizes, section rhythm, the
    centring idiom, overlays, hover lifts. A vocabulary that refuses everyday
    Tailwind makes the free-composition feature a trap rather than a tool.
  */
  it('admits the everyday Tailwind a page builder writes without thinking', () => {
    const everyday = [
      'h-5',
      'w-5',
      'size-6',
      'h-14',
      'w-72',
      'py-20',
      'py-24',
      'md:py-24',
      'px-20',
      '-mt-8',
      'gap-16',
      'space-y-10',
      'bg-black/50',
      'bg-white/10',
      'hover:bg-white/10',
      'hover:text-white',
      'top-1/2',
      'left-1/2',
      '-translate-y-1/2',
      'hover:-translate-y-1',
      'hover:rotate-0',
      'hover:shadow-xl',
      'group',
      'group-hover:opacity-100',
      'focus-visible:ring-2',
      'ring-blue-500',
      'border-t',
      'font-mono',
      'font-sans',
      'text-balance',
      'leading-7',
      'list-disc',
      'xl:grid-cols-4',
      'xl:text-6xl',
      'min-h-dvh',
      'container',
      'columns-2',
      'aspect-16/9',
      'drop-shadow-lg',
      'disabled:opacity-50',
    ];

    expect(unknownUtilityClasses(everyday.join(' '))).toEqual([]);
  });

  it('admits the region-local namespace, which region CSS is written against', () => {
    // Without this the `css` prop would exist and be unusable: its selectors
    // could never match a class the door lets through.
    expect(unknownUtilityClasses('ck-hero-glow ck-timeline bg-surface')).toEqual([]);
  });

  it('does not admit the bare prefix, which selects nothing', () => {
    expect(unknownUtilityClasses('ck-')).toEqual(['ck-']);
  });

  it('refuses a bracketed name even under the reserved prefix', () => {
    // Otherwise the namespace would launder exactly what the theming law
    // refuses: `ck-[17px]` is an arbitrary value wearing a prefix.
    expect(unknownUtilityClasses('ck-[17px]')).toEqual(['ck-[17px]']);
    expect(unknownUtilityClasses('ck-w-[42rem]')).toEqual(['ck-w-[42rem]']);
  });

  it('admits Tailwind palette colours — free by product decision', () => {
    expect(
      unknownUtilityClasses('bg-slate-900 text-blue-500 from-indigo-500 hover:bg-rose-600'),
    ).toEqual([]);
  });

  it('disagrees with the theming law ONLY about the palette, never about arbitrary values', () => {
    /*
      The boundary, pinned. The vocabulary deliberately generates the default
      palette the theming law refuses (see the module header for why). What
      must never appear here is an arbitrary value: `p-[17px]` has no CSS at
      all, and admitting one would be a class this file waves through and the
      page then silently ignores.
    */
    const objections = [...utilityVocabulary()].flatMap((name) => findRejectedUtilities(name));

    expect(objections.length).toBeGreaterThan(2_000);
    expect(objections.every((rejection) => rejection.code === 'default-palette')).toBe(true);
  });

  it('names what it rejects rather than only saying no', () => {
    expect(unknownUtilityClasses('bg-surface bg-hotpink p-4 nonsense-9')).toEqual([
      'bg-hotpink',
      'nonsense-9',
    ]);
  });

  it('treats an empty or whitespace class attribute as nothing to reject', () => {
    expect(unknownUtilityClasses('')).toEqual([]);
    expect(unknownUtilityClasses('   \n ')).toEqual([]);
  });

  it('reserves a prefix that no generated utility could collide with', () => {
    expect(CUSTOM_CLASS_PREFIX).toBe('ck-');
    expect([...utilityVocabulary()].some((name) => name.startsWith(CUSTOM_CLASS_PREFIX))).toBe(
      false,
    );
  });

  it('caches the expansion — the door consults it per class, per proposal', () => {
    expect(utilityVocabulary()).toBe(utilityVocabulary());
  });

  it('emits one @source directive per whitespace-separated pattern, which is what generates the CSS', () => {
    const directives = utilitySourceDirectives().split('\n');
    // One per TOKEN, not per line: Tailwind brace-expands an inline source as a
    // whole, so several groups on one line would cost it their product.
    const tokens = UTILITY_VOCABULARY.flatMap((pattern) => pattern.split(/\s+/u).filter((token) => token !== ''));

    expect(directives).toHaveLength(tokens.length);
    expect(directives.every((line) => /^@source inline\("[^\s"]+"\);$/u.test(line))).toBe(true);
  });

  it('states every pattern in a form the generator can read back', () => {
    // Unbalanced braces would expand here and silently generate nothing there.
    for (const pattern of UTILITY_VOCABULARY) {
      const opens = pattern.match(/\{/gu)?.length ?? 0;
      const closes = pattern.match(/\}/gu)?.length ?? 0;
      expect({ pattern, opens, closes }).toEqual({ pattern, opens: closes, closes });
      expect(pattern).not.toContain('"');
    }
  });
});
