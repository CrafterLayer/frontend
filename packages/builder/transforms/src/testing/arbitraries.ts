import fc, { type Arbitrary } from 'fast-check';

import {
  MAX_JSON_DEPTH,
  canonicalizeJsonValue,
  validateDocument,
  type Breakpoint,
  type BuilderDocument,
  type JsonValue,
  type Node,
  type NodeId,
} from '@craftkit/builder-schema';

export const EDGE_NODE_IDS = [
  'root',
  'عقدة',
  '😀',
  'é',
  'e\u0301',
  '\ud800',
  '\udfff',
  'a/b~c',
  'space id',
  'punctuation!?:,',
  'nodes',
  'envelope',
] as const;

/**
 * Reserved object keys are deliberately ABSENT from the generated domain — a
 * document holding one is invalid (Law J and `doc/reserved-node-id`), because
 * the kernel's patch door cannot address it. Generating them would assert a
 * round-trip law over documents the door refuses. The parser's SAFETY against
 * hostile text carrying them stays proven by a named test in
 * `document-codec.test.ts`, where refusal-per-line is the assertion.
 */
export const RESERVED_KEY_SAMPLES = ['__proto__', 'constructor', 'prototype'] as const;

export const JSON_NUMBER_EDGE_CASES = [
  Number.MIN_SAFE_INTEGER,
  Number.MAX_SAFE_INTEGER,
  -1,
  -0,
  0,
  1,
  -0.5,
  0.5,
  1 / 3,
] as const;

export interface SlotVocabulary {
  allow: readonly string[];
  max?: number | undefined;
}

export interface BlockVocabulary {
  type: string;
  props: Arbitrary<Record<string, JsonValue>>;
  slots?: Readonly<Record<string, SlotVocabulary>> | undefined;
  bindingKeys?: readonly string[] | undefined;
}

export interface RegistryVocabulary {
  blocks: readonly BlockVocabulary[];
  rootTypes: readonly string[];
  surface?: Arbitrary<string> | undefined;
  schemaVersion?: number | undefined;
  maxDepth?: number | undefined;
  maxChildrenPerSlot?: number | undefined;
  /** Optional registry-schema assertion; a non-empty result fails generation. */
  assertValid?: ((doc: BuilderDocument) => readonly unknown[]) | undefined;
}

export interface NodeBlueprint {
  id: string;
  type: string;
  props: Record<string, JsonValue>;
  bindings?: Record<string, string> | undefined;
  variantOf?: string | undefined;
  responsive?: Partial<Record<Breakpoint, Record<string, JsonValue>>> | undefined;
  slots?: Record<string, NodeBlueprint[]> | undefined;
}

export interface DocumentBlueprint {
  schemaVersion: number;
  surface: string;
  dir: BuilderDocument['dir'];
  root: NodeBlueprint;
}

interface CheckedVocabulary {
  blocks: Map<string, BlockVocabulary>;
  rootTypes: readonly string[];
  surface: Arbitrary<string>;
  schemaVersion: number;
  maxDepth: number;
  maxChildrenPerSlot: number;
  assertValid: ((doc: BuilderDocument) => readonly unknown[]) | undefined;
}

