import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { customCodeClassNames } from '@craftkit/builder-schema';

import { validateAiPlan } from '../plan/validate-plan';
import { SECTION_VARIANTS } from '../skills/section-variants';
import { checkKitSlots, instantiateKit, kitIdOfTree, readKitSlots } from './instantiate';
import { KIT_INDEX_MAX_CHARS, defaultKitForVariant, kitIndex, sectionKit } from './kit-index';
import { kitKernel, kitPorts, kitSamples } from './kit-testing';
import { SECTION_KITS } from './kits';
import type { SectionKit } from './types';

/*
  The section kit's invariants (DESIGN §B): every kit, filled with Arabic and
  English sample slots, is a tree the door takes as a `setProp tree` on a
  kernel shaped like the product's, with the utility vocabulary enforced; no
  kit names a physical side or a palette colour; every kit's upstream file is
  vendored; every named variant has a default kit; the index fits its budget.
*/

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');

/** DESIGN §B's physical-direction regex, per class. */
const PHYSICAL = /\b(ml|mr|pl|pr|left|right)-|text-(left|right)|rounded-[lr]\b|border-[lr]\b/u;
const HUES =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
/** A palette hue, or a theme-bridge role colour: colour comes from the ck- kit classes only. */
const PALETTE = new RegExp(
  `(?:^|:)-?(?:bg|text|border|ring|divide|from|via|to|shadow|outline|fill|stroke|decoration)-(?:(?:${HUES})-\\d|(?:accent|accent-text|success|success-text|surface|surface-inverse|text|text-inverse|text-muted)(?:/\\d+)?$)`,
  'u',
);

const LOCALES = [
  { lang: 'ar' as const, dir: 'rtl' as const },
  { lang: 'en' as const, dir: 'ltr' as const },
];

function raise(id: string): never {
  throw new Error(id);
}

function fill(kit: SectionKit, lang: 'ar' | 'en', dir: 'rtl' | 'ltr') {
  const result = instantiateKit(kit, kitSamples(kit, lang), {
    id: 'hero',
    heading: kit.role === 'hero' ? 'h1' : 'h2',
    locale: { lang, dir },
  });
  if (!result.ok) throw new Error(`${kit.id}: ${result.error}`);
  return result;
}

