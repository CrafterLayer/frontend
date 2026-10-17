import { produceWithPatches } from 'immer';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  BuilderError,
  defaultDesignSystem,
  setUtilityClassOracle,
  validateSite,
  type AssetEntry,
  type BuilderDocument,
  type BuilderSite,
  type CommandRuntime,
  type CustomCodeRoot,
  type DesignSystem,
  type SiteLibrary,
} from '@craftkit/builder-schema';
import { onePageSite } from '@craftkit/builder-schema/testing';

import { createSiteBuilder } from '../site/create-site-builder';
import { fixedClock, seededIds } from '../testing/fixed-ports';
import { libraryCommands, type LibraryCommandName, type LibraryCommands } from './library-commands';
import { siteCommands } from './site-commands';

/**
 * P5 (style-manager DESIGN.md §2): the site design library commands.
 *
 * Each command is driven twice: as a bare production (what it writes, what it
 * refuses, and that a refusal writes nothing), and through the site kernel
 * (one dispatch = one transaction, and Undo puts the site back exactly).
 */

beforeEach(() => {
  /* The host's runtime compiler, stood in for: every class is real but "bogus-*". */
  setUtilityClassOracle((name) => !name.startsWith('bogus'));
});

afterEach(() => {
  setUtilityClassOracle(undefined);
});

const runtime: CommandRuntime = {
  ids: seededIds('lib'),
  blocks: () => undefined,
  compositions: () => undefined,
};

const symbolTree: CustomCodeRoot = {
  kind: 'root',
  children: [
    {
      kind: 'element',
      tag: 'a',
      className: 'ck-s-card px-4',
      text: 'Start',
      attributes: { href: 'https://example.com', title: 'Start now' },
    },
  ],
};

function asset(id: string): AssetEntry {
  return {
    id,
    url: `https://cdn.example.com/${id}.jpg`,
    description: 'a photograph',
    mood: [],
    palette: [],
    alt: 'A photograph',
    width: 1200,
    height: 800,
  };
}

/**
 * One page holding every kind of library reference: a composed region using
 * a named style, a palette colour and a nested symbol; a symbol instance with
 * overrides; and an image using an asset.
 */
