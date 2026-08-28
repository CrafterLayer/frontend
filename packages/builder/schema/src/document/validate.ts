import { z } from 'zod';

import type { BlockSchema } from '../blocks/define-block-schema';
import { findRawStyleLiterals } from '../blocks/style-values';
import { type BuilderError, builderError } from '../errors';
import { RESERVED_JSON_KEYS, findJsonViolation, type JsonValue } from '../json/json-value';
import { BREAKPOINTS, type BuilderDocument, type Node, type NodeId } from './types';

export type BlockSchemaLookup = (type: string) => BlockSchema | undefined;

interface Membership {
  parentId: NodeId;
  slot: string;
  index: number;
}

/**
 * Two-pass document validator (contracts §2 checklist).
 *
 * Structural pass (document alone): root existence and non-parentage, exactly-once
 * membership, per-slot uniqueness, dangling references, cycles, orphans, stored
 * empty slot arrays, slot-name validity, id/key consistency, and JSON purity with
 * finite numbers.
 *
 * Registry-aware pass (when `lookup` is provided): known types, declared slots,
 * allow/capacity rules, props and responsive-override parsing, and the
 * intent-only styling law.
 */
export function validateDocument(doc: BuilderDocument, lookup?: BlockSchemaLookup): BuilderError[] {
  const errors: BuilderError[] = [];

  validateNodeShapes(doc, errors);
  const membership = validateMembership(doc, errors);
  validateReachability(doc, membership, errors);

  if (lookup !== undefined) {
    validateAgainstRegistry(doc, lookup, errors);
  }

  return errors;
}

function validateNodeShapes(doc: BuilderDocument, errors: BuilderError[]): void {
  for (const [key, node] of Object.entries(doc.nodes)) {
    if (RESERVED_JSON_KEYS.has(key)) {
      // Same law as Law J's reserved object keys: the patch door refuses these
      // as path segments, so a node stored under one could be projected but
      // never written back. Refusing it keeps the accepted and the applicable
      // domains identical (011 T033 review, second residual).
      errors.push(
        builderError(
          'doc/reserved-node-id',
          `Node id "${key}" is a reserved object key; the patch door cannot address it.`,
          ['nodes', key],
        ),
      );
    }
    if (node.id !== key) {
      errors.push(
        builderError(
          'doc/id-mismatch',
          `Node stored under key "${key}" carries id "${node.id}"; keys and ids must match.`,
          ['nodes', key],
        ),
      );
    }

    for (const [slotName, children] of Object.entries(node.slots ?? {})) {
      if (slotName.trim() === '') {
        errors.push(
          builderError('doc/invalid-slot-name', `Node "${key}" declares an empty slot name.`, [
            'nodes',
            key,
            'slots',
            slotName,
          ]),
        );
      }
      if (children.length === 0) {
        errors.push(
          builderError(
            'doc/empty-slot-array',
            `Node "${key}" stores an empty slot "${slotName}"; empty slots are removed, never stored.`,
            ['nodes', key, 'slots', slotName],
          ),
        );
      }
    }

    pushJsonRecordErrors(node.props, ['nodes', key, 'props'], errors);

    for (const [breakpoint, override] of Object.entries(node.responsive ?? {})) {
      if (!(BREAKPOINTS as readonly string[]).includes(breakpoint)) {
        errors.push(
          builderError(
            'doc/invalid-props',
            `Node "${key}" declares unknown breakpoint "${breakpoint}"; only ${BREAKPOINTS.join(', ')} exist.`,
            ['nodes', key, 'responsive', breakpoint],
          ),
        );
      }
      pushJsonRecordErrors(override, ['nodes', key, 'responsive', breakpoint], errors);
    }

    for (const [bindingKey, path] of Object.entries(node.bindings ?? {})) {
      if (typeof path !== 'string' || path.trim() === '') {
        errors.push(
          builderError(
            'doc/non-json-value',
            `Node "${key}" binding "${bindingKey}" must be a non-empty data path string.`,
            ['nodes', key, 'bindings', bindingKey],
          ),
        );
      }
    }
  }
}

