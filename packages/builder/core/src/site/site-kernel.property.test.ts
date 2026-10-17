import fc, { type Arbitrary } from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  defaultDesignSystem,
  LATEST_SCHEMA_VERSION,
  LATEST_SITE_VERSION,
  type BuilderSite,
  type SitePage,
} from '@craftkit/builder-schema';

import { fixedClock, seededIds } from '../testing/fixed-ports';
import { fixtureBlocks } from '../testing/fixtures';
import { createSiteBuilder, type BuilderSiteKernel } from './create-site-builder';
import type { SiteGroupStep } from './site-dispatcher';

/**
 * The site kernel's laws, stated as properties rather than examples.
 *
 * An example test says "this group behaved". A property says "no group of these
 * commands, in any order, over any of these pages, can behave otherwise" — and
 * that is the claim the plan actually makes about atomicity and page
 * independence (SC-013, SC-014).
 */

const RUNS = 200;
const SEED = 0x51_7e0d;

/*
  A property test with 200 runs is not a five-second test, and vitest's default
  says it is. Each run constructs a whole kernel — canonicalise, validate,
  register extensions — so the file takes ~5.5s on an idle machine and blew the
  default the first time the full repository suite ran everything at once. The
  honest fix is to say how long these actually need rather than to thin the
  properties until they fit a limit that was never about them.
*/
const PROPERTY_TIMEOUT_MS = 60_000;

/*
  A two-node page, not `landingFixture()`.
  Every run builds a fresh kernel, and construction canonicalises AND validates
  the whole site — which re-parses every page document through zod. With the
  six-node fixture across four pages, 200 runs blew the 5s timeout on three of
  the properties below. Nothing these properties claim depends on how much is
  IN a page: what varies is the shape of the group. The node the steps write to
  is still `p1`, so the commands are unchanged.
*/
function page(id: string, address: string): SitePage {
  return {
    id,
    address,
    title: id,
    purpose: 'property',
    audience: 'property',
    document: {
      schemaVersion: LATEST_SCHEMA_VERSION,
      surface: 'site',
      dir: 'ltr',
      rootId: 'root',
      nodes: {
        root: { id: 'root', type: 'page', props: {}, slots: { default: ['p1'] } },
        p1: { id: 'p1', type: 'text', props: { content: 'seed' } },
      },
    },
    regions: [],
  };
}

function siteOf(count: number): BuilderSite {
  return {
    siteVersion: LATEST_SITE_VERSION,
    dir: 'ltr',
    pages: [
      page('home', '/'),
      ...Array.from({ length: count - 1 }, (_, i) => page(`p${String(i)}`, `/p${String(i)}`)),
    ],
    sharedRegions: {},
    designSystem: defaultDesignSystem(),
    assets: {},
  };
}

function kernelOf(count: number, seed = 's'): BuilderSiteKernel {
  return createSiteBuilder({
    site: siteOf(count),
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(), ids: seededIds(seed) },
  });
}

/**
 * The page id at `index`, definite.
 *
 * `pages()[i]` is `string | undefined` under `noUncheckedIndexedAccess`, and
 * `SiteGroupStep.pageId` refuses `undefined` under `exactOptionalPropertyTypes`
 * — correctly, since "no page id" and "the page id undefined" are different
 * things. The arbitrary only produces indices the site has, so this throws
 * rather than papering over a mismatch that would mean the test is wrong.
 */
function pageAt(kernel: BuilderSiteKernel, index: number): string {
  const id = kernel.pages()[index];
  if (id === undefined) {
    throw new Error(`This property built a site without a page at index ${String(index)}.`);
  }
  return id;
}

/** A step a fixture page always accepts, so the property tests atomicity and not luck. */
interface Step {
  pageIndex: number;
  value: string;
}

const stepArbitrary: Arbitrary<Step> = fc.record({
  pageIndex: fc.integer({ min: 0, max: 3 }),
  value: fc.string({ maxLength: 24 }),
});

