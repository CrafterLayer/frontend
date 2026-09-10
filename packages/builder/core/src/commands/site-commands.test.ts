import { produceWithPatches } from 'immer';
import { describe, expect, it } from 'vitest';

import { z } from 'zod';

import {
  BuilderError,
  defineBlockSchema,
  imagePropSchema,
  type TrustedExtensionManifest,
  defaultDesignSystem,
  emptyDocument,
  LATEST_SITE_VERSION,
  type AssetEntry,
  type BlockSchemaLookup,
  type BuilderDocument,
  type BuilderSite,
  type CommandRuntime,
  type RegisteredSiteCommand,
  type SharedRegion,
  type SitePage,
  validateSite,
} from '@craftkit/builder-schema';

import { createBuilder } from '../kernel/create-builder';
import { fivePageSite, onePageSite } from '@craftkit/builder-schema/testing';

import { createSiteBuilder } from '../site/create-site-builder';
import { fixedClock, seededIds } from '../testing/fixed-ports';
import { fixtureBlocks, landingFixture } from '../testing/fixtures';
import {
  isSiteCommandName,
  siteCommands,
  type SiteCommandName,
  type SiteCommands,
} from './site-commands';

/**
 * T026 — the refusals.
 *
 * These commands are the site's single door, so what they REFUSE is the
 * contract. Every test below drives one command to a state `validateSite` would
 * have caught later and asserts two things: it threw, and the draft is
 * unchanged. The second half is the one that matters — a command that refuses
 * after writing half of its change leaves a site nobody asked for.
 */

/*
  The same lookup the kernel builds (`create-builder.ts:148`): `registry.block`
  returns the REGISTERED block — schema plus its renderer — and the validator
  wants the schema. Reading `.block(type)` straight into `CommandRuntime.blocks`
  typechecks and then crashes inside `validatePropsAgainstSchema`, which is how
  this line got written twice.
*/
/*
  A LOCAL vocabulary for the asset-reference refusal, rather than an `image`
  block added to the shared `fixtureBlocks`: that fixture is imported by four
  packages, and widening it to prove one refusal here would change the block
  list every one of them validates against.
*/
const assetBlocks: TrustedExtensionManifest = {
  tier: 1,
  name: 'site-command-asset-blocks',
  version: '0.0.1',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'region-root',
          description: 'Root of a shared region, for asset-reference tests.',
          props: z.object({}),
          slots: { default: { allow: ['image'] } },
          examples: [],
        }),
        render: () => null,
      },
      {
        schema: defineBlockSchema({
          type: 'image',
          description: 'An image that references the site asset library.',
          props: z.object({ src: imagePropSchema, alt: z.string().default('') }),
          examples: [],
        }),
        render: () => null,
      },
    ],
  },
};

const registry = createBuilder({ extensions: [fixtureBlocks, assetBlocks] }).context.registry;
const blocks: BlockSchemaLookup = (type) => registry.block(type)?.schema;

function runtime(seed = 's'): CommandRuntime {
  return { ids: seededIds(seed), blocks, compositions: () => undefined };
}

function page(id: string, address: string): SitePage {
  return {
    id,
    address,
    title: id,
    purpose: 'test',
    audience: 'test',
    document: landingFixture(),
    regions: [],
  };
}

function region(id: string, kind: 'header' | 'footer' = 'header'): SharedRegion {
  return { id, kind, document: emptyDocument('site', 'ltr') };
}

/** A region document whose only child references `assetId`. */
function regionWithImage(assetId: string): BuilderDocument {
  return {
    ...emptyDocument('site', 'ltr'),
    rootId: 'root',
    nodes: {
      root: { id: 'root', type: 'region-root', props: {}, slots: { default: ['pic'] } },
      pic: { id: 'pic', type: 'image', props: { src: { assetId }, alt: 'Logo' } },
    },
  };
}

function asset(id: string): AssetEntry {
  return {
    id,
    url: `https://cdn.example.com/${id}.jpg`,
    description: 'a photograph',
    mood: ['calm'],
    palette: ['#111827'],
    alt: 'A photograph',
    width: 1200,
    height: 800,
  };
}