const hasOwn = (record: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(record, key);

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

const pickFrom = <T>(values: readonly T[], label: string): Arbitrary<T> => {
  const first = values[0];
  if (first === undefined) {
    throw new Error(`${label} must not be empty.`);
  }
  return fc.integer({ min: 0, max: values.length - 1 }).map((index) => values[index] ?? first);
};

/**
 * `fc.string` deliberately biases toward prototype-poisoning words, so the
 * filter is doing real work here, not guarding against a theoretical draw: it
 * was `fc.string` — not the edge list — that produced `constructor` and broke
 * the generated-document validity assertion once reserved ids became invalid.
 */
const notReserved = (candidate: string): boolean =>
  !RESERVED_KEY_SAMPLES.includes(candidate as (typeof RESERVED_KEY_SAMPLES)[number]);

export const nodeIdArbitrary: Arbitrary<string> = fc
  .oneof(pickFrom(EDGE_NODE_IDS, 'edge node ids'), fc.string({ minLength: 1, maxLength: 16 }))
  .filter(notReserved);

export const jsonNumberArbitrary: Arbitrary<number> = fc.oneof(
  pickFrom(JSON_NUMBER_EDGE_CASES, 'JSON number edges'),
  fc.double({ min: -1_000_000, max: 1_000_000, noNaN: true, noDefaultInfinity: true }),
);

const jsonStringArbitrary: Arbitrary<string> = fc.oneof(
  pickFrom(
    ['', 'العربية', '😀', 'é', 'e\u0301', '\ud800', '\udfff', '__proto__', 'line\nbreak'],
    'JSON strings',
  ),
  fc.string({ maxLength: 20 }),
);

/**
 * Object KEYS, unlike string VALUES, may not be reserved words: `__proto__` is
 * a perfectly good string to store and an illegal place to store it under.
 */
const jsonKeyArbitrary: Arbitrary<string> = jsonStringArbitrary.filter(notReserved);

const jsonScalarArbitrary: Arbitrary<JsonValue> = fc.oneof(
  fc.constant(null),
  fc.boolean(),
  jsonNumberArbitrary,
  jsonStringArbitrary,
);

export function jsonValueArbitrary(maxDepth = 2): Arbitrary<JsonValue> {
  if (maxDepth <= 0) {
    return jsonScalarArbitrary;
  }
  const child = jsonValueArbitrary(maxDepth - 1);
  return fc.oneof(
    jsonScalarArbitrary,
    fc.array(child, { maxLength: 3 }),
    jsonObjectArbitrary(maxDepth - 1),
  );
}

/**
 * Produces a shrinkable value whose deepest leaf is exactly `depth` edges from
 * the root. The container chain is iterative so the Law-J boundary does not
 * build an exponentially recursive arbitrary.
 */
export function jsonValueAtDepthArbitrary(depth = MAX_JSON_DEPTH): Arbitrary<JsonValue> {
  if (!Number.isInteger(depth) || depth < 0 || depth > MAX_JSON_DEPTH) {
    throw new Error(
      `JSON arbitrary depth must be an integer from 0 through ${String(MAX_JSON_DEPTH)}.`,
    );
  }

  return fc
    .tuple(jsonScalarArbitrary, fc.array(fc.boolean(), { minLength: depth, maxLength: depth }))
    .map(([leaf, arrayContainers]) => {
      let value: JsonValue = leaf;
      for (const useArray of arrayContainers) {
        if (useArray) {
          value = [value];
          continue;
        }
        const record = emptyRecord<JsonValue>();
        defineOwn(record, 'value', value);
        value = record;
      }
      return value;
    });
}

export function jsonObjectArbitrary(maxDepth = 2): Arbitrary<Record<string, JsonValue>> {
  const value = jsonValueArbitrary(maxDepth);
  return fc
    .uniqueArray(fc.tuple(jsonKeyArbitrary, value), {
      maxLength: 4,
      selector: ([key]) => key,
    })
    .map((entries) => {
      const record = emptyRecord<JsonValue>();
      for (const [key, entry] of entries) {
        defineOwn(record, key, entry);
      }
      return record;
    });
}

/** Nested data first, ids and slot references only when flattened. */
export function blueprintArbitrary(vocabulary: RegistryVocabulary): Arbitrary<DocumentBlueprint> {
  const checked = checkVocabulary(vocabulary);
  const rootType = pickFrom(checked.rootTypes, 'root types');

  return fc
    .record({
      schemaVersion: fc.constant(checked.schemaVersion),
      surface: checked.surface,
      dir: fc.constantFrom('ltr' as const, 'rtl' as const),
      root: rootType.chain((type) => nodeBlueprintArbitrary(type, 0, checked)),
    })
    .map((blueprint) => blueprint);
}

/**
 * Registry-directed documents. Validation is an assertion in `map`, never a
 * filter, so a bad generator fails with its original shrinkable blueprint.
 */
export function builderDocumentArbitrary(
  vocabulary: RegistryVocabulary,
): Arbitrary<BuilderDocument> {
  const checked = checkVocabulary(vocabulary);
  return blueprintArbitrary(vocabulary).map((blueprint) => {
    const doc = flattenBlueprint(blueprint);
    assertDocumentMatchesVocabulary(doc, checked);
    return doc;
  });
}

export function flattenBlueprint(blueprint: DocumentBlueprint): BuilderDocument {
  const nodes = emptyRecord<Node>();
  const used = new Set<NodeId>();

  const visit = (node: NodeBlueprint, path: readonly (string | number)[]): NodeId => {
    const id = allocateId(node.id, path, used);
    const output: Node = {
      id,
      type: node.type,
      props: canonicalizeJsonValue(node.props),
    };

    if (node.bindings !== undefined) output.bindings = node.bindings;
    if (node.variantOf !== undefined) output.variantOf = node.variantOf;
    if (node.responsive !== undefined) {
      output.responsive = canonicalizeJsonValue(node.responsive);
    }
    if (node.slots !== undefined) {
      const slots = emptyRecord<NodeId[]>();
      for (const slotName of Object.keys(node.slots)) {
        const children = node.slots[slotName];
        if (children === undefined || children.length === 0) {
          continue;
        }
        const ids = children.map((child, index) => visit(child, [...path, slotName, index]));
        defineOwn(slots, slotName, ids);
      }
      output.slots = slots;
    }

    defineOwn(nodes, id, output);
    return id;
  };

  const rootId = visit(blueprint.root, [0]);
  return {
    schemaVersion: Object.is(blueprint.schemaVersion, -0) ? 0 : blueprint.schemaVersion,
    surface: blueprint.surface,
    dir: blueprint.dir,
    rootId,
    nodes,
  };
}

function nodeBlueprintArbitrary(
  type: string,
  depth: number,
  vocabulary: CheckedVocabulary,
): Arbitrary<NodeBlueprint> {
  const block = vocabulary.blocks.get(type);
  if (block === undefined) {
    throw new Error(`Unknown generated block type "${type}".`);
  }

  return fc
    .record({
      id: nodeIdArbitrary,
      props: block.props,
      bindings: bindingsArbitrary(block.bindingKeys ?? []),
      variantOf: fc.option(nodeIdArbitrary, { nil: undefined }),
      responsive: responsiveArbitrary(block.props),
      slots: slotsArbitrary(block, depth, vocabulary),
    })
    .map((parts) => {
      const node: NodeBlueprint = { id: parts.id, type, props: parts.props };
      if (parts.bindings !== undefined) node.bindings = parts.bindings;
      if (parts.variantOf !== undefined) node.variantOf = parts.variantOf;
      if (parts.responsive !== undefined) node.responsive = parts.responsive;
      if (parts.slots !== undefined) node.slots = parts.slots;
      return node;
    });
}

function bindingsArbitrary(keys: readonly string[]): Arbitrary<Record<string, string> | undefined> {
  const empty = fc.constant(emptyRecord<string>());
  if (keys.length === 0) {
    return fc.option(empty, { nil: undefined });
  }

  const present = fc.subarray([...keys], { minLength: 1 }).chain((selected) =>
    fc
      .array(dataPathArbitrary, { minLength: selected.length, maxLength: selected.length })
      .map((paths) => {
        const bindings = emptyRecord<string>();
        selected.forEach((key, index) => {
          const path = paths[index];
          if (path !== undefined) defineOwn(bindings, key, path);
        });
        return bindings;
      }),
  );
  return fc.option(fc.oneof(empty, present), { nil: undefined });
}

const dataPathArbitrary: Arbitrary<string> = fc.oneof(
  pickFrom(['content.title', 'items.0.label', 'بيانات.عنوان', '__proto__.value'], 'binding paths'),
  fc.string({ minLength: 1, maxLength: 12 }).map((segment) => `data.${segment}`),
);

function responsiveArbitrary(
  props: Arbitrary<Record<string, JsonValue>>,
): Arbitrary<Partial<Record<Breakpoint, Record<string, JsonValue>>> | undefined> {
  const emptyResponsive: Partial<Record<Breakpoint, Record<string, JsonValue>>> = {};
  Object.setPrototypeOf(emptyResponsive, null);
  const empty = fc.constant(emptyResponsive);
  const present = fc
    .tuple(fc.integer({ min: 1, max: 3 }), props, props)
    .map(([mask, mobile, tablet]) => {
      const responsive: Partial<Record<Breakpoint, Record<string, JsonValue>>> = {};
      if ((mask & 1) !== 0) responsive.mobile = mobile;
      if ((mask & 2) !== 0) responsive.tablet = tablet;
      return responsive;
    });
  return fc.option(fc.oneof(empty, present), { nil: undefined });
}

function slotsArbitrary(
  block: BlockVocabulary,
  depth: number,
  vocabulary: CheckedVocabulary,
): Arbitrary<Record<string, NodeBlueprint[]> | undefined> {
  const declarations = block.slots ?? {};
  let slots: Arbitrary<Record<string, NodeBlueprint[]>> =
    fc.constant(emptyRecord<NodeBlueprint[]>());

  if (depth < vocabulary.maxDepth) {
    for (const slotName of Object.keys(declarations).sort()) {
      const declaration = declarations[slotName];
      if (declaration === undefined) {
        continue;
      }
      const max = Math.min(
        declaration.max ?? vocabulary.maxChildrenPerSlot,
        vocabulary.maxChildrenPerSlot,
      );
      const childType = pickFrom(declaration.allow, `allowed types for slot "${slotName}"`);
      const children = fc.option(
        fc.array(
          childType.chain((type) => nodeBlueprintArbitrary(type, depth + 1, vocabulary)),
          { minLength: 1, maxLength: max },
        ),
        { nil: undefined },
      );
      slots = fc.tuple(slots, children).map(([current, generated]) => {
        const next = emptyRecord<NodeBlueprint[]>();
        for (const key of Object.keys(current)) {
          const value = current[key];
          if (value !== undefined) defineOwn(next, key, value);
        }
        if (generated !== undefined) defineOwn(next, slotName, generated);
        return next;
      });
    }
  }
  return fc.option(slots, { nil: undefined });
}

function allocateId(
  preferred: string,
  path: readonly (string | number)[],
  used: Set<string>,
): string {
  if (!used.has(preferred)) {
    used.add(preferred);
    return preferred;
  }

  const suffix = path.map((part) => String(part)).join('.');
  let attempt = `${preferred}#${suffix}`;
  let collision = 1;
  while (used.has(attempt)) {
    attempt = `${preferred}#${suffix}.${String(collision)}`;
    collision += 1;
  }
  used.add(attempt);
  return attempt;
}

function checkVocabulary(vocabulary: RegistryVocabulary): CheckedVocabulary {
  const blocks = new Map<string, BlockVocabulary>();
  for (const block of vocabulary.blocks) {
    if (block.type.length === 0) {
      throw new Error('Block vocabulary types must not be empty.');
    }
    if (blocks.has(block.type)) {
      throw new Error(`Duplicate block vocabulary type "${block.type}".`);
    }
    blocks.set(block.type, block);
  }
  if (blocks.size === 0) {
    throw new Error('A registry vocabulary needs at least one block type.');
  }
  if (vocabulary.rootTypes.length === 0) {
    throw new Error('A registry vocabulary needs at least one root type.');
  }
  for (const type of vocabulary.rootTypes) {
    if (!blocks.has(type)) {
      throw new Error(`Unknown root vocabulary type "${type}".`);
    }
  }
  for (const block of vocabulary.blocks) {
    for (const [slotName, declaration] of Object.entries(block.slots ?? {})) {
      if (slotName.length === 0 || declaration.allow.length === 0) {
        throw new Error(`Block "${block.type}" has an invalid slot declaration.`);
      }
      if (
        declaration.max !== undefined &&
        (!Number.isInteger(declaration.max) || declaration.max < 1)
      ) {
        throw new Error(`Block "${block.type}" slot "${slotName}" has an invalid capacity.`);
      }
      for (const allowed of declaration.allow) {
        if (!blocks.has(allowed)) {
          throw new Error(
            `Block "${block.type}" slot "${slotName}" allows unknown type "${allowed}".`,
          );
        }
      }
    }
  }

  const maxDepth = vocabulary.maxDepth ?? 3;
  const maxChildrenPerSlot = vocabulary.maxChildrenPerSlot ?? 2;
  const schemaVersion = vocabulary.schemaVersion ?? 1;
  if (!Number.isInteger(maxDepth) || maxDepth < 0) {
    throw new Error('Generator maxDepth must be a non-negative integer.');
  }
  if (!Number.isInteger(maxChildrenPerSlot) || maxChildrenPerSlot < 1) {
    throw new Error('Generator maxChildrenPerSlot must be a positive integer.');
  }
  if (!Number.isFinite(schemaVersion)) {
    throw new Error('Generator schemaVersion must be finite.');
  }

  return {
    blocks,
    rootTypes: vocabulary.rootTypes,
    surface: vocabulary.surface ?? fc.constant('site'),
    schemaVersion,
    maxDepth,
    maxChildrenPerSlot,
    assertValid: vocabulary.assertValid,
  };
}

function assertDocumentMatchesVocabulary(
  doc: BuilderDocument,
  vocabulary: CheckedVocabulary,
): void {
  const structural = validateDocument(doc);
  if (structural.length > 0) {
    throw new Error(
      `Generated document failed structural validation (${String(structural.length)} errors).`,
    );
  }

  for (const [id, node] of Object.entries(doc.nodes)) {
    const block = vocabulary.blocks.get(node.type);
    if (block === undefined) {
      throw new Error(`Generated node "${id}" uses an unknown vocabulary type.`);
    }
    const declaredSlots = block.slots ?? {};
    for (const [slotName, children] of Object.entries(node.slots ?? {})) {
      const declaration = declaredSlots[slotName];
      if (declaration === undefined) {
        throw new Error(`Generated node "${id}" uses an undeclared slot.`);
      }
      if (declaration.max !== undefined && children.length > declaration.max) {
        throw new Error(`Generated node "${id}" exceeds a slot capacity.`);
      }
      for (const childId of children) {
        const child = hasOwn(doc.nodes, childId) ? doc.nodes[childId] : undefined;
        if (child === undefined || !declaration.allow.includes(child.type)) {
          throw new Error(`Generated node "${id}" uses a disallowed child type.`);
        }
      }
    }
    const bindingKeys = new Set(block.bindingKeys ?? []);
    for (const key of Object.keys(node.bindings ?? {})) {
      if (!bindingKeys.has(key)) {
        throw new Error(`Generated node "${id}" uses an undeclared binding key.`);
      }
    }
  }

  const registryErrors = vocabulary.assertValid?.(doc) ?? [];
  if (registryErrors.length > 0) {
    throw new Error(
      `Generated document failed the caller's registry assertion (${String(registryErrors.length)} errors).`,
    );
  }
}