function validateMembership(doc: BuilderDocument, errors: BuilderError[]): Map<NodeId, Membership> {
  const membership = new Map<NodeId, Membership>();

  if (doc.nodes[doc.rootId] === undefined) {
    errors.push(
      builderError(
        'doc/root-missing',
        `Root node "${doc.rootId}" does not exist in the document.`,
        ['rootId'],
      ),
    );
  }

  for (const [parentKey, parent] of Object.entries(doc.nodes)) {
    for (const [slotName, children] of Object.entries(parent.slots ?? {})) {
      const seenInSlot = new Set<NodeId>();
      children.forEach((childId, index) => {
        const location: (string | number)[] = ['nodes', parentKey, 'slots', slotName, index];

        if (seenInSlot.has(childId)) {
          errors.push(
            builderError(
              'doc/duplicate-in-slot',
              `Node "${childId}" appears twice inside slot "${slotName}" of "${parentKey}".`,
              location,
            ),
          );
          return;
        }
        seenInSlot.add(childId);

        if (doc.nodes[childId] === undefined) {
          errors.push(
            builderError(
              'doc/dangling-child',
              `Slot "${slotName}" of "${parentKey}" references missing node "${childId}".`,
              location,
            ),
          );
          return;
        }

        if (childId === doc.rootId) {
          errors.push(
            builderError(
              'doc/root-parented',
              `Root node "${doc.rootId}" must not appear in any slot (found in "${parentKey}").`,
              location,
            ),
          );
          return;
        }

        const existing = membership.get(childId);
        if (existing !== undefined) {
          errors.push(
            builderError(
              'doc/duplicate-membership',
              `Node "${childId}" is owned by "${existing.parentId}" slot "${existing.slot}" and again by "${parentKey}" slot "${slotName}"; every node has exactly one home.`,
              location,
            ),
          );
          return;
        }

        membership.set(childId, { parentId: parent.id, slot: slotName, index });
      });
    }
  }

  return membership;
}

function validateReachability(
  doc: BuilderDocument,
  membership: Map<NodeId, Membership>,
  errors: BuilderError[],
): void {
  const reachable = new Set<NodeId>();
  const queue: NodeId[] = doc.nodes[doc.rootId] === undefined ? [] : [doc.rootId];

  while (queue.length > 0) {
    const currentId = queue.pop();
    if (currentId === undefined || reachable.has(currentId)) {
      continue;
    }
    reachable.add(currentId);
    const current = doc.nodes[currentId];
    for (const children of Object.values(current?.slots ?? {})) {
      for (const childId of children) {
        if (doc.nodes[childId] !== undefined && !reachable.has(childId)) {
          queue.push(childId);
        }
      }
    }
  }

  const reportedCycleMembers = new Set<NodeId>();
  for (const nodeId of Object.keys(doc.nodes)) {
    if (reachable.has(nodeId) || nodeId === doc.rootId) {
      continue;
    }

    if (!membership.has(nodeId)) {
      errors.push(
        builderError('doc/orphan', `Node "${nodeId}" is not referenced by any slot.`, [
          'nodes',
          nodeId,
        ]),
      );
      continue;
    }

    if (reportedCycleMembers.has(nodeId)) {
      continue;
    }
    // Unreachable but parented ⇒ its ancestor chain never reaches the root and,
    // being finite, must loop. Report the component once with its members.
    const component = collectCycleComponent(nodeId, membership);
    for (const member of component) {
      reportedCycleMembers.add(member);
    }
    errors.push(
      builderError(
        'doc/cycle',
        `Nodes ${[...component].sort().join(' -> ')} form a cycle detached from the root.`,
        ['nodes', nodeId],
        { members: [...component].sort() },
      ),
    );
  }
}

function collectCycleComponent(start: NodeId, membership: Map<NodeId, Membership>): Set<NodeId> {
  const chain = new Set<NodeId>();
  let cursor: NodeId | undefined = start;
  while (cursor !== undefined && !chain.has(cursor)) {
    chain.add(cursor);
    cursor = membership.get(cursor)?.parentId;
  }
  return chain;
}

function validateAgainstRegistry(
  doc: BuilderDocument,
  lookup: BlockSchemaLookup,
  errors: BuilderError[],
): void {
  for (const [key, node] of Object.entries(doc.nodes)) {
    const schema = lookup(node.type);
    if (schema === undefined) {
      errors.push(
        builderError('doc/unknown-type', `Node "${key}" uses unregistered type "${node.type}".`, [
          'nodes',
          key,
          'type',
        ]),
      );
      continue;
    }

    validateSlotsAgainstSchema(doc, key, node, schema, errors);
    validatePropsAgainstSchema(key, node, schema, errors);
    validateStyleLaw(key, node, errors);
  }
}