function site(overrides: Partial<BuilderSite> = {}): BuilderSite {
  return {
    siteVersion: LATEST_SITE_VERSION,
    dir: 'ltr',
    pages: [page('home', '/'), page('about', '/about')],
    sharedRegions: {},
    designSystem: defaultDesignSystem(),
    assets: {},
    ...overrides,
  };
}

/** Run one command over a site exactly as the dispatcher will: one production. */
function run<N extends SiteCommandName>(
  base: BuilderSite,
  name: N,
  args: SiteCommands[N],
  rt: CommandRuntime = runtime(),
): BuilderSite {
  const command: RegisteredSiteCommand = siteCommands[name];
  const [next] = produceWithPatches(base, (draft) => {
    command.apply(args)(draft, rt);
  });
  return next;
}

/**
 * Assert a command refuses AND writes nothing.
 *
 * The `before` snapshot is taken by value, so a command that mutated the draft
 * and then threw would still fail this — immer discards the draft on a throw,
 * but the assertion does not depend on that being true, which is the point.
 */
function expectRefusal<N extends SiteCommandName>(
  base: BuilderSite,
  name: N,
  args: SiteCommands[N],
  pattern: RegExp,
  code:
    | 'site/structural-violation'
    | 'site/invalid-patch'
    | 'cmd/invalid-args' = 'site/structural-violation',
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

describe('addPage', () => {
  it('adds a page in the site direction, at the end by default', () => {
    const next = run(site(), 'addPage', { address: '/pricing', title: 'Pricing' });

    expect(next.pages.map((p) => p.address)).toEqual(['/', '/about', '/pricing']);
    expect(next.pages[2]?.document.dir).toBe('ltr');
    expect(next.pages[2]?.id).toBe('s-0001');
    expect(validateSite(next).ok).toBe(true);
  });

  it('is born in the site direction, not the default one', () => {
    const rtl = site({
      dir: 'rtl',
      pages: [{ ...page('home', '/'), document: { ...landingFixture(), dir: 'rtl' } }],
    });

    const next = run(rtl, 'addPage', { address: '/عنا', title: 'عنا' });

    // Not `emptyDocument()`'s default 'ltr' — a page born ltr in an rtl site is
    // invalid the instant it exists.
    expect(next.pages[1]?.document.dir).toBe('rtl');
    expect(validateSite(next).ok).toBe(true);
  });

  it('inserts at an explicit index', () => {
    const next = run(site(), 'addPage', { address: '/work', title: 'Work', index: 1 });
    expect(next.pages.map((p) => p.address)).toEqual(['/', '/work', '/about']);
  });

  it('refuses a duplicate address', () => {
    expectRefusal(site(), 'addPage', { address: '/about', title: 'Again' }, /already lives at/);
  });

  it('refuses an address that is not a path', () => {
    expectRefusal(site(), 'addPage', { address: 'about', title: 'About' }, /must start with/);
  });

  it('refuses an unknown shared region', () => {
    expectRefusal(
      site(),
      'addPage',
      { address: '/x', title: 'X', regions: ['nav'] },
      /does not exist/,
    );
  });

  it('refuses an index past the end rather than clamping it', () => {
    expectRefusal(site(), 'addPage', { address: '/x', title: 'X', index: 9 }, /index 9/);
  });
});

describe('removePage', () => {
  it('removes a page', () => {
    const next = run(site(), 'removePage', { pageId: 'about' });
    expect(next.pages.map((p) => p.id)).toEqual(['home']);
    expect(validateSite(next).ok).toBe(true);
  });

  it('refuses the home page — the one page a site cannot be without', () => {
    expectRefusal(site(), 'removePage', { pageId: 'home' }, /home page cannot be removed/);
  });

  it('refuses an unknown page', () => {
    expectRefusal(site(), 'removePage', { pageId: 'ghost' }, /does not exist/);
  });

  it('refuses the LAST remaining page — stated as the contract states it', () => {
    /*
      site-model.md §2 lists "the last remaining page" and "the home page while
      others exist" as two refusals. One rule covers both: a valid site holds
      exactly one page at "/", so the last page IS the home page. Asserted
      separately anyway, because the contract's reader will look for it.
    */
    const single = site({ pages: [page('home', '/')] });
    expectRefusal(single, 'removePage', { pageId: 'home' }, /home page cannot be removed/);
  });
});

describe('renamePage', () => {
  it('changes title and address together, in one production', () => {
    const next = run(site(), 'renamePage', {
      pageId: 'about',
      title: 'Our story',
      address: '/story',
    });
    expect(next.pages[1]).toMatchObject({ title: 'Our story', address: '/story' });
  });

  it('refuses a rename that changes nothing', () => {
    expectRefusal(site(), 'renamePage', { pageId: 'about' }, /needs a title/, 'cmd/invalid-args');
  });

  it('refuses taking an address another page already holds', () => {
    expectRefusal(site(), 'renamePage', { pageId: 'about', address: '/' }, /already lives at/);
  });

  it('refuses moving the home page off "/"', () => {
    expectRefusal(site(), 'renamePage', { pageId: 'home', address: '/start' }, /must stay at/);
  });

  it('lets a page keep its own address while its title changes', () => {
    const next = run(site(), 'renamePage', {
      pageId: 'about',
      title: 'About us',
      address: '/about',
    });
    expect(next.pages[1]?.title).toBe('About us');
  });
});

describe('reorderPage', () => {
  it('moves a page to a new position', () => {
    const next = run(site(), 'reorderPage', { pageId: 'about', toIndex: 0 });
    expect(next.pages.map((p) => p.id)).toEqual(['about', 'home']);
  });

  it('refuses an index the site does not have', () => {
    expectRefusal(site(), 'reorderPage', { pageId: 'about', toIndex: 5 }, /index 5/);
  });
});

describe('setSharedRegion', () => {
  it('creates a region and lets a page adopt it', () => {
    const withRegion = run(site(), 'setSharedRegion', {
      regionId: 'nav',
      kind: 'header',
      document: emptyDocument('site', 'ltr'),
    });
    const next = run(withRegion, 'setPageRegions', { pageId: 'home', regions: ['nav'] });

    expect(next.sharedRegions['nav']?.kind).toBe('header');
    expect(next.pages[0]?.regions).toEqual(['nav']);
    expect(validateSite(next).ok).toBe(true);
  });

  it('refuses a region whose direction disagrees with the site', () => {
    expectRefusal(
      site(),
      'setSharedRegion',
      { regionId: 'nav', kind: 'header', document: emptyDocument('site', 'rtl') },
      /does not match site direction/,
    );
  });

  it('refuses a region document the document validator rejects', () => {
    const orphaned = emptyDocument('site', 'ltr');
    expectRefusal(
      site(),
      'setSharedRegion',
      {
        regionId: 'nav',
        kind: 'header',
        document: {
          ...orphaned,
          nodes: { ...orphaned.nodes, loose: { id: 'loose', type: 'text', props: {} } },
        },
      },
      /not a valid document/,
    );
  });

  it('refuses a region that references an asset the site does not hold', () => {
    /*
      site-model.md §2, sixth refusal. `validateDocument` passes this document
      happily — it knows nothing about the site's asset library — so without the
      site-level check the region lands and the fault surfaces later as
      `unresolved-asset-reference` on a region nobody had just touched.
    */
    expectRefusal(
      site(),
      'setSharedRegion',
      { regionId: 'nav', kind: 'header', document: regionWithImage('missing') },
      /references an asset the site does not hold/,
    );
  });

  it('accepts the same region once the asset is registered', () => {
    const withAsset = run(site(), 'registerAsset', { entry: asset('logo') });

    const next = run(withAsset, 'setSharedRegion', {
      regionId: 'nav',
      kind: 'header',
      document: regionWithImage('logo'),
    });

    // Same document, same command: only the asset library changed.
    expect(next.sharedRegions['nav']).toBeDefined();
  });

  it('deletes a region nobody uses', () => {
    const withRegion = site({ sharedRegions: { nav: region('nav') } });
    const next = run(withRegion, 'setSharedRegion', {
      regionId: 'nav',
      kind: 'header',
      document: null,
    });
    expect(next.sharedRegions['nav']).toBeUndefined();
  });

  it('refuses to delete a region a page still points at', () => {
    const used = site({
      sharedRegions: { nav: region('nav') },
      pages: [{ ...page('home', '/'), regions: ['nav'] }],
    });
    expectRefusal(
      used,
      'setSharedRegion',
      { regionId: 'nav', kind: 'header', document: null },
      /still used by 1 page/,
    );
  });
});

describe('setPageRegions', () => {
  it('refuses an unknown region', () => {
    expectRefusal(site(), 'setPageRegions', { pageId: 'home', regions: ['nav'] }, /does not exist/);
  });

  it('refuses the same region listed twice', () => {
    const withRegion = site({ sharedRegions: { nav: region('nav') } });
    expectRefusal(
      withRegion,
      'setPageRegions',
      { pageId: 'home', regions: ['nav', 'nav'] },
      /listed twice/,
    );
  });
});

describe('setDesignToken', () => {
  it('repaints one token', () => {
    const next = run(site(), 'setDesignToken', { token: 'accent', value: '#1d4ed8' });
    expect(next.designSystem.tokens.accent).toBe('#1d4ed8');
    expect(validateSite(next).ok).toBe(true);
  });

  it('refuses a token the vocabulary does not have', () => {
    expectRefusal(
      site(),
      'setDesignToken',
      { token: 'brandPurple' as never, value: '#6d28d9' },
      /not a token in the site's vocabulary/,
    );
  });

  it('refuses a colour that makes a DECLARED pairing unreadable (FR-014)', () => {
    /*
      `textMuted` on `surface` is one of the seven pairings the default system
      declares legible, measured at 4.83:1. Pushing it to near-white drops it
      under 4.5 — and the door has to refuse, because the person who typed the
      colour is the only one who can still pick a different one.
    */
    expectRefusal(
      site(),
      'setDesignToken',
      { token: 'textMuted', value: '#f5f5f5' },
      /would not be legible/,
    );
  });
});

describe('setDesignSystem', () => {
  it('refuses a system whose own pairings fail', () => {
    const base = defaultDesignSystem();
    expectRefusal(
      site(),
      'setDesignSystem',
      { system: { ...base, tokens: { ...base.tokens, text: '#fafafa' } } },
      /would not be legible/,
    );
  });

  it('accepts a legible replacement', () => {
    const base = defaultDesignSystem();
    const next = run(site(), 'setDesignSystem', {
      system: { ...base, name: 'Clinic', seed: 'clinic-2026' },
    });
    expect(next.designSystem.name).toBe('Clinic');
    expect(validateSite(next).ok).toBe(true);
  });
});

describe('registerAsset', () => {
  it('registers an asset a page can then reference', () => {
    const next = run(site(), 'registerAsset', { entry: asset('hero') });
    expect(next.assets['hero']?.url).toContain('hero.jpg');
  });

  it('refuses a second registration under the same id', () => {
    const once = run(site(), 'registerAsset', { entry: asset('hero') });
    expectRefusal(once, 'registerAsset', { entry: asset('hero') }, /already registered/);
  });
});

describe('setSiteDirection', () => {
  it('turns the site, its pages, and its regions in ONE production', () => {
    const base = site({ sharedRegions: { nav: region('nav') } });

    const next = run(base, 'setSiteDirection', { dir: 'rtl' });

    expect(next.dir).toBe('rtl');
    expect(next.pages.every((p) => p.document.dir === 'rtl')).toBe(true);
    expect(next.sharedRegions['nav']?.document.dir).toBe('rtl');
    /*
      The claim this test exists for: there is no intermediate state in which
      the site turned and the pages did not. If the command set only `dir`, the
      site below would carry one `page-direction-mismatch` per page.
    */
    expect(validateSite(next).ok).toBe(true);
  });

  it('refuses a direction the site already has, rather than logging an empty change', () => {
    expectRefusal(site(), 'setSiteDirection', { dir: 'ltr' }, /already "ltr"/);
  });
});

describe('applySitePatches', () => {
  it('applies a batch and validates the whole site', () => {
    const next = run(site(), 'applySitePatches', {
      patches: [{ op: 'replace', path: ['pages', 1, 'title'], value: 'About us' }],
    });
    expect(next.pages[1]?.title).toBe('About us');
  });

  it('refuses a batch that changes siteVersion (Law M)', () => {
    expectRefusal(
      site(),
      'applySitePatches',
      { patches: [{ op: 'replace', path: ['siteVersion'], value: 99 }] },
      /may not change siteVersion/,
      'site/invalid-patch',
    );
  });

  it('refuses a batch that produces an invalid site', () => {
    expectRefusal(
      site(),
      'applySitePatches',
      { patches: [{ op: 'replace', path: ['pages', 0, 'address'], value: '/start' }] },
      /invalid site/,
      'site/invalid-patch',
    );
  });

  it('refuses a reserved path segment before it can reach the prototype', () => {
    expectRefusal(
      site(),
      'applySitePatches',
      { patches: [{ op: 'replace', path: ['__proto__', 'polluted'], value: true }] },
      /reserved object key/,
      'cmd/invalid-args',
    );
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('refuses an empty batch', () => {
    expectRefusal(site(), 'applySitePatches', { patches: [] }, /./, 'cmd/invalid-args');
  });
});

describe('the door itself', () => {
  it('parses args before any handler runs (Law V)', () => {
    expectRefusal(
      site(),
      'addPage',
      { address: '', title: 'X' },
      /Invalid command arguments/,
      'cmd/invalid-args',
    );
  });

  it('rejects an unknown argument rather than ignoring it', () => {
    expectRefusal(
      site(),
      'addPage',
      { address: '/x', title: 'X', slug: 'x' } as unknown as SiteCommands['addPage'],
      /Invalid command arguments/,
      'cmd/invalid-args',
    );
  });

  it('routes a name to the site draft, and leaves page names alone', () => {
    expect(isSiteCommandName('addPage')).toBe(true);
    expect(isSiteCommandName('applySitePatches')).toBe(true);
    // A page command, so the dispatcher must route it to the page's document.
    expect(isSiteCommandName('setProp')).toBe(false);
    // Not a prototype key masquerading as a command.
    expect(isSiteCommandName('toString')).toBe(false);
    expect(isSiteCommandName('constructor')).toBe(false);
  });

  it('registers the legacy and v2 site commands through one door', () => {
    expect(Object.keys(siteCommands).sort()).toEqual(
      [
        'addPage',
        'applyCodeChanges',
        'clearPage',
        'createCodeProject',
        'duplicatePage',
        'setCodePage',
        'setHomePage',
        'applySitePatches',
        'registerAsset',
        'removePage',
        'renamePage',
        'reorderPage',
        'setDesignSystem',
        'setDesignToken',
        'setPageRegions',
        'setSharedRegion',
        'setSiteDirection',
      ].sort(),
    );
  });
});

describe('a group whose steps read back what an earlier step wrote', () => {
  it('sets two design tokens in ONE group', () => {
    const kernel = createSiteBuilder({
      site: onePageSite(),
      ports: { clock: fixedClock(), ids: seededIds('group') },
    });

    /*
      This threw "[Immer] 'current' expects a draft" until `snapshot` learned to
      tolerate a plain value. The first step assigns a freshly built design
      system, which leaves an ordinary object where a proxy was; the second step
      then reads it back. Either step alone worked, so no single-command test
      could have found it — it took a group.
    */
    kernel.dispatchGroup(
      [
        { command: 'setDesignToken', args: { token: 'accent', value: '#0b5cff' } },
        { command: 'setDesignToken', args: { token: 'success', value: '#0f7a3d' } },
      ],
      { author: 'user', label: 'Recolour' },
    );

    const tokens = kernel.getSite().designSystem.tokens;
    expect(tokens.accent).toBe('#0b5cff');
    expect(tokens.success).toBe('#0f7a3d');
    /* Both edits, one entry in history — the point of a group. */
    expect(kernel.transactions()).toHaveLength(1);
  });
});

/**
 * FR-005: navigation is DERIVED from the page set, so it can never disagree
 * with it.
 *
 * There is no navigation model to keep in step — the entries a site has are the
 * pages it has, read at render time. That is what this describes: every command
 * that changes the page set changes exactly one entry, and no command can
 * produce an entry with no page or a page with no entry.
 */
describe('navigation follows the page set (FR-005)', () => {
  const navigation = (kernel: ReturnType<typeof createSiteBuilder>) =>
    kernel.getSite().pages.map((page) => ({ address: page.address, title: page.title }));

  const siteKernel = () =>
    createSiteBuilder({
      site: fivePageSite(),
      ports: { clock: fixedClock(), ids: seededIds('nav') },
    });

  it('adds exactly one entry, in the place the page was added', () => {
    const kernel = siteKernel();
    const before = navigation(kernel);

    kernel.dispatch('addPage', { address: '/journal', title: 'Journal', index: 1 }, 'user');

    const after = navigation(kernel);
    expect(after).toHaveLength(before.length + 1);
    expect(after[1]).toEqual({ address: '/journal', title: 'Journal' });
    /* Everything else, in order, untouched. */
    expect([after[0], ...after.slice(2)]).toEqual(before);
  });

  it('removes exactly one entry', () => {
    const kernel = siteKernel();
    const before = navigation(kernel);
    const victim = kernel.getSite().pages.find((page) => page.address === '/work');
    if (victim === undefined) throw new Error('the fixture must have a work page');

    kernel.dispatch('removePage', { pageId: victim.id }, 'user');

    const after = navigation(kernel);
    expect(after).toEqual(before.filter((entry) => entry.address !== '/work'));
  });

  it('renames exactly one entry, and moves none', () => {
    const kernel = siteKernel();
    const before = navigation(kernel);
    const page = kernel.getSite().pages.find((entry) => entry.address === '/about');
    if (page === undefined) throw new Error('the fixture must have an about page');

    kernel.dispatch('renamePage', { pageId: page.id, title: 'Our story' }, 'user');

    const after = navigation(kernel);
    expect(after.map((entry) => entry.address)).toEqual(before.map((entry) => entry.address));
    expect(after.filter((entry, at) => entry.title !== before[at]?.title)).toEqual([
      { address: '/about', title: 'Our story' },
    ]);
  });

  it('reorders without adding, removing or renaming anything', () => {
    const kernel = siteKernel();
    const before = navigation(kernel);
    const page = kernel.getSite().pages[0];
    if (page === undefined) throw new Error('the fixture must have pages');

    kernel.dispatch('reorderPage', { pageId: page.id, toIndex: 3 }, 'user');

    const after = navigation(kernel);
    /* Same SET, different order — which is what a reorder is and nothing more. */
    expect([...after].sort((a, b) => a.address.localeCompare(b.address))).toEqual(
      [...before].sort((a, b) => a.address.localeCompare(b.address)),
    );
    expect(after).not.toEqual(before);
  });

  it('cannot produce an entry with no page, because there is no entry to produce', () => {
    const kernel = siteKernel();
    /*
      The strong form of FR-005: navigation is not stored, so there is nothing
      that could drift. Every entry IS a page, by construction, and the only way
      to break that would be to add a navigation model — which is exactly what
      this test exists to keep anyone from doing quietly.
    */
    for (const entry of navigation(kernel)) {
      expect(kernel.getSite().pages.some((page) => page.address === entry.address)).toBe(true);
    }
    expect(navigation(kernel)).toHaveLength(kernel.getSite().pages.length);
  });
});