describe('site kernel properties', () => {
  it(
    'SC-014: a group only ever changes the pages it names',
    () => {
      fc.assert(
        fc.property(fc.array(stepArbitrary, { minLength: 1, maxLength: 6 }), (steps) => {
          const kernel = kernelOf(4);
          const before = kernel.getSite().pages.map((p) => JSON.stringify(p.document));
          const touched = new Set(steps.map((step) => step.pageIndex));

          kernel.dispatchGroup(
            steps.map((step) => ({
              command: 'setProp',
              args: { id: 'p1', key: 'content', value: step.value },
              pageId: pageAt(kernel, step.pageIndex),
            })),
          );

          const after = kernel.getSite().pages.map((p) => JSON.stringify(p.document));
          for (const [index, doc] of after.entries()) {
            if (touched.has(index)) continue;
            // Byte-identical, not merely valid: an untouched page must not move.
            expect(doc).toBe(before[index]);
          }
        }),
        { numRuns: RUNS, seed: SEED },
      );
    },
    PROPERTY_TIMEOUT_MS,
  );

  it(
    'one group is ONE transaction, whatever it touched',
    () => {
      fc.assert(
        fc.property(fc.array(stepArbitrary, { minLength: 1, maxLength: 6 }), (steps) => {
          const kernel = kernelOf(4);

          kernel.dispatchGroup(
            steps.map((step) => ({
              command: 'setProp',
              args: { id: 'p1', key: 'content', value: step.value },
              pageId: pageAt(kernel, step.pageIndex),
            })),
          );

          // Zero when every step was a no-op; never more than one.
          expect(kernel.transactions().length).toBeLessThanOrEqual(1);
        }),
        { numRuns: RUNS, seed: SEED },
      );
    },
    PROPERTY_TIMEOUT_MS,
  );

  it(
    'one undo restores the site byte for byte',
    () => {
      fc.assert(
        fc.property(fc.array(stepArbitrary, { minLength: 1, maxLength: 6 }), (steps) => {
          const kernel = kernelOf(4);
          const before = JSON.stringify(kernel.getSite());

          kernel.dispatchGroup(
            steps.map((step) => ({
              command: 'setProp',
              args: { id: 'p1', key: 'content', value: step.value },
              pageId: pageAt(kernel, step.pageIndex),
            })),
          );
          if (kernel.canUndo()) {
            expect(kernel.undo()).toBe(true);
          }

          expect(JSON.stringify(kernel.getSite())).toBe(before);
        }),
        { numRuns: RUNS, seed: SEED },
      );
    },
    PROPERTY_TIMEOUT_MS,
  );

  it(
    'a refused step leaves the site exactly as it was',
    () => {
      fc.assert(
        fc.property(
          fc.array(stepArbitrary, { minLength: 1, maxLength: 4 }),
          fc.integer({ min: 0, max: 4 }),
          (steps, at) => {
            const kernel = kernelOf(4);
            const before = JSON.stringify(kernel.getSite());
            const written: SiteGroupStep[] = steps.map((step) => ({
              command: 'setProp',
              args: { id: 'p1', key: 'content', value: step.value },
              pageId: pageAt(kernel, step.pageIndex),
            }));
            // A refusal inserted at an arbitrary position: `/` is always taken.
            // No `pageId`: `addPage` is a SITE command and names no page.
            const position = Math.min(at, written.length);
            written.splice(position, 0, {
              command: 'addPage',
              args: { address: '/', title: 'Clash' },
            });

            expect(() => kernel.dispatchGroup(written)).toThrow();
            expect(JSON.stringify(kernel.getSite())).toBe(before);
            expect(kernel.transactions()).toHaveLength(0);
          },
        ),
        { numRuns: RUNS, seed: SEED },
      );
    },
    PROPERTY_TIMEOUT_MS,
  );

  it(
    'SC-013: the same seed builds the same site, ids included',
    () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 12 }), { minLength: 1, maxLength: 5 }),
          (titles) => {
            const build = (): string => {
              const kernel = kernelOf(1, 'deterministic');
              titles.forEach((title, index) => {
                kernel.dispatch('addPage', { address: `/a${String(index)}`, title });
              });
              return JSON.stringify(kernel.getSite());
            };

            // Same seed, same ports, same commands — byte-identical, including the
            // ids `addPage` minted through the injected id port (Law D).
            expect(build()).toBe(build());
          },
        ),
        { numRuns: 60, seed: SEED },
      );
    },
    PROPERTY_TIMEOUT_MS,
  );

  it(
    'every accepted group leaves a site the validator still accepts',
    () => {
      fc.assert(
        fc.property(fc.array(stepArbitrary, { minLength: 1, maxLength: 6 }), (steps) => {
          const kernel = kernelOf(4);

          kernel.dispatchGroup(
            steps.map((step) => ({
              command: 'setProp',
              args: { id: 'p1', key: 'content', value: step.value },
              pageId: pageAt(kernel, step.pageIndex),
            })),
          );

          expect(kernel.validate().ok).toBe(true);
        }),
        { numRuns: RUNS, seed: SEED },
      );
    },
    PROPERTY_TIMEOUT_MS,
  );
});
