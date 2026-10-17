import fc, { type Arbitrary } from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  MAX_JSON_DEPTH,
  findJsonViolation,
  isJsonValue,
  validateDocument,
  type BuilderDocument,
  type JsonValue,
} from '@craftkit/builder-schema';

import {
  EDGE_NODE_IDS,
  JSON_NUMBER_EDGE_CASES,
  blueprintArbitrary,
  builderDocumentArbitrary,
  flattenBlueprint,
  jsonNumberArbitrary,
  jsonObjectArbitrary,
  jsonValueAtDepthArbitrary,
  jsonValueArbitrary,
  nodeIdArbitrary,
  type DocumentBlueprint,
  type RegistryVocabulary,
} from './arbitraries';

const GENERATOR_SEED = 0x4b4_2026;

const pageProps: Arbitrary<Record<string, JsonValue>> = fc.record({
  title: fc.string({ maxLength: 12 }),
  weight: jsonNumberArbitrary,
});
const sectionProps: Arbitrary<Record<string, JsonValue>> = fc.record({
  gap: fc.constantFrom('sm', 'md', 'lg'),
});
const textProps: Arbitrary<Record<string, JsonValue>> = fc.record({
  content: fc.string({ maxLength: 20 }),
  score: jsonNumberArbitrary,
});

const vocabulary = (assertValid?: RegistryVocabulary['assertValid']): RegistryVocabulary => ({
  blocks: [
    {
      type: 'page',
      props: pageProps,
      slots: { default: { allow: ['section', 'text'], max: 2 } },
      bindingKeys: ['title', 'items'],
    },
    {
      type: 'section',
      props: sectionProps,
      slots: { default: { allow: ['text'], max: 2 } },
      bindingKeys: [],
    },
    { type: 'text', props: textProps, bindingKeys: ['content'] },
  ],
  rootTypes: ['page'],
  surface: fc.constant('site'),
  maxDepth: 2,
  maxChildrenPerSlot: 2,
  assertValid,
});

const mapState = (present: boolean, value: object | undefined): string => {
  if (!present) return 'absent';
  return value !== undefined && Object.keys(value).length > 0 ? 'present' : 'empty';
};

const assertVocabularyRelations = (doc: BuilderDocument): void => {
  for (const node of Object.values(doc.nodes)) {
    if (node.type === 'page') {
      for (const childId of node.slots?.['default'] ?? []) {
        expect(['section', 'text']).toContain(doc.nodes[childId]?.type);
      }
      expect(node.slots?.['default']?.length ?? 0).toBeLessThanOrEqual(2);
    } else if (node.type === 'section') {
      for (const childId of node.slots?.['default'] ?? []) {
        expect(doc.nodes[childId]?.type).toBe('text');
      }
      expect(node.slots?.['default']?.length ?? 0).toBeLessThanOrEqual(2);
    } else {
      expect(node.type).toBe('text');
      expect(Object.keys(node.slots ?? {})).toHaveLength(0);
    }
  }
};

