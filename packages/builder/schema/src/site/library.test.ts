import { afterEach, describe, expect, it } from 'vitest';

import { setUtilityClassOracle } from '../custom-code/utility-vocabulary';
import type { CustomCodeRoot } from '../custom-code/custom-code-tree';
import { onePageSite } from '../testing/site-fixtures';
import {
  applySymbolOverrides,
  expandNamedStyleMarkers,
  isLibraryId,
  isPaletteColorValue,
  isUploadedFontUrl,
  LIBRARY_LIMITS,
  namedStyleClassProblem,
  namedStyleIdOf,
  namedStyleMarker,
  savedTemplateSchema,
  siteFontSchema,
  siteLibrarySchema,
  siteSymbolSchema,
  symbolOverrideSchema,
  validateSiteLibrary,
  type NamedStyle,
  type SiteLibrary,
} from './library';
import {
  describeLibraryUsage,
  describeLibraryUsages,
  findAssetUsages,
  findNamedStyleUsages,
  findPaletteUsages,
  findSymbolInstances,
  namedStyleUsageCounts,
  referencedSymbolIds,
  symbolCycle,
} from './library-usage';
import type { BuilderSite } from './types';

afterEach(() => {
  setUtilityClassOracle(undefined);
});

const tree: CustomCodeRoot = {
  kind: 'root',
  children: [
    {
      kind: 'element',
      tag: 'div',
      className: 'ck-s-card p-4',
      children: [{ kind: 'element', tag: 'h2', className: 'text-2xl', text: 'Title' }],
    },
  ],
};

describe('library ids', () => {
  it.each([
    ['brand', true],
    ['brand-600', true],
    ['a', true],
    ['a'.repeat(48), true],
    ['a'.repeat(49), false],
    ['Brand', false],
    ['6brand', false],
    ['-brand', false],
    ['brand_600', false],
    ['', false],
    ['constructor', false],
    ['prototype', false],
  ])('%j is a library id: %s', (id, expected) => {
    expect(isLibraryId(id)).toBe(expected);
  });

  it('marks and reads a named style', () => {
    expect(namedStyleMarker('card')).toBe('ck-s-card');
    expect(namedStyleIdOf('ck-s-card')).toBe('card');
    expect(namedStyleIdOf('ck-fx-glass')).toBeUndefined();
    expect(namedStyleIdOf('ck-s-Bad')).toBeUndefined();
  });
});

describe('palette colour values', () => {
  it.each([
    '#fff',
    '#ffff',
    '#0f766e',
    '#0f766e80',
    'rgb(15 118 110)',
    'rgb(15, 118, 110)',
    'rgba(15, 118, 110, 0.5)',
    'rgb(15 118 110 / 50%)',
    'hsl(174deg 77% 26%)',
    'hsla(174, 77%, 26%, .5)',
    'oklch(62% 0.15 160)',
    'oklch(0.62 0.15 160 / 0.8)',
    'OKLCH(62% 0.15 none)',
  ])('admits %s', (value) => {
    expect(isPaletteColorValue(value)).toBe(true);
  });

  it.each([
    'red',
    '#ggg',
    '#12345',
    'rgb(1 2)',
    'rgb(1 2 3 4 5)',
    'rgb(1 2 3); color: red',
    'red;} body{display:none',
    'var(--x)',
    'lab(50% 40 59)',
    'rgb(calc(1) 2 3)',
    '',
  ])('refuses %j', (value) => {
    expect(isPaletteColorValue(value)).toBe(false);
  });
});