describe('section kits', () => {
  it('ships at least 36 section kits, 2 headers and 2 footers, with unique ids', () => {
    const roles = SECTION_KITS.map((kit) => kit.role);
    expect(roles.filter((role) => role === 'header')).toHaveLength(2);
    expect(roles.filter((role) => role === 'footer')).toHaveLength(2);
    expect(roles.filter((role) => role !== 'header' && role !== 'footer').length).toBeGreaterThanOrEqual(36);
    const ids = SECTION_KITS.map((kit) => kit.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const kit of SECTION_KITS) {
      expect(kit.summary.split(/\s+/u).length, kit.id).toBeLessThanOrEqual(8);
      expect(kit.id, kit.id).toMatch(/^[a-z]+(?:-[a-z]+)*$/u);
    }
  });

  it.each(SECTION_KITS.flatMap((kit) => LOCALES.map((locale) => [kit.id, locale.lang, locale.dir] as const)))(
    '%s (%s) passes the door as a setProp tree',
    (id, lang, dir) => {
      const kit = sectionKit(id);
      if (kit === undefined) throw new Error(id);
      const result = fill(kit, lang, dir);
      const kernel = kitKernel({ dir, lang });
      const plan = {
        rationale: `kit ${id}`,
        commands: [
          { command: 'setProp', args: { id: 'r1', key: 'tree', value: result.tree } },
          ...(result.css === '' ? [] : [{ command: 'setProp', args: { id: 'r1', key: 'css', value: result.css } }]),
        ],
      };
      const validation = validateAiPlan(plan, kernel, kitPorts());
      expect(validation.ok ? [] : validation.issues.map((issue) => issue.message)).toEqual([]);
      expect(kitIdOfTree(result.tree)).toBe(id);
    },
  );

  it('names no physical side and no palette colour; region css uses tokens only', () => {
    for (const kit of SECTION_KITS) {
      const classes = customCodeClassNames(fill(kit, 'en', 'ltr').tree).flatMap((value) => value.split(/\s+/u));
      expect(classes.filter((name) => PHYSICAL.test(name)), kit.id).toEqual([]);
      expect(classes.filter((name) => PALETTE.test(name)), kit.id).toEqual([]);
      expect(kit.css ?? '', kit.id).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/iu);
    }
  });

  it('wires the site behaviours: count-up to the stat’s own number, sticky headers, staggered grids', () => {
    const attrs = (tree: unknown): Record<string, string>[] => {
      const out: Record<string, string>[] = [];
      const walk = (node: unknown): void => {
        if (typeof node !== 'object' || node === null) return;
        const record = node as { attributes?: Record<string, string>; children?: unknown[] };
        if (record.attributes !== undefined) out.push(record.attributes);
        record.children?.forEach(walk);
      };
      walk(tree);
      return out;
    };
    const stats = sectionKit('stats-row');
    if (stats === undefined) throw new Error('stats-row');
    const filled = instantiateKit(
      stats,
      { title: 'أرقامنا', items: [{ value: '+١٬٢٠٠', label: 'عميل' }, { value: '٩٨٪', label: 'رضا' }, { value: 'مجاناً', label: 'توصيل' }] },
      { id: 'stats', heading: 'h2', locale: { lang: 'ar', dir: 'rtl' } },
    );
    if (!filled.ok) throw new Error(filled.error);
    const counters = attrs(filled.tree).filter((a) => a['data-ck-behavior'] === 'count-up');
    expect(counters.map((a) => a['data-ck-to'])).toEqual(['1200', '98']);
    for (const id of ['header-bar', 'header-notice']) {
      expect(attrs(fill(sectionKit(id) ?? raise(id), 'en', 'ltr').tree).some((a) => a['data-ck-behavior'] === 'sticky-header'), id).toBe(true);
    }
    for (const id of ['features-cards', 'testimonials-cards']) {
      expect(attrs(fill(sectionKit(id) ?? raise(id), 'en', 'ltr').tree).some((a) => a['data-ck-behavior'] === 'stagger'), id).toBe(true);
    }
  });

  it('gives catalog images a responsive srcset/sizes: 100vw on the hero image, a column size elsewhere', () => {
    const hero = sectionKit('hero-split');
    if (hero === undefined) throw new Error('hero-split');
    const images: { attributes?: Record<string, string> }[] = [];
    const walk = (node: { kind: string; tag?: string; attributes?: Record<string, string>; children?: unknown[] }) => {
      if (node.kind === 'element' && node.tag === 'img') images.push(node);
      for (const child of node.children ?? []) walk(child as typeof node);
    };
    fill(hero, 'en', 'ltr').tree.children.forEach((child) => { walk(child); });
    expect(images.length).toBeGreaterThan(0);
    const [first] = images;
    expect(first?.attributes?.['srcset']).toMatch(/\?w=640 640w, .*\?w=1024 1024w, .*\?w=1600 1600w$/u);
    expect(first?.attributes?.['sizes']).toBe('100vw');
    const band = SECTION_KITS.find((kit) => kit.role !== 'hero' && JSON.stringify(kit.slots).includes('"image"'));
    if (band === undefined) return;
    const bandImages: typeof images = [];
    const walkBand = (node: Parameters<typeof walk>[0]) => {
      if (node.kind === 'element' && node.tag === 'img') bandImages.push(node);
      for (const child of node.children ?? []) walkBand(child as Parameters<typeof walk>[0]);
    };
    fill(band, 'en', 'ltr').tree.children.forEach((child) => { walkBand(child); });
    for (const image of bandImages) expect(image.attributes?.['sizes'], band.id).toBe('(min-width:1024px) 50vw, 100vw');
  });

  it('gives the section its anchor, the marker class, aria-labelledby and one heading level', () => {
    const hero = sectionKit('hero-split');
    if (hero === undefined) throw new Error('hero-split');
    const result = fill(hero, 'ar', 'rtl');
    const outer = result.tree.children[0];
    expect(outer?.kind).toBe('element');
    if (outer?.kind !== 'element') return;
    expect(outer.attributes).toMatchObject({ id: 'hero', 'aria-labelledby': 'hero-title' });
    expect(outer.className).toContain('ck-kit-hero-split');
    const json = JSON.stringify(result.tree);
    expect(json).toContain('"tag":"h1"');
    expect(json).not.toContain('data-kit-heading');
    const demoted = instantiateKit(hero, kitSamples(hero, 'en'), {
      id: 'top',
      heading: 'h2',
      locale: { lang: 'en', dir: 'ltr' },
    });
    expect(demoted.ok && JSON.stringify(demoted.tree).includes('"tag":"h1"')).toBe(false);
  });

  it('sizes every image, and only the hero first image loads eagerly', () => {
    const images = (tree: unknown): Record<string, string>[] => {
      const found: Record<string, string>[] = [];
      const walk = (node: unknown): void => {
        if (typeof node !== 'object' || node === null) return;
        const record = node as Record<string, unknown>;
        if (record['tag'] === 'img') found.push(record['attributes'] as Record<string, string>);
        if (Array.isArray(record['children'])) record['children'].forEach(walk);
      };
      walk(tree);
      return found;
    };
    for (const kit of SECTION_KITS) {
      const list = images(fill(kit, 'en', 'ltr').tree);
      list.forEach((attributes, index) => {
        expect(attributes['width'], kit.id).toMatch(/^\d+$/u);
        expect(attributes['height'], kit.id).toMatch(/^\d+$/u);
        expect(attributes['alt'], kit.id).not.toBe('');
        const eager = kit.role === 'hero' && index === 0;
        expect(attributes['loading'], kit.id).toBe(eager ? 'eager' : 'lazy');
        if (!eager) expect(attributes['fetchpriority'], kit.id).toBeUndefined();
      });
    }
  });

  it('escapes slot values: markup in a slot stays text', () => {
    const kit = sectionKit('cta-band');
    if (kit === undefined) throw new Error('cta-band');
    const result = instantiateKit(
      kit,
      { title: "<script>alert(1)</script> & {{lead}}", cta: { label: 'Go', href: '#go' } },
      { id: 'cta', heading: 'h2', locale: { lang: 'en', dir: 'ltr' } },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const json = JSON.stringify(result.tree);
    expect(json).toContain('"text":"<script>alert(1)</script> & {{lead}}"');
    expect(json).not.toContain('"tag":"script"');
  });

  it('keeps lists to their max and drops empty optional blocks', () => {
    const kit = sectionKit('faq-accordion');
    if (kit === undefined) throw new Error('faq-accordion');
    const items = Array.from({ length: 30 }, (_unused, index) => ({ q: `Q${String(index)}`, a: `A${String(index)}` }));
    const result = instantiateKit(kit, { title: 'FAQ', items }, { id: 'faq', heading: 'h2', locale: { lang: 'en', dir: 'ltr' } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const json = JSON.stringify(result.tree);
    expect(json.match(/"tag":"details"/gu)).toHaveLength(10);
    expect(json).not.toContain('ck-eyebrow');
  });

  it('reads the slots back so a refill gives the same tree', () => {
    for (const kit of SECTION_KITS) {
      for (const { lang, dir } of LOCALES) {
        const first = fill(kit, lang, dir);
        const slots = readKitSlots(kit, first.tree);
        expect(slots, `${kit.id} ${lang}`).toBeDefined();
        const again = instantiateKit(kit, slots, {
          id: 'hero',
          heading: kit.role === 'hero' ? 'h1' : 'h2',
          locale: { lang, dir },
        });
        expect(again.ok ? again.tree : again.error, `${kit.id} ${lang}`).toEqual(first.tree);
        const checked = checkKitSlots(kit, kitSamples(kit, lang), lang);
        if (checked.ok) expect(slots?.['title'], kit.id).toEqual(checked.slots['title']);
      }
    }
  });

  it('fills an image from the nearest catalog photo, never refusing a subject (fix pass 2026-10-05)', () => {
    const kit = sectionKit('hero-split');
    if (kit === undefined) throw new Error('hero-split');
    const options = { id: 'hero', heading: 'h1' as const, locale: { lang: 'en', dir: 'ltr' as const } };
    const good = kitSamples(kit, 'en');
    const image = (subject: string, alt?: string) => {
      const result = instantiateKit(kit, { ...good, image: { subject, ...(alt === undefined ? {} : { alt }) } }, options);
      if (!result.ok) throw new Error(result.error);
      return JSON.stringify(result.tree);
    };
    // The English run's features writer: a free description matched no topic and was refused.
    const fallback = image('freelancer sending professional invoice on laptop', 'An invoice on a laptop');
    expect(fallback).toMatch(/https:\/\//u);
    // A generic stand-in is described as what it shows, not as what was asked for.
    expect(fallback).not.toContain('An invoice on a laptop');
    // A catalog photo is described by its own entry, never by the writer's hope (walk 2026-10-08).
    const matched = image('coffee', 'A table of rice, salads and grills');
    expect(matched).not.toContain('A table of rice, salads and grills');
    expect(matched).toMatch(/"alt":"[^"]+"/u);
  });

  it('fills the testimonial stars: a rating reads as five stars, not five outlines', () => {
    const kit = sectionKit('testimonials-cards');
    if (kit === undefined) throw new Error('testimonials-cards');
    const result = fill(kit, 'en', 'ltr');
    expect(result.css).toContain('.ck-stars svg{fill:currentColor}');
    expect(JSON.stringify(result.tree)).toContain('ck-stars');
  });

  it('says how to fix a bad call', () => {
    const kit = sectionKit('hero-split');
    if (kit === undefined) throw new Error('hero-split');
    const options = { id: 'hero', heading: 'h1' as const, locale: { lang: 'en', dir: 'ltr' as const } };
    const good = kitSamples(kit, 'en');
    const error = (slots: unknown) => {
      const result = instantiateKit(kit, slots, options);
      return result.ok ? '' : result.error;
    };
    expect(error({ ...good, title: undefined })).toContain('needs slot "title"');
    expect(error({ ...good, image: { src: 'https://images.unsplash.com/photo-1?w=1200' } })).toContain('needs "alt"');
    expect(error({ ...good, image: { src: 'http://x.test/a.jpg', alt: 'a' } })).toContain('https://');
    expect(error({ ...good, cta: { label: 'Go', href: 'javascript:alert(1)' } })).toContain('"href" must be');
    expect(error({ ...good, cta: 'Go' })).toContain('{"label":"…","href":"#section-id"}');
    const features = sectionKit('features-list');
    if (features === undefined) throw new Error('features-list');
    const bad = instantiateKit(
      features,
      { title: 'x', items: [{ icon: 'not-an-icon-name-zz', title: 'a' }] },
      { ...options, heading: 'h2' },
    );
    expect(bad.ok ? '' : bad.error).toContain('Lucide');
    expect(instantiateKit(kit, good, { ...options, id: '1 bad id' }).ok).toBe(false);
  });
});

describe('kit sources', () => {
  it('names a vendored upstream file for every kit, listed for the fetch script', () => {
    const manifest = JSON.parse(
      readFileSync(join(repoRoot, 'scripts/section-kit/upstream-files.json'), 'utf8'),
    ) as Record<string, { commit: string; files: string[] }>;
    for (const kit of SECTION_KITS) {
      const path = join(repoRoot, 'vendor', kit.source.lib, 'upstream', kit.source.file);
      expect(existsSync(path), `${kit.id}: ${path}`).toBe(true);
      expect(manifest[kit.source.lib]?.files, kit.id).toContain(kit.source.file);
      expect(manifest[kit.source.lib]?.commit, kit.id).toBe(kit.source.commit);
    }
    for (const license of ['hyperui/LICENSE', 'tailark/LICENCE.md', 'merakiui/LICENSE']) {
      expect(existsSync(join(repoRoot, 'vendor', license)), license).toBe(true);
    }
  });
});

describe('kit index', () => {
  it('gives every SECTION_VARIANTS id a default kit of a fitting role', () => {
    for (const variant of SECTION_VARIANTS) {
      const kit = defaultKitForVariant(variant.id);
      expect(kit, variant.id).toBeDefined();
      if (kit === undefined) continue;
      const role = variant.id === 'footer' ? 'footer' : variant.role;
      expect(kit.role, variant.id).toBe(role);
    }
    expect(defaultKitForVariant('no-such-variant')).toBeUndefined();
  });

  it('lists every kit on one line within the budget', () => {
    const index = kitIndex();
    expect(index.length).toBeLessThanOrEqual(KIT_INDEX_MAX_CHARS);
    for (const kit of SECTION_KITS) expect(index, kit.id).toContain(kit.id);
    const heroes = kitIndex(['hero']);
    expect(heroes).toContain('hero-split');
    expect(heroes).not.toContain('faq-accordion');
  });
});
