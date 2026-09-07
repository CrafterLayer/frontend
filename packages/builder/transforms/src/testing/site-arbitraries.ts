import fc, { type Arbitrary } from 'fast-check';

import {
  defaultDesignSystem,
  validateSite,
  type AssetEntry,
  type BuilderDocument,
  type BuilderSite,
  type SharedRegion,
} from '@craftkit/builder-schema';

/**
 * Generated SITES, for laws that have to hold over more than three fixtures.
 *
 * ## Why the invariants are built and not filtered
 *
 * `validateSite` demands exactly one home page, unique ids and addresses, every
 * wired region present, and every page document in the site's own direction.
 * A generator that produced sites freely and filtered the invalid ones away
 * would silently shrink its domain until a law held over almost nothing — and
 * `fast-check` would report a healthy case count the whole time. So the
 * invariants are CONSTRUCTED, and the assertion at the end is what proves the
 * construction honest rather than merely confident.
 *
 * ## What varies
 *
 * Page count and order (the home page is wherever it lands), region count and
 * kind, which pages opt into which region, the asset table, the direction, and
 * every page's document. What does not vary is validity.
 */

const PAGE_IDS = ['home', 'about', 'work', 'contact', 'pricing'] as const;
const REGION_IDS = ['masthead', 'colophon'] as const;
const ASSET_IDS = ['hero', 'portrait', 'kiln'] as const;

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

export function assetFixture(id: string): AssetEntry {
  return {
    id,
    url: `https://example.test/${id}.png`,
    description: id,
    mood: [],
    palette: [],
    alt: id,
    width: 800,
    height: 600,
  };
}

export interface SiteArbitraryOptions {
  /** Documents for pages and regions. Usually `builderDocumentArbitrary(...)`. */
  readonly documents: Arbitrary<BuilderDocument>;
  readonly maxPages?: number | undefined;
  readonly maxRegions?: number | undefined;
  readonly maxAssets?: number | undefined;
}

interface SiteSeed {
  dir: BuilderSite['dir'];
  pageIds: readonly string[];
  homeIndex: number;
  regionIds: readonly string[];
  regionKinds: readonly ('header' | 'footer')[];
  pageDocuments: readonly BuilderDocument[];
  regionDocuments: readonly BuilderDocument[];
  wiring: readonly number[];
  metadata: readonly { title: string; purpose: string; audience: string }[];
  assetCount: number;
}

const withDir = (document: BuilderDocument, dir: BuilderSite['dir']): BuilderDocument => ({
  ...document,
  dir,
});

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
  const pages: BuilderSite['pages'][number][] = [];
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
      /* A bitmask, so "which pages opted in" varies rather than being all or none. */
      regions: seed.regionIds.filter((_unused, slot) => ((mask >> slot) & 1) === 1),
    });
  });

  const assets = emptyRecord<AssetEntry>();
  for (const id of ASSET_IDS.slice(0, seed.assetCount)) {
    defineOwn(assets, id, assetFixture(id));
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

export function builderSiteArbitrary(options: SiteArbitraryOptions): Arbitrary<BuilderSite> {
  const maxPages = Math.min(options.maxPages ?? 4, PAGE_IDS.length);
  const maxRegions = Math.min(options.maxRegions ?? 2, REGION_IDS.length);
  const maxAssets = Math.min(options.maxAssets ?? 2, ASSET_IDS.length);

  return fc
    .record({
      dir: fc.constantFrom('ltr' as const, 'rtl' as const),
      pageIds: fc.uniqueArray(fc.constantFrom(...PAGE_IDS), { minLength: 1, maxLength: maxPages }),
      homeIndex: fc.nat({ max: maxPages - 1 }),
      regionIds: fc.uniqueArray(fc.constantFrom(...REGION_IDS), {
        minLength: 0,
        maxLength: maxRegions,
      }),
      regionKinds: fc.array(fc.constantFrom('header' as const, 'footer' as const), {
        minLength: maxRegions,
        maxLength: maxRegions,
      }),
      pageDocuments: fc.array(options.documents, { minLength: maxPages, maxLength: maxPages }),
      regionDocuments: fc.array(options.documents, {
        minLength: Math.max(maxRegions, 1),
        maxLength: Math.max(maxRegions, 1),
      }),
      wiring: fc.array(fc.nat({ max: (1 << maxRegions) - 1 }), {
        minLength: maxPages,
        maxLength: maxPages,
      }),
      metadata: fc.array(
        fc.record({
          title: fc.string({ maxLength: 10 }),
          purpose: fc.string({ maxLength: 10 }),
          audience: fc.string({ maxLength: 10 }),
        }),
        { minLength: maxPages, maxLength: maxPages },
      ),
      assetCount: fc.nat({ max: maxAssets }),
    })
    .map(buildSite);
}