describe('the library schema', () => {
  const style: NamedStyle = { id: 'card', name: 'Card', className: 'rounded-lg p-4' };

  it('accepts an empty library and a full one', () => {
    expect(validateSiteLibrary({}).ok).toBe(true);
    const full: SiteLibrary = {
      palette: [{ id: 'brand', name: 'Brand', value: '#0f766e', group: 'Brand' }],
      styles: { card: style },
      symbols: { hero: { id: 'hero', name: 'Hero', tree, css: '.ck-x{color:red}' } },
      templates: {
        faq: { id: 'faq', name: 'FAQ', kind: 'section', tree, savedAt: '2026-10-05T10:00:00Z' },
      },
      fonts: [{ family: 'Cairo', source: 'google', weights: [400, 700], scripts: ['arabic'] }],
      settings: { pageTransitions: true, smoothScroll: false },
    };
    expect(validateSiteLibrary(full)).toEqual({ ok: true, library: full });
  });

  it.each([
    ['an unknown key', { colours: [] }],
    ['a palette value that is not a colour', { palette: [{ id: 'x', name: 'X', value: 'red' }] }],
    [
      'a palette id listed twice',
      {
        palette: [
          { id: 'x', name: 'X', value: '#000' },
          { id: 'x', name: 'Y', value: '#fff' },
        ],
      },
    ],
    ['a style stored under another key', { styles: { card: { ...style, id: 'other' } } }],
    ['a style key that is not an id', { styles: { Card: { ...style, id: 'Card' } } }],
    [
      'a style carrying a ck-s- marker',
      { styles: { card: { ...style, className: 'ck-s-base p-4' } } },
    ],
    [
      'a style class list over the limit',
      { styles: { card: { ...style, className: 'p-4 '.repeat(300) } } },
    ],
    ['a style with a quote', { styles: { card: { ...style, className: 'p-4"' } } }],
    [
      'a symbol whose tree is not a tree',
      { symbols: { s: { id: 's', name: 'S', tree: { kind: 'root', children: [{ kind: 'x' }] } } } },
    ],
    [
      'a symbol stylesheet that imports',
      {
        symbols: { s: { id: 's', name: 'S', tree, css: '@import url(https://evil.test/a.css);' } },
      },
    ],
    [
      'a template with no savedAt instant',
      { templates: { t: { id: 't', name: 'T', kind: 'section', tree, savedAt: 'yesterday' } } },
    ],
    ['settings with an unknown key', { settings: { parallax: true } }],
  ])('refuses %s', (_label, value) => {
    expect(validateSiteLibrary(value).ok).toBe(false);
  });

  it('caps every collection', () => {
    const palette = Array.from({ length: LIBRARY_LIMITS.palette + 1 }, (_, index) => ({
      id: `c${String(index)}`,
      name: 'C',
      value: '#000',
    }));
    expect(siteLibrarySchema.safeParse({ palette }).success).toBe(false);
    expect(siteLibrarySchema.safeParse({ palette: palette.slice(1) }).success).toBe(true);

    const styles = Object.fromEntries(
      Array.from({ length: LIBRARY_LIMITS.styles + 1 }, (_, index) => {
        const id = `s${String(index)}`;
        return [id, { id, name: 'S', className: 'p-4' }];
      }),
    );
    expect(siteLibrarySchema.safeParse({ styles }).success).toBe(false);
  });

  it('accepts template and symbol shapes on their own', () => {
    expect(siteSymbolSchema.safeParse({ id: 'a', name: 'A', tree }).success).toBe(true);
    expect(
      savedTemplateSchema.safeParse({
        id: 't',
        name: 'T',
        kind: 'element',
        tree,
        savedAt: '2026-10-05T10:00:00+03:00',
      }).success,
    ).toBe(true);
  });

  it('bounds symbol overrides and their attributes', () => {
    expect(symbolOverrideSchema.safeParse({ path: [0], text: 'Hi' }).success).toBe(true);
    expect(symbolOverrideSchema.safeParse({ path: [0], attributes: { href: null } }).success).toBe(
      true,
    );
    expect(symbolOverrideSchema.safeParse({ path: [], text: 'Hi' }).success).toBe(false);
    expect(
      symbolOverrideSchema.safeParse({ path: [0], attributes: { onclick: 'x()' } }).success,
    ).toBe(false);
  });
});

