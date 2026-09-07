import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { AssetEntry } from '@craftkit/builder-schema';

import { createFixedAssetLibrary } from '../testing/fixed-asset-library';
import { selectAssets, type AssetPosition } from './select-assets';

/**
 * SC-012: zero unresolvable references, zero invented addresses.
 *
 * The two failures this proves against are not symmetrical. An unresolvable
 * reference is caught by the assembly stage and by `validateSite`, so it costs
 * a rejected run. An INVENTED address is caught by nothing at all: it satisfies
 * every schema, stores, validates, renders — and is a broken image on a
 * stranger's site. So the property is written over arbitrary libraries and
 * arbitrary positions rather than over the six fixed entries, because the
 * failure mode is a path through the code, not a value in a fixture.
 */

const WORDS = ['kiln', 'clay', 'bread', 'desk', 'hands', 'shelf', 'ورشة', 'خزف'];

const entryArbitrary = (id: string): fc.Arbitrary<AssetEntry> =>
  fc.record({
    id: fc.constant(id),
    url: fc.constant(`https://assets.example.test/${id}.jpg`),
    description: fc.subarray(WORDS, { minLength: 0 }).map((words) => words.join(' ')),
    mood: fc.subarray(['warm', 'calm', 'formal', 'craft'], { minLength: 0 }),
    palette: fc.subarray(['#c2410c', '#1f2937', '#f5f5f4'], { minLength: 0 }),
    alt: fc.subarray(WORDS, { minLength: 0 }).map((words) => words.join(' ')),
    width: fc.constant(1600),
    height: fc.constant(1067),
  });

const libraryArbitrary = fc
  .integer({ min: 0, max: 8 })
  .chain((size) =>
    fc.tuple(
      ...Array.from({ length: size }, (_unused, index) => entryArbitrary(`asset-${String(index)}`)),
    ),
  );

const positionsArbitrary: fc.Arbitrary<readonly AssetPosition[]> = fc
  .array(
    fc.subarray(WORDS, { minLength: 0 }).map((words) => words.join(' ')),
    {
      minLength: 1,
      maxLength: 10,
    },
  )
  .map((intents) => intents.map((intent, index) => ({ id: `p${String(index)}`, intent })));

describe('selectAssets — SC-012', () => {
  it('answers every position with a real reference or a labelled absence, and nothing else', async () => {
    await fc.assert(
      fc.asyncProperty(
        libraryArbitrary,
        positionsArbitrary,
        fc.string(),
        async (entries, positions, brief) => {
          const result = await selectAssets({
            brief,
            positions,
            library: createFixedAssetLibrary({ entries }),
          });

          /* Every position is answered exactly once, in order. */
          expect(result.choices.map((choice) => choice.id)).toEqual(
            positions.map((position) => position.id),
          );

          const ids = new Set(entries.map((entry) => entry.id));
          const referenced: string[] = [];

          for (const choice of result.choices) {
            if ('absent' in choice.image) {
              /* An absence a person can read. A blank one is a silent hole. */
              expect(choice.image.absent).toBe(true);
              expect(choice.image.reason.length).toBeGreaterThan(0);
              expect(choice.entry).toBeUndefined();
              continue;
            }
            /* ZERO invented addresses: the id came from the library. */
            expect(ids.has(choice.image.assetId)).toBe(true);
            /* ZERO unresolvable references: the entry travels with it. */
            expect(choice.entry?.id).toBe(choice.image.assetId);
            referenced.push(choice.image.assetId);
          }

          /* No photograph twice — three of the same picture reads as a bug. */
          expect(new Set(referenced).size).toBe(referenced.length);
          /* The site's asset table is exactly what the site references. */
          expect(result.used.map((entry) => entry.id).sort()).toEqual([...referenced].sort());
        },
      ),
      { numRuns: 200 },
    );
  });

  it('never produces a reference when the library cannot be read', async () => {
    await fc.assert(
      fc.asyncProperty(positionsArbitrary, fc.string({ minLength: 1 }), async (positions, said) => {
        const result = await selectAssets({
          brief: 'anything at all',
          positions,
          library: createFixedAssetLibrary({ unavailable: said }),
        });

        /*
          The tempting failure is a fallback: "the library is down, use a stock
          URL". That is exactly the invented address SC-012 forbids, and it is
          invisible until a visitor loads the page.
        */
        expect(result.used).toEqual([]);
        for (const choice of result.choices) {
          expect('absent' in choice.image).toBe(true);
        }
      }),
      { numRuns: 50 },
    );
  });
});
