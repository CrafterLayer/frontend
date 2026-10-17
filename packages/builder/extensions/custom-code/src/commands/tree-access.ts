import type { z } from 'zod';

import {
  builderError,
  customCodeTreeProblems,
  customCodeTreeSchema,
  emptyCustomCodeTree,
  isCustomCodeTreeSchema,
  type BuilderDocument,
  type CommandRuntime,
  type CustomCodeRoot,
  type JsonValue,
  type Node,
  type NodeId,
  type TreeOpFailure,
} from '@craftkit/builder-schema';

/** One region's tree, read out of the draft as a plain value. */
export interface RegionTree {
  readonly node: Node;
  /** The prop the tree lives in, found by its declaration. */
  readonly key: string;
  /** That prop's declared schema (the block's own door for it). */
  readonly keySchema: z.ZodType;
  readonly tree: CustomCodeRoot;
}

function propsShape(schema: z.ZodType): Record<string, z.ZodType> {
  const def = schema._zod.def as { type: string; shape?: Record<string, z.ZodType> };
  return def.type === 'object' ? (def.shape ?? {}) : {};
}

function isRootShape(value: unknown): value is CustomCodeRoot {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as { kind?: unknown; children?: unknown };
  return record.kind === 'root' && Array.isArray(record.children);
}

/**
 * Resolve the region a tree command addresses: the node must exist, its block
 * must DECLARE a custom-code tree prop (the `customCodeTree()` marker — the
 * same lookup the Inspector uses, never a property name), and the stored value
 * must be a tree. The tree is copied out of the immer draft as plain JSON, so
 * the pure tree operations never hold a draft proxy and a moved node can never
 * be the same draft in two places.
 */
export function readRegionTree(
  draft: BuilderDocument,
  rt: CommandRuntime,
  id: NodeId,
  argPath: (string | number)[] = ['id'],
): RegionTree {
  const node = draft.nodes[id];
  if (node === undefined) {
    throw builderError(
      'cmd/structural-violation',
      `Node "${id}" does not exist · send the id of a custom-code region on this page`,
      argPath,
    );
  }
  const schema = rt.blocks(node.type);
  const entry =
    schema === undefined
      ? undefined
      : Object.entries(propsShape(schema.props)).find(([, prop]) => isCustomCodeTreeSchema(prop));
  if (entry === undefined) {
    throw builderError(
      'cmd/structural-violation',
      `Node "${id}" is a "${node.type}" block, which holds no element tree · send the id of a custom-code region, or edit this block with setProp`,
      argPath,
    );
  }
  const [key, keySchema] = entry;
  const stored: unknown = node.props[key];
  if (stored === undefined) {
    return { node, key, keySchema, tree: emptyCustomCodeTree() };
  }
  if (!isRootShape(stored)) {
    throw builderError(
      'cmd/structural-violation',
      `The "${key}" tree stored on "${id}" is unreadable · rewrite the whole tree with setProp first`,
      argPath,
    );
  }
  return { node, key, keySchema, tree: JSON.parse(JSON.stringify(stored)) as CustomCodeRoot };
}

/** The element path a validation issue points at, read from its zod path. */
function elementPathOf(issuePath: readonly PropertyKey[]): {
  element: number[];
  rest: PropertyKey[];
} {
  const element: number[] = [];
  let at = 0;
  while (at + 1 < issuePath.length && issuePath[at] === 'children' && typeof issuePath[at + 1] === 'number') {
    element.push(issuePath[at + 1] as number);
    at += 2;
  }
  return { element, rest: issuePath.slice(at) };
}

function refusal(message: string, key: string, issuePath: readonly PropertyKey[]): never {
  const { element, rest } = elementPathOf(issuePath);
  const where =
    element.length === 0
      ? ''
      : ` (element [${element.join(',')}]${rest.length > 0 ? ` ${rest.map(String).join('.')}` : ''})`;
  const repair = message.includes(' · ') ? '' : ' · send a value the element vocabulary admits';
  throw builderError(
    'cmd/structural-violation',
    `${message}${where}${repair}`,
    ['props', key, ...issuePath.filter((part): part is string | number => typeof part !== 'symbol')],
  );
}

/**
 * The door for a rebuilt tree, then the write. Three gates, in order:
 * the per-tag problems (where an element stands, what its attributes say),
 * the full tree validator (tags, keys, ceilings), and the block's own
 * declared prop schema — which is where any block-level rule beyond the tree
 * (for example component props checked against the referenced block) lives.
 * Any failure throws BEFORE the draft is touched.
 */
export function writeRegionTree(region: RegionTree, next: CustomCodeRoot): void {
  const problem = customCodeTreeProblems(next)[0];
  if (problem !== undefined) {
    refusal(problem.message, region.key, problem.path);
  }
  const shape = customCodeTreeSchema.safeParse(next);
  if (!shape.success) {
    const issue = shape.error.issues[0];
    /* v8 ignore next -- a failed parse always carries at least one issue. */
    refusal(issue?.message ?? 'The tree failed validation', region.key, issue?.path ?? []);
  }
  if (region.keySchema !== customCodeTreeSchema) {
    const declared = region.keySchema.safeParse(next);
    if (!declared.success) {
      const issue = declared.error.issues[0];
      /* v8 ignore next -- a failed parse always carries at least one issue. */
      refusal(issue?.message ?? 'The tree failed validation', region.key, issue?.path ?? []);
    }
  }
  region.node.props[region.key] = next as unknown as JsonValue;
}

/** A pure-op failure as the door's refusal, pointed at the offending argument. */
export function opRefusal(failure: TreeOpFailure, argPath: (string | number)[]): never {
  throw builderError('cmd/structural-violation', failure.message, argPath);
}