describe('registry-directed document arbitraries', () => {
  it('generates 1,000 structurally valid documents and asserts validation on every one', () => {
    let assertionCount = 0;
    const arbitrary = builderDocumentArbitrary(
      vocabulary((doc) => {
        assertionCount += 1;
        assertVocabularyRelations(doc);
        return [];
      }),
    );

    fc.assert(
      fc.property(arbitrary, (doc) => {
        expect(validateDocument(doc)).toEqual([]);
        expect(Object.keys(doc.nodes)).toHaveLength(new Set(Object.keys(doc.nodes)).size);
        for (const [key, node] of Object.entries(doc.nodes)) {
          expect(node.id).toBe(key);
        }
      }),
      { numRuns: 1000, seed: GENERATOR_SEED },
    );
    expect(assertionCount).toBe(1000);
  }, 120_000);

  it('covers absent, present-empty, and present maps without generating empty slot arrays', () => {
    const documents = fc.sample(builderDocumentArbitrary(vocabulary()), {
      numRuns: 500,
      seed: GENERATOR_SEED,
    });
    const bindings = new Set<string>();
    const responsive = new Set<string>();
    const slots = new Set<string>();
    const variants = new Set<string>();

    for (const doc of documents) {
      for (const node of Object.values(doc.nodes)) {
        bindings.add(mapState(Object.hasOwn(node, 'bindings'), node.bindings));
        responsive.add(mapState(Object.hasOwn(node, 'responsive'), node.responsive));
        slots.add(mapState(Object.hasOwn(node, 'slots'), node.slots));
        variants.add(Object.hasOwn(node, 'variantOf') ? 'present' : 'absent');
        for (const children of Object.values(node.slots ?? {})) {
          expect(children.length).toBeGreaterThan(0);
        }
      }
    }

    expect([...bindings].sort()).toEqual(['absent', 'empty', 'present']);
    expect([...responsive].sort()).toEqual(['absent', 'empty', 'present']);
    expect([...slots].sort()).toEqual(['absent', 'empty', 'present']);
    expect([...variants].sort()).toEqual(['absent', 'present']);
  }, 120_000);

  it('includes Unicode, composed/decomposed, punctuation, reserved ids, and numeric boundaries', () => {
    const ids = fc.sample(nodeIdArbitrary, { numRuns: 2000, seed: GENERATOR_SEED });
    const numbers = fc.sample(jsonNumberArbitrary, { numRuns: 2000, seed: GENERATOR_SEED });

    for (const edge of EDGE_NODE_IDS) {
      expect(ids).toContain(edge);
    }
    for (const edge of JSON_NUMBER_EDGE_CASES) {
      expect(numbers.some((value) => Object.is(value, edge))).toBe(true);
    }
  });

  it('flattens hostile ids without poisoning anything — and the validator then refuses them', () => {
    const blueprint: DocumentBlueprint = {
      schemaVersion: -0,
      surface: 'site',
      dir: 'rtl',
      root: {
        id: '__proto__',
        type: 'page',
        props: { weight: -0 },
        bindings: {},
        responsive: {},
        slots: {
          default: [
            { id: 'constructor', type: 'text', props: { content: 'first' } },
            { id: 'constructor', type: 'text', props: { content: 'second' } },
          ],
        },
      },
    };
    const doc = flattenBlueprint(blueprint);
    const children = doc.nodes['__proto__']?.slots?.['default'];

    expect(doc.rootId).toBe('__proto__');
    expect(children?.[0]).toBe('constructor');
    expect(children?.[1]).toContain('constructor#');
    expect(Object.is(doc.schemaVersion, -0)).toBe(false);
    expect(Object.is(doc.nodes['__proto__']?.props['weight'], -0)).toBe(false);
    expect(Object.hasOwn(doc.nodes['__proto__'] ?? {}, 'bindings')).toBe(true);
    expect(Object.hasOwn(doc.nodes['__proto__'] ?? {}, 'responsive')).toBe(true);
    // The flattener stays poison-proof on hostile input — but such a document
    // is no longer VALID: the kernel's patch door cannot address a reserved id,
    // so the validator refuses it and the generators never produce one. Both
    // halves are asserted, because "safe to build" and "legal to store" are
    // different claims (011 T033 review, second residual).
    expect(validateDocument(doc).map((error) => error.code)).toContain('doc/reserved-node-id');
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
  });

  it('shrinks the blueprint while every candidate remains a valid document', () => {
    const property = fc.property(blueprintArbitrary(vocabulary()), (blueprint) => {
      expect(validateDocument(flattenBlueprint(blueprint))).toEqual([]);
      return false;
    });
    const details = fc.check(property, { numRuns: 1, seed: GENERATOR_SEED });

    expect(details.failed).toBe(true);
    expect(details.numShrinks).toBeGreaterThan(0);
    const counterexample = details.counterexample;
    if (counterexample === null) throw new Error('expected a minimised blueprint');
    const minimized = counterexample[0];
    expect(validateDocument(flattenBlueprint(minimized))).toEqual([]);
  });

  it('fails an invalid generated document as an assertion instead of filtering it away', () => {
    const arbitrary = builderDocumentArbitrary(vocabulary(() => ['registry rejected props']));

    expect(() => fc.sample(arbitrary, { numRuns: 1, seed: GENERATOR_SEED })).toThrow(
      'registry assertion',
    );
  });

  it('uses bounded defaults when optional vocabulary controls are omitted', () => {
    const minimal: RegistryVocabulary = {
      blocks: [
        {
          type: 'page',
          props: fc.constant({}),
          slots: { default: { allow: ['page'] } },
        },
      ],
      rootTypes: ['page'],
    };
    const documents = fc.sample(builderDocumentArbitrary(minimal), {
      numRuns: 20,
      seed: GENERATOR_SEED,
    });

    for (const doc of documents) {
      expect(doc.surface).toBe('site');
      expect(validateDocument(doc)).toEqual([]);
    }
  });

  it.each([
    [
      'duplicate types',
      {
        blocks: [
          { type: 'page', props: pageProps },
          { type: 'page', props: pageProps },
        ],
        rootTypes: ['page'],
      },
    ],
    [
      'an unknown allowed type',
      {
        blocks: [
          {
            type: 'page',
            props: pageProps,
            slots: { default: { allow: ['missing'] } },
          },
        ],
        rootTypes: ['page'],
      },
    ],
    [
      'a zero slot capacity',
      {
        blocks: [
          {
            type: 'page',
            props: pageProps,
            slots: { default: { allow: ['page'], max: 0 } },
          },
        ],
        rootTypes: ['page'],
      },
    ],
  ] as const)('refuses %s before generation starts', (_name, invalid) => {
    expect(() => builderDocumentArbitrary(invalid)).toThrow();
  });
});

describe('JSON support arbitraries', () => {
  it('generate only JSON-pure recursive values and objects', () => {
    fc.assert(
      fc.property(jsonValueArbitrary(3), (value) => {
        expect(isJsonValue(value)).toBe(true);
      }),
      { numRuns: 1000, seed: GENERATOR_SEED },
    );
    fc.assert(
      fc.property(jsonObjectArbitrary(3), (value) => {
        expect(isJsonValue(value)).toBe(true);
        expect(Array.isArray(value)).toBe(false);
      }),
      { numRuns: 1000, seed: GENERATOR_SEED + 1 },
    );
  }, 120_000);

  it('generates values exactly at MAX_JSON_DEPTH without leaving the valid domain', () => {
    fc.assert(
      fc.property(jsonValueAtDepthArbitrary(), (value) => {
        expect(findJsonViolation(value)).toBeUndefined();
        expect(findJsonViolation([value])?.kind).toBe('max-depth');
      }),
      { numRuns: 1000, seed: GENERATOR_SEED + 2 },
    );
  }, 120_000);

  it.each([-1, MAX_JSON_DEPTH + 1, 1.5])('refuses unsupported exact depth %s', (depth) => {
    expect(() => jsonValueAtDepthArbitrary(depth)).toThrow('JSON arbitrary depth');
  });
});
