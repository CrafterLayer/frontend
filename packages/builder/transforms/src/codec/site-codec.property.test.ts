import fc, { type Arbitrary } from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  defaultDesignSystem,
  validateSite,
  type AssetEntry,
  type BuilderDocument,
  type BuilderSite,
  type Patch,
  type SharedRegion,
  type SharedRegionKind,
  type SitePage,
} from '@craftkit/builder-schema';

import { canonicalJson } from './canonical-json';
import { parseDocument, projectDocument, type CodecPorts } from './document-codec';
import {
  parseSite,
  parseSiteManifest,
  projectSite,
  projectSiteManifest,
  projectSitePage,
  projectSiteRegion,
  type SiteProjectionText,
} from './site-codec';
import { builderDocumentArbitrary, type RegistryVocabulary } from '../testing/arbitraries';

/**
 * The site codec's laws.
 *
 * Three of them, and they are deliberately layered rather than merged:
 *
 * 1. THE MANIFEST LAW — `parse(project(m))` reproduces the manifest exactly,
 *    whatever base it is parsed against.
 * 2. THE COMPOSITION LAW — a site projection is exactly one manifest text plus
 *    one text per page and region; it loses nothing, and it does not depend on
 *    the order those texts are handed back in.
 * 3. THE NON-VACUITY GATE — a parser that returns no patches must FAIL, so a
 *    codec cannot pass by refusing to do anything.
 *
 * The per-page round-trip law is NOT restated here. `round-trip.property.test.ts`
 * proves `parse(project(d)) ≡ d` over 1,000 generated documents, and this file
 * proves that the site codec calls that same codec — byte for byte, patch for
 * patch — rather than growing a second implementation beside it. That is the
 * whole point of the reuse test below: a second document codec inside the site
 * codec would be a second answer to one question, and the two would drift.
 *
 * Every law runs 1,000 cases at a FIXED seed, in the package's own `pnpm test`,
 * so a change that breaks one blocks the merge rather than being noticed later.
 */

const RUNS = 1000;

/**
 * These laws declare their own budget, and the number is measured rather than
 * guessed.
 *
 * A case here generates SIX documents — four pages and two shared regions —
 * then projects, parses, and applies a whole site; a thousand of them is about
 * four and a half seconds of real work on an idle machine. The package's
 * default is five, which is a global default and not a considered budget for
 * this file: it passes alone and fails the moment the workspace suite runs two
 * packages at once, which is the least useful way for a test to fail.
 *
 * The alternative was to cut the case count, and it was rejected: 1,000 cases
 * at a fixed seed is the law's strength, and trading it for a green run under
 * load would be tuning the gate rather than the code.
 */
const LAW_TIMEOUT = 60_000;
const SEEDS = {
  manifest: 0x51e_2001,
  composition: 0x51e_2002,
  nonVacuous: 0x51e_2003,
  order: 0x51e_2004,
  reuse: 0x51e_2005,
} as const;

const TYPES = new Set(['page', 'section', 'text']);
const ports: CodecPorts = { blockExists: (type) => TYPES.has(type) };

const vocabulary: RegistryVocabulary = {
  blocks: [
    {
      type: 'page',
      props: fc.record({ title: fc.string({ maxLength: 8 }) }),
      slots: { default: { allow: ['section', 'text'], max: 2 } },
    },
    {
      type: 'section',
      props: fc.record({ label: fc.string({ maxLength: 8 }) }),
      slots: { default: { allow: ['text'], max: 2 } },
    },
    { type: 'text', props: fc.record({ content: fc.string({ maxLength: 12 }) }) },
  ],
  rootTypes: ['page'],
  surface: fc.constant('site'),
  maxDepth: 2,
  maxChildrenPerSlot: 2,
};

const documents = builderDocumentArbitrary(vocabulary);

const PAGE_IDS = ['home', 'about', 'work', 'contact'] as const;
const REGION_IDS = ['masthead', 'colophon'] as const;
const ASSET_IDS = ['hero', 'portrait'] as const;

const emptyRecord = <T>(): Record<string, T> => {
  const record: Record<string, T> = {};
  Object.setPrototypeOf(record, null);
  return record;
};

