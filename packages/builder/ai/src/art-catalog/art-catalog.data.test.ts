import { describe, expect, it } from 'vitest';

import { artWordTargets } from './art-words';
import { BRAND_ROWS, SIMPLE_ICONS_VERSION } from './brands.data';
import { buildArtCatalog } from './catalog';
import { DICEBEAR_STYLES, DICEBEAR_VERSION } from './characters.data';
import { EMOJI_BY_CATEGORY, EMOJI_TONED, FLUENT_EMOJI_VERSION } from './emoji.data';

/*
  The generated data, pinned (scripts/build-art-catalog.mjs, 2026-10-14). A
  re-run against the same package versions must reproduce these counts and
  samples; a version bump changes them on purpose, here and in PROVENANCE.md.
*/

const catalog = buildArtCatalog();

describe('brands.data — simple-icons@16.33.0', () => {
  it('is pinned to the version the provenance names', () => {
    expect(SIMPLE_ICONS_VERSION).toBe('16.33.0');
    expect(BRAND_ROWS).toHaveLength(3_335);
  });

  it('holds one well-formed row per brand, sorted, slugs unique', () => {
    const slugs = new Set<string>();
    for (const row of BRAND_ROWS) {
      const fields = row.split('|');
      expect(fields, row).toHaveLength(4);
      const [slug = '', title = '', hex = ''] = fields;
      expect(slug, row).toMatch(/^[a-z0-9_]+$/u);
      expect(title.trim(), row).not.toBe('');
      expect(hex, row).toMatch(/^[0-9A-F]{6}$/u);
      expect(slugs.has(slug), row).toBe(false);
      slugs.add(slug);
    }
    expect([...BRAND_ROWS].sort((left, right) => left.localeCompare(right, 'en'))).toEqual(
      BRAND_ROWS,
    );
  });

  it('keeps the brands people name and their colours', () => {
    expect(BRAND_ROWS).toContain('stripe|Stripe|635BFF|');
    expect(BRAND_ROWS).toContain('visa|Visa|1A1F71|');
    expect(BRAND_ROWS).toContain("mcdonalds|McDonald's|FBC817|");
    for (const slug of [
      'paypal',
      'applepay',
      'googlepay',
      'whatsapp',
      'instagram',
      'shopify',
      'emirates',
      'appstore',
      'googleplay',
    ]) {
      expect(
        catalog.brands.some((brand) => brand.slug === slug),
        slug,
      ).toBe(true);
    }
  });

  it('leaves out an icon whose own licence asks for credit, share-alike or non-commercial use', () => {
    // 30 seconds of code is CC-BY-4.0 in simple-icons@16.33.0; .NET is CC0-1.0 and stays.
    expect(catalog.brands.some((brand) => brand.slug === '30secondsofcode')).toBe(false);
    expect(catalog.brands.some((brand) => brand.slug === 'dotnet')).toBe(true);
  });
});

describe('characters.data — @dicebear/<style>@9.4.2', () => {
  it('records every character style that allows commercial use, with its licence and creator', () => {
    expect(DICEBEAR_VERSION).toBe('9.4.2');
    expect(DICEBEAR_STYLES).toHaveLength(25);
    expect(DICEBEAR_STYLES.find((style) => style.id === 'notionists')).toMatchObject({
      creator: 'Zoish',
      licence: 'CC0 1.0',
      attribution: false,
    });
    expect(DICEBEAR_STYLES.find((style) => style.id === 'adventurer')).toMatchObject({
      creator: 'Lisa Wischofsky',
      licence: 'CC BY 4.0',
      attribution: true,
    });
    expect(DICEBEAR_STYLES.find((style) => style.id === 'avataaars')).toMatchObject({
      creator: 'Pablo Stanley',
      licence: 'Free for personal and commercial use',
      attribution: false,
    });
  });

  it('leaves out the abstract styles (patterns, monograms, icons)', () => {
    for (const id of ['glass', 'icons', 'identicon', 'initials', 'rings', 'shapes']) {
      expect(
        DICEBEAR_STYLES.some((style) => style.id === id),
        id,
      ).toBe(false);
    }
  });

  it('offers only the styles that need no credit line, notionists first', () => {
    expect(catalog.offeredStyles.map(({ id }) => id)).toEqual([
      'notionists',
      'lorelei',
      'open-peeps',
      'avataaars',
      'notionists-neutral',
      'lorelei-neutral',
      'avataaars-neutral',
      'thumbs',
      'pixel-art',
      'pixel-art-neutral',
      'bottts',
      'bottts-neutral',
    ]);
    expect(catalog.offeredStyles.every((style) => !style.attribution)).toBe(true);
    expect(catalog.styles.filter((style) => style.attribution)).toHaveLength(13);
  });
});

describe('emoji.data — @iconify-json/fluent-emoji-flat@1.2.6', () => {
  it('holds the names by category, skin tones apart', () => {
    expect(FLUENT_EMOJI_VERSION).toBe('1.2.6');
    expect(catalog.emoji).toHaveLength(1_595);
    expect(Object.keys(EMOJI_BY_CATEGORY)).toEqual([
      'Activities',
      'Animals & Nature',
      'Flags',
      'Food & Drink',
      'Objects',
      'People & Body',
      'Smileys & Emotion',
      'Symbols',
      'Travel & Places',
    ]);
    expect(EMOJI_TONED.split(' ')).toHaveLength(311);
    expect(catalog.emojiByName.get('health-worker')?.category).toBe('People & Body');
    expect(catalog.emojiByName.get('hot-beverage')?.category).toBe('Food & Drink');
    expect(catalog.emojiByName.has('health-worker-dark')).toBe(false);
    expect(catalog.toned.has('health-worker')).toBe(true);
  });

  it('every name is a lower-case kebab name the API serves', () => {
    for (const { name } of catalog.emoji) expect(name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
  });
});

describe('art-words — every word points at real catalog entries', () => {
  it('names only emoji and styles the pinned data holds', () => {
    const { illustrations, characters } = artWordTargets();
    expect(illustrations.filter((name) => !catalog.emojiByName.has(name))).toEqual([]);
    expect(
      characters.filter((id) => !catalog.offeredStyles.some((style) => style.id === id)),
    ).toEqual([]);
  });
});