describe('site fonts', () => {
  const woff2 = (bytes: number) => `data:font/woff2;base64,${'A'.repeat(Math.ceil(bytes / 3) * 4)}`;

  it('accepts hosted fonts by family and uploads as an embedded woff2', () => {
    expect(
      siteFontSchema.safeParse({ family: 'IBM Plex Sans Arabic', source: 'google', weights: [400] })
        .success,
    ).toBe(true);
    expect(
      siteFontSchema.safeParse({
        family: 'Inter',
        source: 'bunny',
        weights: [400, 700],
        italic: true,
      }).success,
    ).toBe(true);
    expect(
      siteFontSchema.safeParse({
        family: 'House',
        source: 'upload',
        weights: [400],
        url: woff2(1024),
      }).success,
    ).toBe(true);
  });

  it.each([
    ['a hosted font with a url', { family: 'Inter', source: 'google', weights: [400], url: 'x' }],
    ['an upload without a url', { family: 'House', source: 'upload', weights: [400] }],
    [
      'an upload from the network',
      { family: 'House', source: 'upload', weights: [400], url: 'https://x.test/a.woff2' },
    ],
    ['a family that could break out of CSS', { family: 'X"; }', source: 'google', weights: [400] }],
    ['no weights', { family: 'Inter', source: 'google', weights: [] }],
    ['a repeated weight', { family: 'Inter', source: 'google', weights: [400, 400] }],
  ])('refuses %s', (_label, value) => {
    expect(siteFontSchema.safeParse(value).success).toBe(false);
  });

  it('caps an upload at 600 kB decoded', () => {
    expect(isUploadedFontUrl(woff2(LIBRARY_LIMITS.uploadedFontBytes))).toBe(true);
    expect(isUploadedFontUrl(woff2(LIBRARY_LIMITS.uploadedFontBytes + 3))).toBe(false);
    expect(isUploadedFontUrl('data:font/woff2;base64,')).toBe(false);
    expect(isUploadedFontUrl('data:font/woff2;base64,@@@@')).toBe(false);
    expect(isUploadedFontUrl('data:font/ttf;base64,AAAA')).toBe(false);
  });

  it('refuses a family listed twice in one library', () => {
    const fonts = [
      { family: 'Inter', source: 'google', weights: [400] },
      { family: 'inter', source: 'bunny', weights: [400] },
    ];
    expect(validateSiteLibrary({ fonts }).ok).toBe(false);
  });
});

describe('the named-style door check', () => {
  it('refuses a marker and names unknown classes', () => {
    expect(namedStyleClassProblem('ck-s-card p-4')).toMatch(/named style marker/);
    expect(namedStyleClassProblem('p-4 not-a-utility')).toMatch(/not-a-utility/);
  });

  it('admits what the host compiler admits', () => {
    expect(namedStyleClassProblem('p-[17px]')).toMatch(/p-\[17px\]/);
    setUtilityClassOracle((name) => name === 'p-[17px]');
    expect(namedStyleClassProblem('p-[17px]')).toBeUndefined();
  });

  it('admits ck- hook classes such as effects', () => {
    expect(namedStyleClassProblem('ck-fx-glass')).toBeUndefined();
  });
});

describe('expandNamedStyleMarkers', () => {
  const styles = {
    card: { id: 'card', name: 'Card', className: 'rounded-lg p-4 bg-surface' },
    featured: { id: 'featured', name: 'Featured', className: 'bg-accent' },
  };

  it('expands markers in order and lets own utilities win', () => {
    expect(expandNamedStyleMarkers('ck-s-card ck-s-featured p-8', styles)).toBe(
      'rounded-lg bg-accent p-8',
    );
  });

  it('keeps the markers it is told to keep, without repainting what they override', () => {
    /* `featured` came after `card`, so card's bg-surface never showed; it must not return. */
    expect(expandNamedStyleMarkers('ck-s-card ck-s-featured', styles, new Set(['featured']))).toBe(
      'ck-s-featured rounded-lg p-4',
    );
    /* Before `card`, featured's bg-accent lost to card's bg-surface; inlining card keeps that. */
    expect(expandNamedStyleMarkers('ck-s-featured ck-s-card', styles, new Set(['featured']))).toBe(
      'ck-s-featured rounded-lg p-4 bg-surface',
    );
  });

  it('drops a marker naming a style the library does not hold', () => {
    expect(expandNamedStyleMarkers('ck-s-ghost p-2', styles)).toBe('p-2');
    expect(expandNamedStyleMarkers('ck-s-card', undefined)).toBe('');
  });
});

describe('applySymbolOverrides', () => {
  it('applies text, class and attribute overrides without touching the master', () => {
    const master: CustomCodeRoot = {
      kind: 'root',
      children: [
        {
          kind: 'element',
          tag: 'a',
          className: 'p-2',
          text: 'Go',
          attributes: { href: 'https://a.test', title: 'A' },
        },
      ],
    };
    const before = JSON.stringify(master);
    const next = applySymbolOverrides(master, [
      {
        path: [0],
        text: 'Buy',
        className: 'p-4',
        attributes: { href: 'https://b.test', title: null },
      },
      { path: [9], text: 'stale path is skipped' },
    ]);
    expect(next.children[0]).toEqual({
      kind: 'element',
      tag: 'a',
      className: 'p-4',
      text: 'Buy',
      attributes: { href: 'https://b.test' },
    });
    expect(JSON.stringify(master)).toBe(before);
  });

  it('reaches nested nodes and gives an icon only its class', () => {
    const master: CustomCodeRoot = {
      kind: 'root',
      children: [
        {
          kind: 'element',
          tag: 'div',
          children: [{ kind: 'icon', name: 'mail', className: 'size-4' }],
        },
      ],
    };
    const next = applySymbolOverrides(master, [{ path: [0, 0], className: 'size-6', text: 'x' }]);
    expect(next.children[0]).toEqual({
      kind: 'element',
      tag: 'div',
      children: [{ kind: 'icon', name: 'mail', className: 'size-6' }],
    });
  });
});