function validateSlotsAgainstSchema(
  doc: BuilderDocument,
  key: string,
  node: Node,
  schema: BlockSchema,
  errors: BuilderError[],
): void {
  const declared = schema.slots ?? {};
  for (const [slotName, children] of Object.entries(node.slots ?? {})) {
    const decl = declared[slotName];
    if (decl === undefined) {
      errors.push(
        builderError(
          'doc/unknown-slot',
          `Node "${key}" (type "${node.type}") uses undeclared slot "${slotName}".`,
          ['nodes', key, 'slots', slotName],
        ),
      );
      continue;
    }

    if (decl.max !== undefined && children.length > decl.max) {
      errors.push(
        builderError(
          'doc/slot-capacity',
          `Slot "${slotName}" of "${key}" holds ${String(children.length)} children; the "${node.type}" schema allows at most ${String(decl.max)}.`,
          ['nodes', key, 'slots', slotName],
        ),
      );
    }

    children.forEach((childId, index) => {
      const child = doc.nodes[childId];
      if (child !== undefined && !decl.allow.includes(child.type)) {
        errors.push(
          builderError(
            'doc/slot-not-allowed',
            `Slot "${slotName}" of "${key}" accepts [${decl.allow.join(', ')}], but child "${childId}" is a "${child.type}".`,
            ['nodes', key, 'slots', slotName, index],
          ),
        );
      }
    });
  }
}

function validatePropsAgainstSchema(
  key: string,
  node: Node,
  schema: BlockSchema,
  errors: BuilderError[],
): void {
  const parsed = schema.props.safeParse(node.props);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(
        builderError(
          'doc/invalid-props',
          `Node "${key}" props failed the "${node.type}" schema: ${issue.message}`,
          ['nodes', key, 'props', ...(issue.path as (string | number)[])],
        ),
      );
    }
  }

  const propsSchema = schema.props;
  if (!(propsSchema instanceof z.ZodObject)) {
    return;
  }
  const partial = propsSchema.partial();
  for (const [breakpoint, override] of Object.entries(node.responsive ?? {})) {
    const overrideParsed = partial.safeParse(override);
    if (!overrideParsed.success) {
      for (const issue of overrideParsed.error.issues) {
        errors.push(
          builderError(
            'doc/invalid-props',
            `Node "${key}" ${breakpoint} override failed the "${node.type}" schema: ${issue.message}`,
            ['nodes', key, 'responsive', breakpoint, ...(issue.path as (string | number)[])],
          ),
        );
      }
    }
  }
}

function validateStyleLaw(key: string, node: Node, errors: BuilderError[]): void {
  const scopes: [string, JsonValue][] = [['props', node.props]];
  for (const [breakpoint, override] of Object.entries(node.responsive ?? {})) {
    scopes.push([`responsive.${breakpoint}`, override]);
  }

  for (const [scope, value] of scopes) {
    for (const hit of findRawStyleLiterals(value)) {
      errors.push(
        builderError(
          'doc/raw-style-literal',
          `Node "${key}" carries a raw ${hit.kind === 'hex-color' ? 'color code' : 'pixel length'} in ${scope}; use intent values.`,
          ['nodes', key, ...scope.split('.'), ...hit.path],
        ),
      );
    }
  }
}

function pushJsonErrors(
  value: unknown,
  basePath: (string | number)[],
  errors: BuilderError[],
): void {
  const violation = findJsonViolation(value);
  if (violation === undefined) {
    return;
  }
  pushJsonViolation(violation, basePath, errors);
}

function pushJsonRecordErrors(
  value: unknown,
  basePath: (string | number)[],
  errors: BuilderError[],
): void {
  const violation = findJsonViolation(value);
  if (violation === undefined) {
    return;
  }

  if (violation.kind !== 'max-depth' || !isPlainRecord(value)) {
    pushJsonViolation(violation, basePath, errors);
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    pushJsonErrors(entry, [...basePath, key], errors);
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function pushJsonViolation(
  violation: NonNullable<ReturnType<typeof findJsonViolation>>,
  basePath: (string | number)[],
  errors: BuilderError[],
): void {
  const path = [...basePath, ...violation.path];
  if (violation.kind === 'reserved-key') {
    errors.push(
      builderError(
        'doc/non-json-value',
        'Documents may not use a reserved object key; the patch door cannot write it.',
        path,
      ),
    );
    return;
  }
  if (violation.kind === 'non-finite-number') {
    errors.push(
      builderError('doc/non-finite-number', 'Numbers in a document must be finite.', path),
    );
    return;
  }
  errors.push(
    builderError(
      'doc/non-json-value',
      `Documents hold plain data only; found ${violation.kind} value.`,
      path,
    ),
  );
}