const defineOwn = <T>(record: Record<string, T>, key: string, value: T): void => {
  Object.defineProperty(record, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
};

const asset = (id: string): AssetEntry => ({
  id,
  url: `https://example.test/${id}.png`,
  description: id,
  mood: [],
  palette: [],
  alt: id,
  width: 800,
  height: 600,
});

const withDir = (document: BuilderDocument, dir: BuilderSite['dir']): BuilderDocument => ({
  ...document,
  dir,
});

const same = (left: unknown, right: unknown): boolean => canonicalJson(left) === canonicalJson(right);

interface SiteSeed {
  dir: BuilderSite['dir'];
  pageIds: readonly string[];
  homeIndex: number;
  regionIds: readonly string[];
  regionKinds: readonly SharedRegionKind[];
  pageDocuments: readonly BuilderDocument[];
  regionDocuments: readonly BuilderDocument[];
  wiring: readonly number[];
  metadata: readonly { title: string; purpose: string; audience: string }[];
  assetCount: number;
}

/**
 * A site that `validateSite` accepts, by construction.
 *
 * The invariants it has to satisfy are not decorative — exactly one home page,
 * unique ids and addresses, every wired region present, every page document in
 * the site's own direction — so they are BUILT rather than filtered. Filtering
 * would silently shrink the generated domain until a law held over almost
 * nothing; the assertion at the end is what proves the construction is honest.
 */
function buildSite(seed: SiteSeed): BuilderSite {
  const sharedRegions = emptyRecord<SharedRegion>();
  seed.regionIds.forEach((id, index) => {
    const document = seed.regionDocuments[index % seed.regionDocuments.length];
    if (document === undefined) return;
    defineOwn(sharedRegions, id, {
      id,
      kind: seed.regionKinds[index] ?? 'header',
      document: withDir(document, seed.dir),
    });
  });

  const home = seed.homeIndex % seed.pageIds.length;
  const pages: SitePage[] = [];
  seed.pageIds.forEach((id, index) => {
    const document = seed.pageDocuments[index % seed.pageDocuments.length];
    const meta = seed.metadata[index % seed.metadata.length];
    if (document === undefined || meta === undefined) return;
    const mask = seed.wiring[index] ?? 0;
    pages.push({
      id,
      address: index === home ? '/' : `/${id}`,
      title: meta.title,
      purpose: meta.purpose,
      audience: meta.audience,
      document: withDir(document, seed.dir),
      regions: seed.regionIds.filter((_, slot) => ((mask >> slot) & 1) === 1),
    });
  });

  const assets = emptyRecord<AssetEntry>();
  for (const id of ASSET_IDS.slice(0, seed.assetCount)) {
    defineOwn(assets, id, asset(id));
  }

  const site: BuilderSite = {
    siteVersion: 1,
    dir: seed.dir,
    pages,
    sharedRegions,
    designSystem: defaultDesignSystem(),
    assets,
  };

  const validation = validateSite(site);
  if (!validation.ok) {
    throw new Error(
      `the site generator produced an invalid site: ${validation.issues[0]?.message ?? 'unknown'}`,
    );
  }
  return site;
}

const metadataArbitrary = fc.record({
  title: fc.string({ maxLength: 10 }),
  purpose: fc.string({ maxLength: 10 }),
  audience: fc.string({ maxLength: 10 }),
});

const sites: Arbitrary<BuilderSite> = fc
  .record({
    dir: fc.constantFrom('ltr' as const, 'rtl' as const),
    pageIds: fc.uniqueArray(fc.constantFrom(...PAGE_IDS), { minLength: 1, maxLength: 4 }),
    homeIndex: fc.nat({ max: 3 }),
    regionIds: fc.uniqueArray(fc.constantFrom(...REGION_IDS), { minLength: 0, maxLength: 2 }),
    regionKinds: fc.array(fc.constantFrom('header' as const, 'footer' as const), {
      minLength: 2,
      maxLength: 2,
    }),
    pageDocuments: fc.array(documents, { minLength: 4, maxLength: 4 }),
    regionDocuments: fc.array(documents, { minLength: 2, maxLength: 2 }),
    wiring: fc.array(fc.nat({ max: 3 }), { minLength: 4, maxLength: 4 }),
    metadata: fc.array(metadataArbitrary, { minLength: 4, maxLength: 4 }),
    assetCount: fc.nat({ max: 2 }),
  })
  .map(buildSite);

/* ── The patch harness ────────────────────────────────────────────────────── */

/**
 * A faithful mirror of the kernel's `applyOnePatch`, and nothing more.
 *
 * It refuses an empty path exactly as the door does, because a codec that
 * replaced the site root would satisfy a naive round-trip law and then be
 * rejected by the real door — the failure the document codec's own harness was
 * written to catch.
 */
function applySitePatches(base: BuilderSite, patches: readonly Patch[]): BuilderSite {
  const draft: unknown = structuredClone(base);
  for (const patch of patches) {
    if (patch.path.length === 0) {
      throw new Error('the site harness refuses an empty patch path');
    }
    applyOnePatch(draft, patch);
  }
  return draft as BuilderSite;
}

function applyOnePatch(root: unknown, patch: Patch): void {
  const last = patch.path[patch.path.length - 1];
  let target: unknown = root;
  for (const step of patch.path.slice(0, -1)) {
    if (Array.isArray(target)) {
      target = typeof step === 'number' ? target[step] : undefined;
    } else if (typeof target === 'object' && target !== null) {
      target = Object.hasOwn(target, step)
        ? (target as Record<string, unknown>)[String(step)]
        : undefined;
    } else {
      target = undefined;
    }
    if (target === undefined) {
      throw new Error(`the site harness cannot walk ${patch.path.join('/')}`);
    }
  }

  if (Array.isArray(target)) {
    if (typeof last !== 'number') {
      throw new Error('the site harness needs a numeric index for an array patch');
    }
    if (patch.op === 'add') {
      target.splice(last, 0, patch.value);
    } else if (patch.op === 'remove') {
      target.splice(last, 1);
    } else {
      target[last] = patch.value;
    }
    return;
  }

  if (typeof target !== 'object' || target === null) {
    throw new Error('the site harness found a patch parent that is not a container');
  }
  const record = target as Record<string, unknown>;
  const key = String(last);
  if (patch.op === 'remove') {
    if (!Object.hasOwn(record, key)) {
      throw new Error('the site harness cannot remove a key that does not exist');
    }
    Reflect.deleteProperty(record, key);
    return;
  }
  record[key] = patch.value;
}

/* ── Bases: sites the projection will be parsed AGAINST ───────────────────── */

/**
 * A base is not a fresh random site — it is the target site as it was BEFORE
 * some edit, which is the only situation a parse ever faces. Each mutation is
 * one thing a person can do to a site in an editor, and every one of them is
 * reversible by the patches the codec produces. A mutation that does not apply
 * to a particular site returns it unchanged, so the domain never shrinks; the
 * laws below state their non-vacuity claim only when the two sites differ.
 */
type SiteMutation = (site: BuilderSite) => BuilderSite;

const rotatePages: SiteMutation = (site) =>
  site.pages.length < 2
    ? site
    : { ...site, pages: [...site.pages.slice(1), ...site.pages.slice(0, 1)] };

const retitlePages: SiteMutation = (site) => ({
  ...site,
  pages: site.pages.map((page) => ({
    ...page,
    title: `${page.title}~`,
    purpose: `${page.purpose}~`,
    audience: `${page.audience}~`,
  })),
});

const unwireRegions: SiteMutation = (site) => ({
  ...site,
  pages: site.pages.map((page) => ({ ...page, regions: [] })),
});

const flipRegionKinds: SiteMutation = (site) => {
  const sharedRegions = emptyRecord<SharedRegion>();
  for (const id of Object.keys(site.sharedRegions)) {
    const region = site.sharedRegions[id];
    if (region === undefined) continue;
    defineOwn(sharedRegions, id, {
      ...region,
      kind: region.kind === 'header' ? 'footer' : 'header',
    });
  }
  return { ...site, sharedRegions };
};

const dropAsset: SiteMutation = (site) => {
  const keys = Object.keys(site.assets);
  const gone = keys[0];
  if (gone === undefined) return site;
  const assets = emptyRecord<AssetEntry>();
  for (const id of keys.slice(1)) {
    const entry = site.assets[id];
    if (entry !== undefined) defineOwn(assets, id, entry);
  }
  return { ...site, assets };
};

const addAsset: SiteMutation = (site) => {
  const assets = emptyRecord<AssetEntry>();
  for (const id of Object.keys(site.assets)) {
    const entry = site.assets[id];
    if (entry !== undefined) defineOwn(assets, id, entry);
  }
  defineOwn(assets, 'stranger', asset('stranger'));
  return { ...site, assets };
};

const identity: SiteMutation = (site) => site;

/** Manifest-only mutations: the page and region SETS are untouched. */
const MANIFEST_MUTATIONS: readonly SiteMutation[] = [
  identity,
  rotatePages,
  retitlePages,
  unwireRegions,
  flipRegionKinds,
  dropAsset,
  addAsset,
];

/** Removes a non-home page, so parsing the full bundle has to CREATE one back. */
const dropPage: SiteMutation = (site) => {
  const victim = site.pages.findIndex((page) => page.address !== '/');
  return victim < 0
    ? site
    : { ...site, pages: site.pages.filter((_, index) => index !== victim) };
};

/** Edits the words on every page, so the bundle's document texts have to land. */
const editDocuments: SiteMutation = (site) => ({
  ...site,
  pages: site.pages.map((page) => ({ ...page, document: editDocument(page.document) })),
});

const titleOf = (props: Record<string, unknown>): string =>
  typeof props['title'] === 'string' ? props['title'] : '';

function editDocument(document: BuilderDocument): BuilderDocument {
  const root = document.nodes[document.rootId];
  if (root === undefined) return document;
  const nodes = emptyRecord<typeof root>();
  for (const id of Object.keys(document.nodes)) {
    const node = document.nodes[id];
    if (node === undefined) continue;
    defineOwn(
      nodes,
      id,
      id === document.rootId
        ? { ...node, props: { ...node.props, title: `${titleOf(node.props)}!` } }
        : node,
    );
  }
  return { ...document, nodes };
}

const dropRegion: SiteMutation = (site) => {
  const keys = Object.keys(site.sharedRegions);
  const gone = keys[0];
  if (gone === undefined) return site;
  const sharedRegions = emptyRecord<SharedRegion>();
  for (const id of keys.slice(1)) {
    const region = site.sharedRegions[id];
    if (region !== undefined) defineOwn(sharedRegions, id, region);
  }
  return {
    ...site,
    sharedRegions,
    pages: site.pages.map((page) => ({
      ...page,
      regions: page.regions.filter((id) => id !== gone),
    })),
  };
};

const BUNDLE_MUTATIONS: readonly SiteMutation[] = [
  ...MANIFEST_MUTATIONS,
  dropPage,
  dropRegion,
  editDocuments,
];

const manifestMutations = fc.constantFrom(...MANIFEST_MUTATIONS);
const bundleMutations = fc.constantFrom(...BUNDLE_MUTATIONS);

/* ── The non-vacuity gate, stated once and reused ─────────────────────────── */

type ParseUnderTest = (target: BuilderSite, base: BuilderSite) => readonly Patch[];

/**
 * The gate a parser has to survive: when the two sites DIFFER it must produce
 * patches, and applying them must produce the target exactly.
 *
 * Written as a function rather than inline so it can be pointed at a deliberate
 * dud — see "a parser that never emits a patch FAILS this gate" below. A gate
 * that has never been shown to fail is not a gate.
 */
function runGate(parse: ParseUnderTest, target: BuilderSite, base: BuilderSite): void {
  const patches = parse(target, base);
  if (!same(target, base)) {
    expect(patches.length, 'a differing site must produce at least one patch').toBeGreaterThan(0);
  }
  expect(canonicalJson(applySitePatches(base, patches))).toBe(canonicalJson(target));
}

const manifestParse: ParseUnderTest = (target, base) => {
  const result = parseSiteManifest(projectSiteManifest(target).text, base);
  if (!result.ok) {
    throw new Error(`the manifest was refused: ${result.errors[0]?.message ?? 'unknown'}`);
  }
  return result.patches;
};

const bundleParse: ParseUnderTest = (target, base) => {
  const result = parseSite(projectSite(target), base, ports);
  if (!result.ok) {
    throw new Error(`the projection was refused: ${result.errors[0]?.message ?? 'unknown'}`);
  }
  return result.patches;
};

/* ── The laws ─────────────────────────────────────────────────────────────── */

describe('the site manifest law', () => {
  it(`parse(project(m)) reproduces the manifest exactly against any base it can reach (${String(RUNS)} cases, seed ${String(SEEDS.manifest)})`, () => {
    fc.assert(
      fc.property(sites, manifestMutations, (target, mutate) => {
        const base = mutate(target);
        runGate(manifestParse, target, base);
      }),
      { numRuns: RUNS, seed: SEEDS.manifest },
    );
  }, LAW_TIMEOUT);

  it('re-parsing a site against ITSELF asks for nothing', () => {
    fc.assert(
      fc.property(sites, (site) => {
        const result = parseSiteManifest(projectSiteManifest(site).text, site);
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.patches).toEqual([]);
      }),
      { numRuns: RUNS, seed: SEEDS.manifest },
    );
  }, LAW_TIMEOUT);
});

