import fc, { type Arbitrary } from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  MAX_JSON_DEPTH,
  findJsonViolation,
  validateDocument,
  type BuilderDocument,
  type JsonValue,
  type Node,
  type Patch,
} from '@craftkit/builder-schema';

import { canonicalJson } from './canonical-json';
import {
  parseDocument,
  parseScope,
  projectDocument,
  projectScope,
  type CodecPorts,
} from './document-codec';
import { scopedProjection } from './scope';
import { strictParse } from './strict-parse';
import {
  builderDocumentArbitrary,
  flattenBlueprint,
  jsonNumberArbitrary,
  jsonValueAtDepthArbitrary,
  nodeIdArbitrary,
  type DocumentBlueprint,
  type RegistryVocabulary,
} from '../testing/arbitraries';

const RUNS = 1000;
const SEEDS = {
  pure: 0x4b4_1001,
  secondPrint: 0x4b4_1002,
  nonVacuous: 0x4b4_1003,
  keyOrder: 0x4b4_1004,
  scope: 0x4b4_1005,
  maxJsonDepth: 0x4b4_1006,
  parserSafetyMargin: 0x4b4_1007,
} as const;

const TYPES = new Set(['frame', 'page', 'section', 'text']);
const ports: CodecPorts = { blockExists: (type) => TYPES.has(type) };

const pageProps: Arbitrary<Record<string, JsonValue>> = fc.record({
  title: fc.string({ maxLength: 12 }),
  metric: jsonNumberArbitrary,
});
const sectionProps: Arbitrary<Record<string, JsonValue>> = fc.record({
  label: fc.string({ maxLength: 12 }),
});
const textProps: Arbitrary<Record<string, JsonValue>> = fc.record({
  content: fc.string({ maxLength: 20 }),
  score: jsonNumberArbitrary,
});

const vocabulary: RegistryVocabulary = {
  blocks: [
    {
      type: 'page',
      props: pageProps,
      slots: { default: { allow: ['section', 'text'], max: 2 } },
      bindingKeys: ['title'],
    },
    {
      type: 'section',
      props: sectionProps,
      slots: { default: { allow: ['text'], max: 2 } },
      bindingKeys: ['label'],
    },
    { type: 'text', props: textProps, bindingKeys: ['content'] },
  ],
  rootTypes: ['page'],
  surface: fc.constant('site'),
  maxDepth: 2,
  maxChildrenPerSlot: 2,
};

const documents = builderDocumentArbitrary(vocabulary);