function richSite(): BuilderSite {
  const base = onePageSite();
  const home = base.pages[0];
  if (home === undefined) throw new Error('the fixture has a home page');
  const root = home.document.nodes[home.document.rootId];
  if (root === undefined) throw new Error('the fixture has a root');
  const document: BuilderDocument = {
    ...home.document,
    nodes: {
      ...home.document.nodes,
      [root.id]: {
        ...root,
        slots: { default: [...(root.slots?.['default'] ?? []), 'region', 'instance', 'photo'] },
      },
      region: {
        id: 'region',
        type: 'customCode',
        props: {
          label: 'Hero',
          tree: {
            kind: 'root',
            children: [
              {
                kind: 'element',
                tag: 'div',
                className: 'ck-s-card ck-s-wide p-8 bg-(--ck-c-brand)',
                children: [
                  {
                    kind: 'component',
                    component: 'customCodeSymbol',
                    props: { symbolId: 'cta' },
                    children: [],
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
        props: {
          label: 'Footer CTA',
          symbolId: 'cta',
          overrides: [{ path: [0], text: 'Buy', attributes: { title: null } }],
        },
      },
      photo: { id: 'photo', type: 'image', props: { src: { assetId: 'pic' } } },
    },
  };
  return {
    ...base,
    pages: [{ ...home, document }],
    assets: { pic: asset('pic'), spare: asset('spare') },
    library: {
      palette: [
        { id: 'brand', name: 'Brand', value: '#0f766e' },
        { id: 'sand', name: 'Sand', value: 'oklch(92% 0.04 85)' },
      ],
      styles: {
        card: { id: 'card', name: 'Card', className: 'rounded-lg p-4 bg-surface' },
        wide: { id: 'wide', name: 'Wide', className: 'max-w-5xl' },
        unused: { id: 'unused', name: 'Unused', className: 'shadow-lg' },
      },
      symbols: { cta: { id: 'cta', name: 'Call to action', tree: symbolTree, css: '.ck-x{}' } },
    },
  };
}

/** Run one command exactly as the dispatcher does: one production. */
function run<N extends LibraryCommandName>(
  base: BuilderSite,
  name: N,
  args: LibraryCommands[N],
): BuilderSite {
  const [next] = produceWithPatches(base, (draft) => {
    libraryCommands[name].apply(args)(draft, runtime);
  });
  return next;
}

function expectRefusal<N extends LibraryCommandName>(
  base: BuilderSite,
  name: N,
  args: LibraryCommands[N],
  pattern: RegExp,
  code: 'site/structural-violation' | 'cmd/invalid-args' = 'site/structural-violation',
): void {
  const before = JSON.stringify(base);
  let caught: unknown;
  try {
    run(base, name, args);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(BuilderError);
  expect((caught as BuilderError).code).toBe(code);
  expect((caught as BuilderError).message).toMatch(pattern);
  expect(JSON.stringify(base)).toBe(before);
}

function regionClass(site: BuilderSite): unknown {
  const tree = site.pages[0]?.document.nodes['region']?.props['tree'] as unknown as CustomCodeRoot;
  const first = tree.children[0];
  return first?.kind === 'element' ? first.className : undefined;
}

describe('registration', () => {
  it('spreads every library command into the site command set', () => {
    for (const name of Object.keys(libraryCommands)) {
      expect(siteCommands[name as LibraryCommandName]).toBe(
        libraryCommands[name as LibraryCommandName],
      );
    }
  });

  it('keeps the rich fixture a valid site', () => {
    expect(validateSite(richSite()).ok).toBe(true);
  });
});

describe('palette', () => {
  it('adds at the end, replaces in place, and moves by index', () => {
    const site = onePageSite();
    let next = run(site, 'setPaletteColor', { color: { id: 'a', name: 'A', value: '#000' } });
    next = run(next, 'setPaletteColor', { color: { id: 'b', name: 'B', value: '#111' } });
    next = run(next, 'setPaletteColor', { color: { id: 'a', name: 'A2', value: '#222' } });
    expect(next.library?.palette?.map((entry) => `${entry.id}:${entry.value}`)).toEqual([
      'a:#222',
      'b:#111',
    ]);
    next = run(next, 'setPaletteColor', { color: { id: 'b', name: 'B', value: '#111' }, index: 0 });
    expect(next.library?.palette?.map((entry) => entry.id)).toEqual(['b', 'a']);
    expect(validateSite(next).ok).toBe(true);
  });

  it('refuses a value that is not a colour and an index past the end', () => {
    expectRefusal(
      onePageSite(),
      'setPaletteColor',
      { color: { id: 'a', name: 'A', value: 'red;}' } },
      /Invalid command arguments/,
      'cmd/invalid-args',
    );
    expectRefusal(
      onePageSite(),
      'setPaletteColor',
      { color: { id: 'a', name: 'A', value: '#000' }, index: 3 },
      /past the end/,
    );
  });

  it('refuses a 121st colour', () => {
    const palette = Array.from({ length: 120 }, (_, index) => ({
      id: `c${String(index)}`,
      name: 'C',
      value: '#000',
    }));
    expectRefusal(
      { ...onePageSite(), library: { palette } },
      'setPaletteColor',
      { color: { id: 'extra', name: 'Extra', value: '#fff' } },
      /palette is full/,
    );
  });

  it('removes an unused colour, and refuses one still used, naming where', () => {
    const next = run(richSite(), 'removePaletteColor', { id: 'sand' });
    expect(next.library?.palette?.map((entry) => entry.id)).toEqual(['brand']);
    expectRefusal(richSite(), 'removePaletteColor', { id: 'brand' }, /page "home" › node "region"/);
    expectRefusal(richSite(), 'removePaletteColor', { id: 'ghost' }, /does not exist/);
  });

  it('prunes an emptied library back to no field at all', () => {
    const site = onePageSite();
    const added = run(site, 'setPaletteColor', { color: { id: 'a', name: 'A', value: '#000' } });
    const removed = run(added, 'removePaletteColor', { id: 'a' });
    expect(removed).toEqual(site);
    expect('library' in removed).toBe(false);
  });
});

describe('named styles', () => {
  it('upserts a style whose classes the host compiles', () => {
    const next = run(onePageSite(), 'setNamedStyle', {
      style: { id: 'card', name: 'Card', className: 'p-[17px] bg-(--ck-c-brand)' },
    });
    expect(next.library?.styles?.['card']?.className).toBe('p-[17px] bg-(--ck-c-brand)');
  });

  it('refuses an unknown utility and a nested marker', () => {
    expectRefusal(
      onePageSite(),
      'setNamedStyle',
      { style: { id: 'card', name: 'Card', className: 'p-4 bogus-thing' } },
      /bogus-thing/,
    );
    expectRefusal(
      onePageSite(),
      'setNamedStyle',
      { style: { id: 'card', name: 'Card', className: 'ck-s-base' } },
      /Invalid command arguments/,
      'cmd/invalid-args',
    );
  });

  it('removes an unused style', () => {
    const next = run(richSite(), 'removeNamedStyle', { id: 'unused' });
    expect(Object.keys(next.library?.styles ?? {})).toEqual(['card', 'wide']);
  });

  it('refuses to remove a style in use, listing where, unless detached', () => {
    expectRefusal(
      richSite(),
      'removeNamedStyle',
      { id: 'card' },
      /used by 2 element\(s\): page "home" › node "region".*symbol "cta"/,
    );
  });

  it('detaches: inlines the style into every user, keeping their other markers', () => {
    const next = run(richSite(), 'removeNamedStyle', { id: 'card', detach: true });
    expect(next.library?.styles?.['card']).toBeUndefined();
    /* p-8 (own) beat card's p-4, so only the surviving utilities come along. */
    /* card's p-4 lost to the own p-8 and its bg-surface to the own palette background. */
    expect(regionClass(next)).toBe('ck-s-wide rounded-lg p-8 bg-(--ck-c-brand)');
    const symbolFirst = next.library?.symbols?.['cta']?.tree.children[0];
    expect(symbolFirst?.kind === 'element' ? symbolFirst.className : undefined).toBe(
      'rounded-lg p-4 bg-surface px-4',
    );
    expect(JSON.stringify(next)).not.toContain('ck-s-card');
    expect(validateSite(next).ok).toBe(true);
  });
});

describe('symbols', () => {
  it('upserts a symbol and refuses one that would contain itself', () => {
    const next = run(onePageSite(), 'setSymbol', {
      symbol: { id: 'badge', name: 'Badge', tree: symbolTree },
    });
    expect(next.library?.symbols?.['badge']?.name).toBe('Badge');
    expectRefusal(
      onePageSite(),
      'setSymbol',
      {
        symbol: {
          id: 'loop',
          name: 'Loop',
          tree: {
            kind: 'root',
            children: [
              { kind: 'component', component: 'customCodeSymbol', props: { symbolId: 'loop' } },
            ],
          },
        },
      },
      /contain itself: loop → loop/,
    );
  });

  it('refuses to remove a symbol with instances, listing them', () => {
    expectRefusal(
      richSite(),
      'removeSymbol',
      { id: 'cta' },
      /2 instance\(s\): page "home" › node "region".*node "instance"/,
    );
  });

  it('detaches every instance into a plain region carrying its overrides', () => {
    const next = run(richSite(), 'removeSymbol', { id: 'cta', detach: true });
    expect(next.library?.symbols).toBeUndefined();

    const instance = next.pages[0]?.document.nodes['instance'];
    expect(instance?.type).toBe('customCode');
    expect(instance?.props).toEqual({
      label: 'Footer CTA',
      css: '.ck-x{}',
      tree: {
        kind: 'root',
        children: [
          {
            kind: 'element',
            tag: 'a',
            className: 'ck-s-card px-4',
            text: 'Buy',
            attributes: { href: 'https://example.com' },
          },
        ],
      },
    });

    const regionTree = next.pages[0]?.document.nodes['region']?.props[
      'tree'
    ] as unknown as CustomCodeRoot;
    const holder = regionTree.children[0];
    const nested = holder?.kind === 'element' ? holder.children?.[0] : undefined;
    expect(nested).toEqual({
      kind: 'component',
      component: 'customCode',
      props: { label: 'Call to action', tree: symbolTree, css: '.ck-x{}' },
    });
    expect(validateSite(next).ok).toBe(true);
  });
});

describe('templates, fonts and settings', () => {
  it('saves and removes a template', () => {
    const template = {
      id: 'faq',
      name: 'FAQ',
      kind: 'section' as const,
      tree: symbolTree,
      savedAt: '2026-10-05T09:00:00Z',
    };
    const saved = run(onePageSite(), 'saveTemplate', { template });
    expect(saved.library?.templates?.['faq']).toEqual(template);
    expect(run(saved, 'removeTemplate', { id: 'faq' })).toEqual(onePageSite());
    expectRefusal(onePageSite(), 'removeTemplate', { id: 'faq' }, /does not exist/);
  });

  it('replaces the font list, and an empty list clears it', () => {
    const fonts = [
      { family: 'Cairo', source: 'google' as const, weights: [400, 700] },
      { family: 'Inter', source: 'bunny' as const, weights: [400] },
    ];
    const set = run(onePageSite(), 'setSiteFonts', { fonts });
    expect(set.library?.fonts).toEqual(fonts);
    expect(run(set, 'setSiteFonts', { fonts: [] }).library).toBeUndefined();
    expectRefusal(
      onePageSite(),
      'setSiteFonts',
      { fonts: [fonts[0]!, { ...fonts[1]!, family: 'cairo' }] },
      /Invalid command arguments/,
      'cmd/invalid-args',
    );
  });

  it('merges settings', () => {
    let next = run(onePageSite(), 'setLibrarySettings', { settings: { pageTransitions: true } });
    next = run(next, 'setLibrarySettings', { settings: { smoothScroll: false } });
    expect(next.library?.settings).toEqual({ pageTransitions: true, smoothScroll: false });
  });
});

describe('importDesignLibrary', () => {
  it('round-trips: what one site exports, another imports exactly', () => {
    const source = richSite();
    const exported = { designSystem: source.designSystem, library: source.library ?? {} };
    const target = onePageSite();
    const next = run(
      target,
      'importDesignLibrary',
      JSON.parse(JSON.stringify(exported)) as LibraryCommands['importDesignLibrary'],
    );
    expect(next.designSystem).toEqual(source.designSystem);
    expect(next.library).toEqual(source.library);
  });

  it('refuses an illegible design system and an unknown style class, writing nothing', () => {
    const system = defaultDesignSystem();
    const illegible: DesignSystem = {
      ...system,
      tokens: { ...system.tokens, text: system.tokens.surface },
    };
    expectRefusal(
      onePageSite(),
      'importDesignLibrary',
      { designSystem: illegible, library: {} },
      /would not be legible/,
    );
    const library: SiteLibrary = {
      styles: { card: { id: 'card', name: 'Card', className: 'bogus-x' } },
    };
    expectRefusal(
      onePageSite(),
      'importDesignLibrary',
      { designSystem: system, library },
      /Imported style "card".*bogus-x/,
    );
  });
});

describe('assets', () => {
  it('updates alt, description and url, keeping the rest', () => {
    const next = run(richSite(), 'updateAsset', {
      id: 'pic',
      patch: { alt: 'نخيل عند الغروب', url: 'data:image/webp;base64,AAAA' },
    });
    expect(next.assets['pic']).toEqual({
      ...asset('pic'),
      alt: 'نخيل عند الغروب',
      url: 'data:image/webp;base64,AAAA',
    });
  });

  it('refuses an unknown asset and an empty patch', () => {
    expectRefusal(
      richSite(),
      'updateAsset',
      { id: 'ghost', patch: { alt: 'x' } },
      /does not exist/,
    );
    expectRefusal(
      richSite(),
      'updateAsset',
      { id: 'pic', patch: {} },
      /Invalid command arguments/,
      'cmd/invalid-args',
    );
  });

  it('removes an unused asset and refuses one still referenced, naming where', () => {
    expect(Object.keys(run(richSite(), 'removeAsset', { id: 'spare' }).assets)).toEqual(['pic']);
    expectRefusal(
      richSite(),
      'removeAsset',
      { id: 'pic' },
      /still used \(1\): page "home" › node "photo" › props\.src/,
    );
  });
});

describe('through the site kernel: one transaction, one Undo', () => {
  function kernel() {
    return createSiteBuilder({
      site: richSite(),
      ports: { clock: fixedClock(), ids: seededIds('library') },
    });
  }

  const cases: [LibraryCommandName, unknown][] = [
    ['setPaletteColor', { color: { id: 'ink', name: 'Ink', value: '#111827' } }],
    ['removePaletteColor', { id: 'sand' }],
    ['setNamedStyle', { style: { id: 'pill', name: 'Pill', className: 'rounded-full px-3' } }],
    ['removeNamedStyle', { id: 'card', detach: true }],
    ['setSymbol', { symbol: { id: 'badge', name: 'Badge', tree: symbolTree } }],
    ['removeSymbol', { id: 'cta', detach: true }],
    [
      'saveTemplate',
      {
        template: {
          id: 'hero',
          name: 'Hero',
          kind: 'section',
          tree: symbolTree,
          savedAt: '2026-10-05T09:00:00Z',
        },
      },
    ],
    ['setSiteFonts', { fonts: [{ family: 'Cairo', source: 'google', weights: [700] }] }],
    ['setLibrarySettings', { settings: { smoothScroll: true } }],
    ['importDesignLibrary', { designSystem: defaultDesignSystem(), library: {} }],
    ['updateAsset', { id: 'pic', patch: { alt: 'Palms' } }],
    ['removeAsset', { id: 'spare' }],
  ];

  it.each(cases)('%s is one transaction, and Undo restores the site', (name, args) => {
    const site = kernel();
    const before = JSON.stringify(site.getSite());
    site.dispatch(name, args, 'user');
    expect(site.transactions()).toHaveLength(1);
    expect(JSON.stringify(site.getSite())).not.toBe(before);
    expect(site.undo()).toBe(true);
    expect(JSON.stringify(site.getSite())).toBe(before);
  });

  it('removeTemplate is one transaction too', () => {
    const site = kernel();
    site.dispatch(
      'saveTemplate',
      {
        template: {
          id: 't',
          name: 'T',
          kind: 'element',
          tree: symbolTree,
          savedAt: '2026-10-05T09:00:00Z',
        },
      },
      'user',
    );
    const before = JSON.stringify(site.getSite());
    site.dispatch('removeTemplate', { id: 't' }, 'user');
    expect(site.transactions()).toHaveLength(2);
    site.undo();
    expect(JSON.stringify(site.getSite())).toBe(before);
  });

  it('a refused command opens no transaction', () => {
    const site = kernel();
    expect(() => site.dispatch('removeNamedStyle', { id: 'card' }, 'user')).toThrow(/still used/);
    expect(site.transactions()).toHaveLength(0);
  });
});