describe('the site composition law', () => {
  it(`a projection is EXACTLY its manifest plus one text per page and region (${String(RUNS)} cases, seed ${String(SEEDS.composition)})`, () => {
    fc.assert(
      fc.property(sites, (site) => {
        const projection = projectSite(site);
        expect(Object.keys(projection.pages).sort()).toEqual(
          site.pages.map((page) => page.id).sort(),
        );
        expect(Object.keys(projection.regions).sort()).toEqual(
          Object.keys(site.sharedRegions).sort(),
        );
        expect(projection.manifest).toBe(projectSiteManifest(site).text);
        /* One text per part and not one more: the count is the law's "exactly". */
        expect(1 + Object.keys(projection.pages).length + Object.keys(projection.regions).length)
          .toBe(1 + site.pages.length + Object.keys(site.sharedRegions).length);
      }),
      { numRuns: RUNS, seed: SEEDS.composition },
    );
  }, LAW_TIMEOUT);

  it(`the decomposition is LOSSLESS: parsing a whole projection reproduces the site (${String(RUNS)} cases, seed ${String(SEEDS.composition)})`, () => {
    fc.assert(
      fc.property(sites, bundleMutations, (target, mutate) => {
        runGate(bundleParse, target, mutate(target));
      }),
      { numRuns: RUNS, seed: SEEDS.composition },
    );
  }, LAW_TIMEOUT);

  it(`the decomposition is ORDER-INDEPENDENT: reversing the parts changes nothing (${String(RUNS)} cases, seed ${String(SEEDS.order)})`, () => {
    fc.assert(
      fc.property(sites, bundleMutations, (target, mutate) => {
        const base = mutate(target);
        const projection = projectSite(target);
        const straight = parseSite(projection, base, ports);
        const reversed = parseSite(reverseParts(projection), base, ports);
        expect(reversed.ok).toBe(straight.ok);
        expect(canonicalJson(reversed)).toBe(canonicalJson(straight));
      }),
      { numRuns: RUNS, seed: SEEDS.order },
    );
  }, LAW_TIMEOUT);
});

