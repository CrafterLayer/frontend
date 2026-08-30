import fc, { type Arbitrary } from 'fast-check';
import { describe, expect, it } from 'vitest';

import { validateDocument } from '../document/validate';
import {
  LATEST_SCHEMA_VERSION,
  type BuilderDocument,
  type ContentDirection,
} from '../document/types';
import { LATEST_SITE_VERSION, type BuilderSite } from './types';
import { validateSite } from './validate';

const RUNS = 200;
const SEED = 0x513_0014;

interface PageSeed {
  title: string;
  purpose: string;
  audience: string;
  nodeType: string;
}

const pageSeedArbitrary: Arbitrary<PageSeed> = fc.record({
  title: fc.string({ maxLength: 24 }),
  purpose: fc.string({ maxLength: 48 }),
  audience: fc.string({ maxLength: 32 }),
  nodeType: fc.string({ minLength: 1, maxLength: 20 }),
});

const siteArbitrary: Arbitrary<BuilderSite> = fc
  .tuple(
    fc.constantFrom<ContentDirection>('ltr', 'rtl'),
    fc.array(pageSeedArbitrary, { minLength: 1, maxLength: 8 }),
  )
  .map(([dir, pageSeeds]) => ({
    siteVersion: LATEST_SITE_VERSION,
    dir,
    pages: pageSeeds.map((seed, index) => {
      const rootId = `root-${String(index)}`;
      const document: BuilderDocument = {
        schemaVersion: LATEST_SCHEMA_VERSION,
        surface: 'site',
        dir,
        rootId,
        nodes: {
          [rootId]: {
            id: rootId,
            type: seed.nodeType,
            props: { title: seed.title, ordinal: index },
          },
        },
      };

      return {
        id: `page-${String(index)}`,
        address: index === 0 ? '/' : `/page-${String(index)}`,
        title: seed.title,
        purpose: seed.purpose,
        audience: seed.audience,
        document,
        regions: [],
      };
    }),
    sharedRegions: {},
    designSystem: { name: 'Generated', tokens: {} },
    assets: {},
  }));

describe('site page independence (SC-014)', () => {
  it(`every page lifted out of a generated site validates alone (${String(RUNS)} cases, seed ${String(SEED)})`, () => {
    let generatedSites = 0;
    let liftedPages = 0;

    fc.assert(
      fc.property(siteArbitrary, (site) => {
        generatedSites += 1;
        expect(validateSite(site).ok).toBe(true);
        for (const page of site.pages) {
          liftedPages += 1;
          expect(page.document.schemaVersion).toBe(LATEST_SCHEMA_VERSION);
          expect(validateDocument(page.document)).toEqual([]);
        }
      }),
      { numRuns: RUNS, seed: SEED },
    );

    /*
      A property that generated nothing passes vacuously. Counting the sites and
      the pages lifted out of them is what makes the green tick mean something:
      200 sites were built and every page in every one of them was checked
      alone.
    */
    expect(generatedSites).toBe(RUNS);
    expect(liftedPages).toBeGreaterThanOrEqual(RUNS);
  });
});