describe('where a library entry is used', () => {
  function siteWith(): BuilderSite {
    const site = onePageSite();
    const home = site.pages[0];
    if (home === undefined) throw new Error('fixture has a home page');
    const document = {
      ...home.document,
      nodes: {
        ...home.document.nodes,
        region: {
          id: 'region',
          type: 'customCode',
          props: {
            tree: {
              kind: 'root',
              children: [
                {
                  kind: 'element',
                  tag: 'div',
                  className: 'ck-s-card bg-(--ck-c-brand)',
                  children: [
                    {
                      kind: 'component',
                      component: 'customCodeSymbol',
                      props: { symbolId: 'cta' },
                    },
                  ],
                },
              ],
            },
            css: '',
          },
        },
        instance: {
          id: 'instance',
          type: 'customCodeSymbol',
          props: { symbolId: 'cta', overrides: [{ path: [0], className: 'ck-s-card' }] },
        },
        photo: { id: 'photo', type: 'image', props: { src: { assetId: 'pic' } } },
      },
    };
    return {
      ...site,
      pages: [{ ...home, document }],
      library: {
        palette: [{ id: 'brand', name: 'Brand', value: '#0f766e' }],
        styles: { card: { id: 'card', name: 'Card', className: 'p-4' } },
        symbols: { cta: { id: 'cta', name: 'CTA', tree, css: '.ck-x{color:var(--ck-c-brand)}' } },
      },
    };
  }

  it('finds named-style holders in trees, overrides and symbols', () => {
    const usages = findNamedStyleUsages(siteWith(), 'card');
    expect(usages.map(describeLibraryUsage)).toEqual([
      'page "home" › node "region" › props.tree.children.0',
      'page "home" › node "instance" › props.overrides.0',
      'symbol "cta" › tree.children.0',
    ]);
    expect(namedStyleUsageCounts(siteWith())).toEqual({ card: 3 });
    expect(findNamedStyleUsages(siteWith(), 'cardx')).toEqual([]);
  });

  it('finds palette references in classes and stylesheets, by whole name', () => {
    const owners = findPaletteUsages(siteWith(), 'brand').map((usage) => usage.owner.kind);
    expect(owners).toEqual(['page', 'symbol']);
    expect(findPaletteUsages(siteWith(), 'bran')).toEqual([]);
  });

  it('finds symbol instances as nodes and as tree components', () => {
    const usages = findSymbolInstances(siteWith(), 'cta');
    expect(usages.map((usage) => usage.nodeId)).toEqual(['region', 'instance']);
    expect(referencedSymbolIds(siteWith().pages[0]?.document.nodes['region'])).toEqual(['cta']);
  });

  it('finds asset references with a readable location', () => {
    expect(findAssetUsages(siteWith(), 'pic').map(describeLibraryUsage)).toEqual([
      'page "home" › node "photo" › props.src',
    ]);
  });

  it('lists a refusal-sized summary', () => {
    const usages = findNamedStyleUsages(siteWith(), 'card');
    expect(describeLibraryUsages(usages, 1)).toMatch(/; and 2 more$/);
  });

  it('finds a symbol cycle, and none for a candidate that breaks it', () => {
    const instance = (symbolId: string): CustomCodeRoot => ({
      kind: 'root',
      children: [{ kind: 'component', component: 'customCodeSymbol', props: { symbolId } }],
    });
    const library: SiteLibrary = {
      symbols: {
        a: { id: 'a', name: 'A', tree: instance('b') },
        b: { id: 'b', name: 'B', tree: instance('c') },
        c: { id: 'c', name: 'C', tree },
      },
    };
    expect(symbolCycle(library, 'a')).toBeUndefined();
    expect(symbolCycle(library, 'c', { id: 'c', name: 'C', tree: instance('a') })).toEqual([
      'c',
      'a',
      'b',
      'c',
    ]);
    expect(symbolCycle(library, 'a', { id: 'a', name: 'A', tree: instance('a') })).toEqual([
      'a',
      'a',
    ]);
  });
});