function reverseParts(projection: SiteProjectionText): SiteProjectionText {
  const flip = (record: Readonly<Record<string, string>>): Record<string, string> => {
    const reordered = emptyRecord<string>();
    for (const key of Object.keys(record).reverse()) {
      const value = record[key];
      if (value !== undefined) defineOwn(reordered, key, value);
    }
    return reordered;
  };
  return {
    manifest: projection.manifest,
    pages: flip(projection.pages),
    regions: flip(projection.regions),
  };
}

describe('the non-vacuity gate', () => {
  it(`a differing site always produces patches that reconstruct it (${String(RUNS)} cases, seed ${String(SEEDS.nonVacuous)})`, () => {
    fc.assert(
      fc.property(sites, bundleMutations, (target, mutate) => {
        const base = mutate(target);
        const patches = bundleParse(target, base);
        if (!same(target, base)) {
          expect(patches.length).toBeGreaterThan(0);
        }
        expect(canonicalJson(applySitePatches(base, patches))).toBe(canonicalJson(target));
      }),
      { numRuns: RUNS, seed: SEEDS.nonVacuous },
    );
  }, LAW_TIMEOUT);

  it('a parser that never emits a patch FAILS this gate', () => {
    const site = buildSite({
      dir: 'ltr',
      pageIds: ['home', 'about'],
      homeIndex: 0,
      regionIds: [],
      regionKinds: ['header', 'footer'],
      pageDocuments: [simpleDocument('one'), simpleDocument('two')],
      regionDocuments: [simpleDocument('r1'), simpleDocument('r2')],
      wiring: [0, 0, 0, 0],
      metadata: Array.from({ length: 4 }, () => ({ title: 't', purpose: 'p', audience: 'a' })),
      assetCount: 0,
    });
    const base = retitlePages(site);

    expect(() => {
      runGate(() => [], site, base);
    }).toThrow();
    /* And the real parser passes the same gate on the same pair. */
    expect(() => {
      runGate(bundleParse, site, base);
    }).not.toThrow();
  });
});

