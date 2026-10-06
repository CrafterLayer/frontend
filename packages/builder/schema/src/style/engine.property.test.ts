import fc, { type Arbitrary } from 'fast-check';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { setUtilityClassOracle } from '../custom-code/utility-vocabulary';
import {
  STYLE_PROPERTIES,
  STYLE_PROPERTY_IDS,
  styleSidesOf,
  type StylePropertyDef,
} from './catalogue';
import { sameValue, slotsForSide } from './codec';
import { applyStyleIntents, readStyle } from './engine';
import type { StyleBucket, StyleIntent, StyleState, StyleValue } from './types';

const RUNS = 400;
const SEED = 0x0517_e001;

beforeAll(() => {
  setUtilityClassOracle(() => true);
});
afterAll(() => {
  setUtilityClassOracle(undefined);
});

const RAW_SAMPLE: Readonly<Record<NonNullable<StylePropertyDef['raw']>, string>> = {
  color: '#0f766e',
  length: '17px',
  number: '0.35',
  image: 'url(https://example.test/a.png)',
  family: "'Noto Sans Arabic'",
  shadow: '0 1px 2px rgb(0 0 0 / 0.1)',
  any: '25% 75%',
};

/** Every value a property's controls can offer. */
function valuesOf(def: StylePropertyDef): StyleValue[] {
  const values: StyleValue[] = [];
  for (const step of def.scale ?? []) {
    if (step !== def.bare) values.push({ kind: 'token', token: step });
  }
  for (const option of def.options ?? []) {
    if (option.legacy !== true) values.push({ kind: 'keyword', keyword: option.value });
  }
  if (def.bare !== undefined) values.push({ kind: 'keyword', keyword: def.bare });
  if (def.palette === true) values.push({ kind: 'palette', id: 'brand-600' });
  if (def.raw !== undefined && (def.prefix !== undefined || def.sidePrefixes !== undefined)) {
    values.push({ kind: 'raw', css: RAW_SAMPLE[def.raw] });
  }
  if (def.negative === true && def.tokens !== undefined && def.tokens !== 'list') {
    values.push({ kind: 'token', token: '-2' });
  }
  return values;
}

const CLASS_PROPERTIES = STYLE_PROPERTY_IDS.map((id) => STYLE_PROPERTIES[id]).filter(
  (def) => def.storage === 'class',
);

const bucketArbitrary: Arbitrary<StyleBucket> = fc.oneof(
  fc.constantFrom<StyleBucket>('base', 'tablet', 'mobile'),
  fc.integer({ min: 320, max: 1600 }).map((maxWidth) => ({ maxWidth })),
);
const stateArbitrary = fc.constantFrom<StyleState>(
  'default',
  'hover',
  'focus',
  'active',
  'open',
  'group-hover',
);

const intentArbitrary: Arbitrary<StyleIntent> = fc
  .constantFrom(...CLASS_PROPERTIES)
  .chain((def) =>
    fc.record({
      def: fc.constant(def),
      value: fc.constantFrom(...valuesOf(def)),
      bucket: def.baseOnly === true ? fc.constant<StyleBucket>('base') : bucketArbitrary,
      state: def.baseOnly === true ? fc.constant<StyleState>('default') : stateArbitrary,
      side:
        def.sides === undefined ? fc.constant(undefined) : fc.constantFrom(...styleSidesOf(def.id)),
    }),
  )
  .map(({ def, value, bucket, state, side }) => ({
    property: def.id,
    value,
    bucket,
    state,
    ...(side === undefined ? {} : { side }),
  }));

/** Class lists an element may already carry: ours, someone else's, mixed. */
const startArbitrary = fc
  .subarray([
    'p-4',
    'max-md:p-2',
    'hover:bg-accent',
    'flex',
    'text-lg',
    'rounded-lg',
    'size-8',
    'border',
    'group',
    'ck-hero',
    'sm:p-1',
    'dark:bg-black',
    'bg-linear-to-r',
    'rtl:bg-linear-to-l',
    'overflow-hidden',
    'w-32',
    'ps-2',
    'pl-3',
    'rounded-tl-xl',
    'ck-fx-glass',
    'max-[700px]:gap-2',
  ])
  .map((classes) => classes.join(' '));

function apply(className: string, intent: StyleIntent): string {
  const result = applyStyleIntents(className, [intent], { mode: 'free' });
  if (!result.ok) throw new Error(`${JSON.stringify(intent)} on "${className}": ${result.message}`);
  return result.className;
}

describe('applyStyleIntents ⇄ readStyle (property)', () => {
  it('reads back, set here, the value just applied', () => {
    fc.assert(
      fc.property(startArbitrary, intentArbitrary, (start, intent) => {
        const className = apply(start, intent);
        const resolved = readStyle(className, { bucket: intent.bucket, state: intent.state }).get(
          intent.property,
        );
        const def = STYLE_PROPERTIES[intent.property];
        const value = intent.value;
        if (value === null) return;
        if (def.sides === undefined) {
          expect(resolved?.source, className).toBe('here');
          expect(resolved !== undefined && sameValue(resolved.value, value), className).toBe(true);
          return;
        }
        for (const slot of slotsForSide(def, intent.side ?? 'all') ?? []) {
          const side = resolved?.sides?.[slot];
          expect(side?.source, `${className} @ ${slot}`).toBe('here');
          expect(side !== undefined && sameValue(side.value, value), `${className} @ ${slot}`).toBe(
            true,
          );
        }
      }),
      { numRuns: RUNS, seed: SEED },
    );
  });

  it('is idempotent: applying the same intent twice equals applying it once', () => {
    fc.assert(
      fc.property(startArbitrary, intentArbitrary, (start, intent) => {
        const once = apply(start, intent);
        expect(apply(once, intent)).toBe(once);
      }),
      { numRuns: RUNS, seed: SEED },
    );
  });

  it('a reset removes the value it would have read', () => {
    fc.assert(
      fc.property(startArbitrary, intentArbitrary, (start, intent) => {
        const set = apply(start, intent);
        const cleared = apply(set, { ...intent, value: null });
        const resolved = readStyle(cleared, { bucket: intent.bucket, state: intent.state }).get(
          intent.property,
        );
        const def = STYLE_PROPERTIES[intent.property];
        if (def.sides === undefined) {
          expect(resolved?.source, cleared).not.toBe('here');
          return;
        }
        for (const slot of slotsForSide(def, intent.side ?? 'all') ?? []) {
          expect(resolved?.sides?.[slot]?.source, `${cleared} @ ${slot}`).not.toBe('here');
        }
      }),
      { numRuns: RUNS, seed: SEED },
    );
  });
});