const maxDepthDocuments = builderDocumentArbitrary({
  blocks: [
    {
      type: 'page',
      props: fc.record({ boundary: jsonValueAtDepthArbitrary(MAX_JSON_DEPTH) }),
    },
  ],
  rootTypes: ['page'],
  surface: fc.constant('site'),
  maxDepth: 0,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNode = (value: unknown): value is Node =>
  isRecord(value) &&
  typeof value['id'] === 'string' &&
  typeof value['type'] === 'string' &&
  isRecord(value['props']);

const emptyRecord = <T>(): Record<string, T> => {
  const record: Record<string, T> = {};
  Object.setPrototypeOf(record, null);
  return record;
};

const TOP_LEVEL_SCALAR_FIELDS = new Set(['schemaVersion', 'surface', 'dir', 'rootId']);

const defineOwn = <T>(record: Record<string, T>, key: string, value: T): void => {
  Object.defineProperty(record, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
};

function applyNestedNodeAdd(node: Node, patch: Patch): Node {
  if (patch.op !== 'add' || patch.path.length <= 2) {
    throw new Error('property helper expected a nested node add patch');
  }

  const updated = structuredClone(node);
  const relativePath = patch.path.slice(2);
  const last = relativePath[relativePath.length - 1];
  let target: unknown = updated;
  for (const step of relativePath.slice(0, -1)) {
    if (!isRecord(target)) {
      throw new Error('property helper received a nested patch with a missing parent');
    }
    target = target[String(step)];
  }
  if (!isRecord(target) || last === undefined) {
    throw new Error('property helper received a nested patch with a non-object parent');
  }
  defineOwn(target, String(last), patch.value);
  return updated;
}

function applyCodecPatches(base: BuilderDocument, patches: Patch[]): BuilderDocument {
  let next = base;
  for (const patch of patches) {
    if (patch.path.length === 0) {
      throw new Error('property helper refuses an empty patch path');
    }
    const [head, id] = patch.path;
    if (
      patch.path.length === 1 &&
      (head === 'schemaVersion' || head === 'surface' || head === 'dir' || head === 'rootId') &&
      patch.op === 'replace'
    ) {
      next = { ...next, [head]: patch.value };
      continue;
    }
    if (head !== 'nodes' || typeof id !== 'string') {
      throw new Error('property helper received an unsupported patch path');
    }

    if (patch.path.length > 2) {
      const current = next.nodes[id];
      if (current === undefined) {
        throw new Error('property helper cannot patch a missing node');
      }
      const nodes = emptyRecord<Node>();
      for (const key of Object.keys(next.nodes)) {
        const node = key === id ? applyNestedNodeAdd(current, patch) : next.nodes[key];
        if (node !== undefined) defineOwn(nodes, key, node);
      }
      next = { ...next, nodes };
      continue;
    }
    if (patch.path.length !== 2) {
      throw new Error('property helper received an unsupported node patch path');
    }

    const nodes = emptyRecord<Node>();
    for (const key of Object.keys(next.nodes)) {
      if (patch.op === 'remove' && key === id) continue;
      const node = next.nodes[key];
      if (node !== undefined) defineOwn(nodes, key, node);
    }
    if (patch.op === 'remove') {
      next = { ...next, nodes };
      continue;
    } else if (isNode(patch.value)) {
      defineOwn(nodes, id, patch.value);
    } else {
      throw new Error('property helper received a node patch without a node value');
    }
    next = { ...next, nodes };
  }
  return next;
}

function expectCodecPatchGranularity(patches: readonly Patch[]): void {
  for (const patch of patches) {
    const [head, id] = patch.path;
    const isNodePatch = patch.path.length === 2 && head === 'nodes' && typeof id === 'string';
    const isTopLevelScalarPatch =
      patch.path.length === 1 && typeof head === 'string' && TOP_LEVEL_SCALAR_FIELDS.has(head);

    expect(patch.path, 'codec patches must never replace the document root').not.toHaveLength(0);
    expect(
      isNodePatch || isTopLevelScalarPatch,
      'codec patches must target one node or one known top-level scalar field',
    ).toBe(true);
  }
}

const differentFrom = (doc: BuilderDocument): BuilderDocument => ({
  ...doc,
  dir: doc.dir === 'ltr' ? 'rtl' : 'ltr',
});

function reverseJsonObject(value: Record<string, JsonValue>): Record<string, JsonValue> {
  const reordered = emptyRecord<JsonValue>();
  for (const key of Object.keys(value).reverse()) {
    const entry = value[key];
    if (entry === undefined) continue;
    defineOwn(reordered, key, reverseJsonValue(entry));
  }
  return reordered;
}

function reverseJsonValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(reverseJsonValue);
  }
  return typeof value === 'object' && value !== null ? reverseJsonObject(value) : value;
}

function reorderedNode(node: Node): Node {
  const optional: Partial<Node> = {};
  if (node.slots !== undefined) {
    const slots = emptyRecord<string[]>();
    for (const key of Object.keys(node.slots).reverse()) {
      const children = node.slots[key];
      if (children !== undefined) defineOwn(slots, key, [...children]);
    }
    optional.slots = slots;
  }
  if (node.responsive !== undefined) {
    const responsive: Node['responsive'] = {};
    if (node.responsive.tablet !== undefined) {
      responsive.tablet = reverseJsonObject(node.responsive.tablet);
    }
    if (node.responsive.mobile !== undefined) {
      responsive.mobile = reverseJsonObject(node.responsive.mobile);
    }
    optional.responsive = responsive;
  }
  if (node.variantOf !== undefined) optional.variantOf = node.variantOf;
  if (node.bindings !== undefined) {
    const bindings = emptyRecord<string>();
    for (const key of Object.keys(node.bindings).reverse()) {
      const path = node.bindings[key];
      if (path !== undefined) defineOwn(bindings, key, path);
    }
    optional.bindings = bindings;
  }
  return {
    ...optional,
    props: reverseJsonObject(node.props),
    type: node.type,
    id: node.id,
  };
}

function reinsertKeysInReverse(doc: BuilderDocument): BuilderDocument {
  const nodes = emptyRecord<Node>();
  for (const id of Object.keys(doc.nodes).reverse()) {
    const node = doc.nodes[id];
    if (node !== undefined) defineOwn(nodes, id, reorderedNode(node));
  }
  // Field insertion order is intentionally the reverse of the stored type.
  return {
    nodes,
    rootId: doc.rootId,
    dir: doc.dir,
    surface: doc.surface,
    schemaVersion: doc.schemaVersion,
  };
}

function omitOwn(value: unknown, omitted: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error('omitOwn expects an object');
  const output = emptyRecord<unknown>();
  for (const key of Object.keys(value)) {
    if (key !== omitted) defineOwn(output, key, value[key]);
  }
  return output;
}

function nodeWithout(node: Node, omitted: 'bindings' | 'variantOf'): Node {
  const output: Node = { id: node.id, type: node.type, props: node.props };
  if (omitted !== 'bindings' && node.bindings !== undefined) output.bindings = node.bindings;
  if (omitted !== 'variantOf' && node.variantOf !== undefined) output.variantOf = node.variantOf;
  if (node.responsive !== undefined) output.responsive = node.responsive;
  if (node.slots !== undefined) output.slots = node.slots;
  return output;
}

interface ScopeCase {
  doc: BuilderDocument;
  selectedId: string;
}

const scopeCases: Arbitrary<ScopeCase> = fc
  .record({
    rootId: nodeIdArbitrary,
    selectedId: nodeIdArbitrary,
    childId: nodeIdArbitrary,
    siblingId: nodeIdArbitrary,
    selectedLabel: fc.string({ maxLength: 12 }),
    childContent: fc.string({ maxLength: 20 }),
    siblingContent: fc.string({ maxLength: 20 }),
  })
  .map((parts) => {
    const blueprint: DocumentBlueprint = {
      schemaVersion: 1,
      surface: 'site',
      dir: 'ltr',
      root: {
        id: parts.rootId,
        type: 'frame',
        props: {},
        slots: {
          default: [
            {
              id: parts.selectedId,
              type: 'section',
              props: { label: parts.selectedLabel },
              slots: {
                default: [
                  { id: parts.childId, type: 'text', props: { content: parts.childContent } },
                ],
              },
            },
            { id: parts.siblingId, type: 'text', props: { content: parts.siblingContent } },
          ],
        },
      },
    };
    const doc = flattenBlueprint(blueprint);
    const selectedId = doc.nodes[doc.rootId]?.slots?.['default']?.[0];
    if (selectedId === undefined) {
      throw new Error('scope blueprint did not flatten its selected child');
    }
    return { doc, selectedId };
  });

const fieldFixture = (): BuilderDocument => ({
  schemaVersion: 1,
  surface: 'site',
  dir: 'ltr',
  rootId: 'root',
  nodes: {
    root: {
      id: 'root',
      type: 'page',
      props: { title: 'Fields', metric: 0.5 },
      slots: { default: ['first', 'second'] },
    },
    first: {
      id: 'first',
      type: 'text',
      props: { content: 'First', score: Number.MIN_SAFE_INTEGER },
      bindings: { content: 'content.first' },
      variantOf: 'text.emphasis',
      responsive: {
        mobile: { content: 'Mobile' },
        tablet: { content: 'Tablet' },
      },
    },
    second: { id: 'second', type: 'text', props: { content: 'Second', score: 1 / 3 } },
  },
});

describe('the round-trip law', () => {
  it(`pure codec: parse(project(d)) reproduces d exactly (${String(RUNS)} cases, seed ${String(SEEDS.pure)})`, () => {
    fc.assert(
      fc.property(documents, (doc) => {
        const text = projectDocument(doc).text;
        const base = differentFrom(doc);
        const result = parseDocument(text, base, ports);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expectCodecPatchGranularity(result.patches);
        const applied = applyCodecPatches(base, result.patches);
        expect(applied).toEqual(doc);
        expect(projectDocument(applied).text).toBe(text);
      }),
      { numRuns: RUNS, seed: SEEDS.pure },
    );
  }, 120_000);

  it(`MAX_JSON_DEPTH boundary: parse(project(d)) reproduces a document whose deepest prop value is exactly MAX_JSON_DEPTH (${String(RUNS)} cases, seed ${String(SEEDS.maxJsonDepth)})`, () => {
    fc.assert(
      fc.property(maxDepthDocuments, (doc) => {
        const root = doc.nodes[doc.rootId];
        if (root === undefined) {
          throw new Error('max-depth generator must produce its root node');
        }
        const boundary = root.props['boundary'];
        if (boundary === undefined) {
          throw new Error('max-depth generator must produce its boundary prop');
        }
        expect(findJsonViolation(boundary)).toBeUndefined();
        expect(findJsonViolation([boundary])?.kind).toBe('max-depth');
        expect(validateDocument(doc)).toEqual([]);

        const base: BuilderDocument = {
          ...doc,
          nodes: {
            ...doc.nodes,
            [doc.rootId]: { ...root, props: { ...root.props, boundary: null } },
          },
        };
        const text = projectDocument(doc).text;
        const result = parseDocument(text, base, ports);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.patches.every((patch) => patch.path.length > 0)).toBe(true);
        expect(
          result.patches.every(
            (patch) =>
              patch.op === 'remove' ||
              (patch.value !== undefined && findJsonViolation(patch.value) === undefined),
          ),
          'every emitted value must pass the real dispatch door as its own Law-J root',
        ).toBe(true);
        expect(result.patches).toContainEqual(
          expect.objectContaining({
            op: 'add',
            path: ['nodes', doc.rootId, 'props', 'boundary'],
          }),
        );
        const applied = applyCodecPatches(base, result.patches);
        expect(applied).toEqual(doc);
        expect(projectDocument(applied).text).toBe(text);
      }),
      { numRuns: RUNS, seed: SEEDS.maxJsonDepth },
    );
  }, 120_000);

  it('valid MAX_JSON_DEPTH documents cannot reach the strict parser depth safety message', () => {
    fc.assert(
      fc.property(maxDepthDocuments, (doc) => {
        const root = doc.nodes[doc.rootId];
        const boundary = root?.props['boundary'];
        if (root === undefined || boundary === undefined) {
          throw new Error('max-depth generator must produce its boundary prop');
        }
        const deepestPlacement: BuilderDocument = {
          ...doc,
          nodes: {
            ...doc.nodes,
            [doc.rootId]: {
              ...root,
              responsive: { mobile: { boundary } },
            },
          },
        };

        expect(validateDocument(deepestPlacement)).toEqual([]);
        const parsed = strictParse(projectDocument(deepestPlacement).text);
        if (!parsed.ok) {
          expect(parsed.errors.map((error) => error.message)).not.toContainEqual(
            expect.stringContaining('JSON nesting exceeds the supported depth'),
          );
        }
        expect(parsed.ok).toBe(true);
      }),
      { numRuns: 1, seed: SEEDS.parserSafetyMargin },
    );
  });

  it(`second-print idempotence: project(parse(project(d))) equals project(d) (${String(RUNS)} cases, seed ${String(SEEDS.secondPrint)})`, () => {
    fc.assert(
      fc.property(documents, (doc) => {
        const first = projectDocument(doc).text;
        const result = parseDocument(first, differentFrom(doc), ports);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expectCodecPatchGranularity(result.patches);
        expect(projectDocument(applyCodecPatches(differentFrom(doc), result.patches)).text).toBe(
          first,
        );
      }),
      { numRuns: RUNS, seed: SEEDS.secondPrint },
    );
  }, 120_000);

  it(`NON-VACUOUS: base differs from edited, patches are non-empty, and applying yields edited (${String(RUNS)} cases, seed ${String(SEEDS.nonVacuous)})`, () => {
    fc.assert(
      fc.property(documents, (base) => {
        const edited = differentFrom(base);
        expect(edited).not.toEqual(base);
        const result = parseDocument(projectDocument(edited).text, base, ports);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expectCodecPatchGranularity(result.patches);
        expect(result.patches.length).toBeGreaterThanOrEqual(1);
        const applied = applyCodecPatches(base, result.patches);
        expect(applied).toEqual(edited);
        expect(projectDocument(applied).text).toBe(projectDocument(edited).text);
      }),
      { numRuns: RUNS, seed: SEEDS.nonVacuous },
    );
  }, 120_000);

  it(`key-order metamorphism: reinserting node and prop keys cannot change canonical text (${String(RUNS)} cases, seed ${String(SEEDS.keyOrder)})`, () => {
    fc.assert(
      fc.property(documents, (doc) => {
        expect(projectDocument(reinsertKeysInReverse(doc)).text).toBe(projectDocument(doc).text);
      }),
      { numRuns: RUNS, seed: SEEDS.keyOrder },
    );
  }, 120_000);

  it(`scope isolation: every node outside the selected subtree stays byte-identical (${String(RUNS)} cases, seed ${String(SEEDS.scope)})`, () => {
    fc.assert(
      fc.property(scopeCases, ({ doc: base, selectedId }) => {
        const selected = base.nodes[selectedId];
        if (selected === undefined) throw new Error('selected node missing');
        const currentLabel = selected.props['label'];
        if (typeof currentLabel !== 'string') throw new Error('selected label missing');
        const edited: BuilderDocument = {
          ...base,
          nodes: {
            ...base.nodes,
            [selectedId]: {
              ...selected,
              props: { ...selected.props, label: `edited:${currentLabel}` },
            },
          },
        };
        const scopeIds = new Set(Object.keys(scopedProjection(base, selectedId).nodes));
        const outside = new Map(
          Object.keys(base.nodes)
            .filter((id) => !scopeIds.has(id))
            .map((id) => [id, canonicalJson(base.nodes[id])]),
        );
        const result = parseScope(projectScope(edited, selectedId).text, base, selectedId, ports);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expectCodecPatchGranularity(result.patches);
        expect(
          result.patches.every(
            (patch) => typeof patch.path[1] === 'string' && scopeIds.has(patch.path[1]),
          ),
        ).toBe(true);
        const applied = applyCodecPatches(base, result.patches);
        expect(projectDocument(applied).text).toBe(projectDocument(edited).text);
        for (const [id, bytes] of outside) {
          expect(canonicalJson(applied.nodes[id])).toBe(bytes);
        }
      }),
      { numRuns: RUNS, seed: SEEDS.scope },
    );
  }, 120_000);

  it('invalid text: every proper prefix returns one-based errors and zero patches', () => {
    const base = fieldFixture();
    const text = projectDocument(base).text;

    for (let end = 0; end < text.length; end += 1) {
      const prefix = text.slice(0, end);
      const result = parseDocument(prefix, base, ports);
      expect(result.ok).toBe(false);
      expect(result).not.toHaveProperty('patches');
      if (!result.ok) {
        const availableLines = prefix.split('\n').length;
        expect(result.errors.length).toBeGreaterThan(0);
        expect(
          result.errors.every((error) => error.line >= 1 && error.line <= availableLines),
        ).toBe(true);
      }
    }
  }, 120_000);
});