function simpleDocument(word: string): BuilderDocument {
  const nodes = emptyRecord<BuilderDocument['nodes'][string]>();
  defineOwn(nodes, 'root', { id: 'root', type: 'page', props: { title: word }, slots: {} });
  return { schemaVersion: 1, surface: 'site', dir: 'ltr', rootId: 'root', nodes };
}

describe('the per-page law is REUSED, not re-derived', () => {
  /*
    T036. The claim is not "the site codec also round-trips a page" — it is that
    there is only ONE page codec in the repository and the site codec calls it.
    Both halves are asserted: the TEXT a site projection hands out is the text
    `projectDocument` produces, and the PATCHES a site parse produces for a page
    are the patches `parseDocument` produces, re-rooted and not recomputed.

    The law those two facts inherit lives in `round-trip.property.test.ts`
    ("pure codec: parse(project(d)) reproduces d exactly"). If a second document
    codec were ever grown inside `site-codec.ts`, this test fails long before
    anyone notices the drift in a generated site.
  */
  it(`every page and region text IS projectDocument's, byte for byte (${String(RUNS)} cases, seed ${String(SEEDS.reuse)})`, () => {
    fc.assert(
      fc.property(sites, (site) => {
        const projection = projectSite(site);
        for (const page of site.pages) {
          expect(projection.pages[page.id]).toBe(projectDocument(page.document).text);
          expect(projectSitePage(site, page.id)?.text).toBe(projectDocument(page.document).text);
        }
        for (const id of Object.keys(site.sharedRegions)) {
          const region = site.sharedRegions[id];
          if (region === undefined) continue;
          expect(projection.regions[id]).toBe(projectDocument(region.document).text);
          expect(projectSiteRegion(site, id)?.text).toBe(projectDocument(region.document).text);
        }
      }),
      { numRuns: RUNS, seed: SEEDS.reuse },
    );
  }, LAW_TIMEOUT);

  it("a page edit's patches are parseDocument's patches, re-rooted", () => {
    fc.assert(
      fc.property(sites, (site) => {
        const target = editDocuments(site);
        const result = parseSite(projectSite(target), site, ports);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const expected: Patch[] = [];
        target.pages.forEach((page, index) => {
          const before = site.pages[index];
          if (before === undefined) return;
          const inner = parseDocument(
            projectDocument(page.document).text,
            before.document,
            ports,
          );
          expect(inner.ok).toBe(true);
          if (!inner.ok) return;
          for (const patch of inner.patches) {
            expected.push({ ...patch, path: ['pages', index, 'document', ...patch.path] });
          }
        });
        expect(canonicalJson(result.patches)).toBe(canonicalJson(expected));
      }),
      { numRuns: RUNS, seed: SEEDS.reuse },
    );
  }, LAW_TIMEOUT);
});

describe('what the manifest refuses', () => {
  const base = buildSite({
    dir: 'ltr',
    pageIds: ['home', 'about'],
    homeIndex: 0,
    regionIds: ['masthead'],
    regionKinds: ['header', 'footer'],
    pageDocuments: [simpleDocument('one'), simpleDocument('two')],
    regionDocuments: [simpleDocument('r1'), simpleDocument('r2')],
    wiring: [1, 1, 0, 0],
    metadata: Array.from({ length: 4 }, () => ({ title: 't', purpose: 'p', audience: 'a' })),
    assetCount: 1,
  });

  const editManifest = (change: (value: Record<string, unknown>) => void): string => {
    const value = JSON.parse(projectSiteManifest(base).text) as Record<string, unknown>;
    change(value);
    return JSON.stringify(value, null, 2);
  };

  const refusal = (text: string): string => {
    const result = parseSiteManifest(text, base);
    expect(result.ok).toBe(false);
    if (result.ok) return '';
    return result.errors.map((error) => error.message).join(' | ');
  };

  it('refuses a site version move, because migrations own that field', () => {
    expect(refusal(editManifest((value) => {
          value['siteVersion'] = 2;
        }))).toContain(
      'owned by migrations',
    );
  });

  it('refuses to create a page it has no document for, and says where to get one', () => {
    expect(
      refusal(
        editManifest((value) => {
          const pages = value['pages'] as Record<string, unknown>[];
          pages.push({
            id: 'work',
            address: '/work',
            title: 't',
            purpose: 'p',
            audience: 'a',
            regions: [],
          });
        }),
      ),
    ).toContain('addPage');
  });

  it('refuses to create a shared region it has no document for', () => {
    expect(
      refusal(
        editManifest((value) => {
          const regions = value['sharedRegions'] as Record<string, unknown>;
          regions['colophon'] = { id: 'colophon', kind: 'footer' };
        }),
      ),
    ).toContain('setSharedRegion');
  });

  it('refuses an unknown manifest field rather than dropping it', () => {
    expect(refusal(
        editManifest((value) => {
          value['notes'] = 'hello';
        }),
      )).toContain(
      'no textual site representation',
    );
  });

  it('refuses a manifest whose envelope version it does not know', () => {
    expect(refusal(
        editManifest((value) => {
          value['manifest'] = 99;
        }),
      )).toContain(
      'Unsupported site manifest version',
    );
  });

  it('refuses a site that would lose its home page', () => {
    expect(
      refusal(
        editManifest((value) => {
          const pages = value['pages'] as Record<string, unknown>[];
          const first = pages[0];
          if (first !== undefined) first['address'] = '/elsewhere';
        }),
      ),
    ).toContain('home page');
  });

  it('refuses a page wired to a shared region that does not exist', () => {
    expect(
      refusal(
        editManifest((value) => {
          const pages = value['pages'] as Record<string, unknown>[];
          const first = pages[0];
          if (first !== undefined) first['regions'] = ['ghost'];
        }),
      ),
    ).toContain('ghost');
  });

  it('reports the line the offending page is written on, not line 1', () => {
    const result = parseSiteManifest(
      editManifest((value) => {
        const pages = value['pages'] as Record<string, unknown>[];
        const second = pages[1];
        if (second !== undefined) second['regions'] = ['ghost'];
      }),
      base,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.line).toBeGreaterThan(1);
  });

  it('refuses a bundle that is missing a page it names', () => {
    const projection = projectSite(base);
    const pages = emptyRecord<string>();
    for (const id of Object.keys(projection.pages)) {
      if (id === 'about') continue;
      const text = projection.pages[id];
      if (text !== undefined) defineOwn(pages, id, text);
    }
    const result = parseSite({ ...projection, pages }, base, ports);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.message).toContain('no text for page "about"');
    }
  });

  it('refuses a bundle carrying a page the manifest does not name', () => {
    const projection = projectSite(base);
    const pages = emptyRecord<string>();
    for (const id of Object.keys(projection.pages)) {
      const text = projection.pages[id];
      if (text !== undefined) defineOwn(pages, id, text);
    }
    defineOwn(pages, 'stowaway', projectDocument(simpleDocument('x')).text);
    const result = parseSite({ ...projection, pages }, base, ports);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.message).toContain('does not name');
    }
  });

  it("names the page a broken document text belongs to, with that text's own line", () => {
    const projection = projectSite(base);
    const pages = emptyRecord<string>();
    for (const id of Object.keys(projection.pages)) {
      const text = projection.pages[id];
      if (text !== undefined) {
        defineOwn(pages, id, id === 'about' ? '{\n  "rootId": 4\n}' : text);
      }
    }
    const result = parseSite({ ...projection, pages }, base, ports);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.message).toContain('In the page "about"');
    }
  });
});