describe('property proof harness patch granularity', () => {
  it('throws before applying an empty-path root replacement', () => {
    const base = fieldFixture();

    expect(() =>
      applyCodecPatches(base, [{ op: 'replace', path: [], value: structuredClone(base) }]),
    ).toThrow('property helper refuses an empty patch path');
  });
});

describe('field mutants', () => {
  it('drop id is detected as an error', () => {
    const base = fieldFixture();
    const first = base.nodes['first'];
    if (first === undefined) throw new Error('field fixture missing');
    const withoutId = omitOwn(first, 'id');
    const text = canonicalJson({ ...base, nodes: { ...base.nodes, first: withoutId } });

    expect(parseDocument(text, base, ports).ok).toBe(false);
  });

  it('change id is detected as an error instead of being invented or repaired', () => {
    const base = fieldFixture();
    const first = base.nodes['first'];
    if (first === undefined) throw new Error('field fixture missing');
    const text = canonicalJson({
      ...base,
      nodes: { ...base.nodes, first: { ...first, id: 'changed-id' } },
    });

    expect(parseDocument(text, base, ports).ok).toBe(false);
  });

  it.each([
    [
      'slot order',
      (base: BuilderDocument): BuilderDocument => {
        const root = base.nodes['root'];
        if (root === undefined) throw new Error('field fixture root missing');
        return {
          ...base,
          nodes: { ...base.nodes, root: { ...root, slots: { default: ['second', 'first'] } } },
        };
      },
    ],
    [
      'bindings',
      (base: BuilderDocument): BuilderDocument => {
        const first = base.nodes['first'];
        if (first === undefined) throw new Error('field fixture missing');
        const withoutBindings = nodeWithout(first, 'bindings');
        return { ...base, nodes: { ...base.nodes, first: withoutBindings } };
      },
    ],
    [
      'mobile breakpoint',
      (base: BuilderDocument): BuilderDocument => {
        const first = base.nodes['first'];
        if (first === undefined) throw new Error('field fixture missing');
        return {
          ...base,
          nodes: {
            ...base.nodes,
            first: { ...first, responsive: { tablet: first.responsive?.tablet ?? {} } },
          },
        };
      },
    ],
    [
      'tablet breakpoint',
      (base: BuilderDocument): BuilderDocument => {
        const first = base.nodes['first'];
        if (first === undefined) throw new Error('field fixture missing');
        return {
          ...base,
          nodes: {
            ...base.nodes,
            first: { ...first, responsive: { mobile: first.responsive?.mobile ?? {} } },
          },
        };
      },
    ],
    [
      'variantOf',
      (base: BuilderDocument): BuilderDocument => {
        const first = base.nodes['first'];
        if (first === undefined) throw new Error('field fixture missing');
        const withoutVariant = nodeWithout(first, 'variantOf');
        return { ...base, nodes: { ...base.nodes, first: withoutVariant } };
      },
    ],
  ] as const)('%s mutation is detected as a non-empty exact edit', (_name, mutate) => {
    const base = fieldFixture();
    const edited = mutate(base);
    const result = parseDocument(projectDocument(edited).text, base, ports);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patches.length).toBeGreaterThan(0);
    expect(projectDocument(applyCodecPatches(base, result.patches)).text).toBe(
      projectDocument(edited).text,
    );
  });

  it.each([
    ['drop envelope', (scope: ReturnType<typeof scopedProjection>) => omitOwn(scope, 'envelope')],
    [
      'change envelope',
      (scope: ReturnType<typeof scopedProjection>) => ({ ...scope, envelope: 2 }),
    ],
    [
      'drop envelope rootId',
      (scope: ReturnType<typeof scopedProjection>) => omitOwn(scope, 'rootId'),
    ],
    [
      'change envelope rootId',
      (scope: ReturnType<typeof scopedProjection>) => ({ ...scope, rootId: 'different-root' }),
    ],
    [
      'drop envelope nodes',
      (scope: ReturnType<typeof scopedProjection>) => omitOwn(scope, 'nodes'),
    ],
    [
      'change envelope nodes',
      (scope: ReturnType<typeof scopedProjection>) => ({ ...scope, nodes: [] }),
    ],
  ] as const)('%s is detected as a scoped parse error', (_name, mutate) => {
    const base = fieldFixture();
    const text = canonicalJson(mutate(scopedProjection(base, 'root')));
    const result = parseScope(text, base, 'root', ports);

    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty('patches');
  });
});
