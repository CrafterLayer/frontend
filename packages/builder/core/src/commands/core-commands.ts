import { z } from 'zod';

import {
  builderError,
  DEFAULT_SLOT,
  jsonRecordZod,
  jsonValueZod,
  type Breakpoint,
  type BuilderDocument,
  type CommandRuntime,
  type ContentDirection,
  type JsonValue,
  type Node,
  type NodeId,
  type RegisteredCommand,
  type SlotName,
  type Surface,
} from '@craftkit/builder-schema';

import { current } from '../patches/immer';
import { defineCommand } from './define-command';

/** Typed args map for the built-in command set (Law C). */
export interface CoreCommands {
  insertNode: {
    type: string;
    props?: Record<string, JsonValue>;
    parentId: NodeId;
    slot?: SlotName;
    index?: number;
  };
  removeNode: { id: NodeId };
  moveNode: { id: NodeId; toParentId: NodeId; toSlot?: SlotName; toIndex?: number };
  setProp: { id: NodeId; key: string; value: JsonValue };
  setBinding: { id: NodeId; key: string; path: string | null };
  setResponsive: { id: NodeId; breakpoint: Breakpoint; key: string; value: JsonValue | null };
  setDocMeta: { dir?: ContentDirection; surface?: Surface };
  duplicateNode: { id: NodeId };
  wrapNode: {
    id: NodeId;
    wrapperType: string;
    wrapperProps?: Record<string, JsonValue>;
    wrapperSlot?: SlotName;
  };
  groupNodes: { ids: NodeId[]; groupType: string; groupProps?: Record<string, JsonValue> };
}
export type CoreCommandName = keyof CoreCommands;

const id = z.string().min(1);
const slotName = z.string().min(1);

export const coreCommands: Record<CoreCommandName, RegisteredCommand> = {
  insertNode: defineCommand({
    args: z.strictObject({
      type: z.string().min(1),
      props: jsonRecordZod.optional(),
      parentId: id,
      slot: slotName.optional(),
      index: z.number().int().min(0).optional(),
    }),
    run: (args) => (draft, rt) => {
      const parent = requireNode(draft, args.parentId);
      const slot = args.slot ?? DEFAULT_SLOT;
      const decl = requireSlotDecl(rt, parent, slot);
      requireAllowed(decl.allow, args.type, parent.id, slot);
      const current = parent.slots?.[slot] ?? [];
      requireCapacity(decl.max, current.length + 1, parent.id, slot);

      const nodeId = rt.ids.newId();
      draft.nodes[nodeId] = {
        id: nodeId,
        type: args.type,
        props: parseProps(rt, args.type, args.props),
      };
      insertIntoSlot(parent, slot, nodeId, args.index);
    },
  }),

  removeNode: defineCommand({
    args: z.strictObject({ id }),
    run: (args) => (draft) => {
      requireNonRoot(draft, args.id);
      requireNode(draft, args.id);
      detachFromParent(draft, args.id);
      for (const memberId of collectSubtree(draft, args.id)) {
        delete draft.nodes[memberId];
      }
    },
  }),

  moveNode: defineCommand({
    args: z.strictObject({
      id,
      toParentId: id,
      toSlot: slotName.optional(),
      toIndex: z.number().int().min(0).optional(),
    }),
    run: (args) => (draft, rt) => {
      requireNonRoot(draft, args.id);
      const node = requireNode(draft, args.id);
      const target = requireNode(draft, args.toParentId);
      if (args.toParentId === args.id || collectSubtree(draft, args.id).includes(args.toParentId)) {
        throw builderError(
          'cmd/structural-violation',
          `Moving "${args.id}" into its own subtree would create a cycle.`,
          ['toParentId'],
        );
      }
      const slot = args.toSlot ?? DEFAULT_SLOT;
      const decl = requireSlotDecl(rt, target, slot);
      requireAllowed(decl.allow, node.type, target.id, slot);

      detachFromParent(draft, args.id);
      const occupancy = target.slots?.[slot]?.length ?? 0;
      // Capacity is checked after detaching, so a same-slot reorder never
      // double-counts the node's own seat.
      requireCapacity(decl.max, occupancy + 1, target.id, slot);
      insertIntoSlot(target, slot, args.id, args.toIndex);
    },
  }),

  setProp: defineCommand({
    args: z.strictObject({ id, key: z.string().min(1), value: jsonValueZod }),
    run: (args) => (draft, rt) => {
      const node = requireNode(draft, args.id);
      requirePropAllowed(rt, node.type, args.key, args.value);
      node.props[args.key] = args.value;
    },
  }),

  setBinding: defineCommand({
    args: z.strictObject({ id, key: z.string().min(1), path: z.string().min(1).nullable() }),
    run: (args) => (draft) => {
      const node = requireNode(draft, args.id);
      if (args.path === null) {
        if (node.bindings !== undefined) {
          delete node.bindings[args.key];
          if (Object.keys(node.bindings).length === 0) {
            delete node.bindings;
          }
        }
        return;
      }
      node.bindings = { ...(node.bindings ?? {}), [args.key]: args.path };
    },
  }),

  setResponsive: defineCommand({
    args: z.strictObject({
      id,
      breakpoint: z.enum(['tablet', 'mobile']),
      key: z.string().min(1),
      value: jsonValueZod.nullable(),
    }),
    run: (args) => (draft, rt) => {
      const node = requireNode(draft, args.id);
      if (args.value === null) {
        const bucket = node.responsive?.[args.breakpoint];
        if (bucket !== undefined) {
          delete bucket[args.key];
          if (Object.keys(bucket).length === 0 && node.responsive !== undefined) {
            delete node.responsive[args.breakpoint];
            if (Object.keys(node.responsive).length === 0) {
              delete node.responsive;
            }
          }
        }
        return;
      }
      requirePropAllowed(rt, node.type, args.key, args.value);
      node.responsive ??= {};
      const bucket = (node.responsive[args.breakpoint] ??= {});
      bucket[args.key] = args.value;
    },
  }),

  setDocMeta: defineCommand({
    args: z
      .strictObject({
        dir: z.enum(['ltr', 'rtl']).optional(),
        surface: z.string().min(1).optional(),
      })
      .refine((value) => value.dir !== undefined || value.surface !== undefined, {
        message: 'setDocMeta requires dir and/or surface.',
      }),
    run: (args) => (draft) => {
      if (args.dir !== undefined) {
        draft.dir = args.dir;
      }
      if (args.surface !== undefined) {
        draft.surface = args.surface;
      }
    },
  }),

  duplicateNode: defineCommand({
    args: z.strictObject({ id }),
    run: (args) => (draft, rt) => {
      requireNonRoot(draft, args.id);
      requireNode(draft, args.id);
      const origin = findMembership(draft, args.id);
      if (origin === undefined) {
        throw builderError(
          'cmd/structural-violation',
          `Node "${args.id}" has no parent; only placed nodes can be duplicated.`,
          ['id'],
        );
      }
      const parent = requireNode(draft, origin.parentId);
      const decl = requireSlotDecl(rt, parent, origin.slot);
      const occupancy = parent.slots?.[origin.slot]?.length ?? 0;
      requireCapacity(decl.max, occupancy + 1, parent.id, origin.slot);

      const cloneId = cloneSubtree(draft, rt, args.id);
      insertIntoSlot(parent, origin.slot, cloneId, origin.index + 1);
    },
  }),

  wrapNode: defineCommand({
    args: z.strictObject({
      id,
      wrapperType: z.string().min(1),
      wrapperProps: jsonRecordZod.optional(),
      wrapperSlot: slotName.optional(),
    }),
    run: (args) => (draft, rt) => {
      requireNonRoot(draft, args.id);
      const node = requireNode(draft, args.id);
      const origin = findMembership(draft, args.id);
      if (origin === undefined) {
        throw builderError(
          'cmd/structural-violation',
          `Node "${args.id}" has no parent; only placed nodes can be wrapped.`,
          ['id'],
        );
      }
      const parent = requireNode(draft, origin.parentId);
      const parentDecl = requireSlotDecl(rt, parent, origin.slot);
      requireAllowed(parentDecl.allow, args.wrapperType, parent.id, origin.slot);

      const wrapperSlot = args.wrapperSlot ?? DEFAULT_SLOT;
      const wrapperDecl = slotDeclOf(rt, args.wrapperType, wrapperSlot);
      requireAllowed(wrapperDecl.allow, node.type, args.wrapperType, wrapperSlot);
      requireCapacity(wrapperDecl.max, 1, args.wrapperType, wrapperSlot);

      const wrapperId = rt.ids.newId();
      draft.nodes[wrapperId] = {
        id: wrapperId,
        type: args.wrapperType,
        props: parseProps(rt, args.wrapperType, args.wrapperProps),
        slots: { [wrapperSlot]: [args.id] },
      };
      const siblings = parent.slots?.[origin.slot];
      if (siblings !== undefined) {
        siblings[origin.index] = wrapperId;
      }
    },
  }),

  groupNodes: defineCommand({
    args: z.strictObject({
      ids: z.array(id).min(1),
      groupType: z.string().min(1),
      groupProps: jsonRecordZod.optional(),
    }),
    run: (args) => (draft, rt) => {
      const memberships = args.ids.map((memberId) => {
        requireNonRoot(draft, memberId);
        requireNode(draft, memberId);
        const membership = findMembership(draft, memberId);
        if (membership === undefined) {
          throw builderError(
            'cmd/structural-violation',
            `Node "${memberId}" has no parent; only placed nodes can be grouped.`,
            ['ids'],
          );
        }
        return { id: memberId, ...membership };
      });

      const first = memberships[0];
      if (first === undefined) {
        return;
      }
      const sameHome = memberships.every(
        (entry) => entry.parentId === first.parentId && entry.slot === first.slot,
      );
      if (!sameHome || new Set(args.ids).size !== args.ids.length) {
        throw builderError(
          'cmd/structural-violation',
          'groupNodes requires distinct siblings from one parent slot.',
          ['ids'],
        );
      }

      const parent = requireNode(draft, first.parentId);
      const parentDecl = requireSlotDecl(rt, parent, first.slot);
      requireAllowed(parentDecl.allow, args.groupType, parent.id, first.slot);

      const groupDecl = slotDeclOf(rt, args.groupType, DEFAULT_SLOT);
      for (const entry of memberships) {
        const node = requireNode(draft, entry.id);
        requireAllowed(groupDecl.allow, node.type, args.groupType, DEFAULT_SLOT);
      }
      requireCapacity(groupDecl.max, memberships.length, args.groupType, DEFAULT_SLOT);

      const siblings = parent.slots?.[first.slot];
      if (siblings === undefined) {
        return;
      }
      const orderedIds = siblings.filter((memberId) => args.ids.includes(memberId));
      const insertAt = siblings.findIndex((memberId) => args.ids.includes(memberId));
      const remaining = siblings.filter((memberId) => !args.ids.includes(memberId));

      const groupId = rt.ids.newId();
      draft.nodes[groupId] = {
        id: groupId,
        type: args.groupType,
        props: parseProps(rt, args.groupType, args.groupProps),
        slots: { [DEFAULT_SLOT]: orderedIds },
      };
      remaining.splice(insertAt, 0, groupId);
      if (parent.slots !== undefined) {
        parent.slots[first.slot] = remaining;
      }
    },
  }),
};

/** Extract the id of the node an insert/duplicate/wrap/group transaction created. */
export function insertedNodeId(
  patches: { op: string; path: (string | number)[] }[],
): NodeId | undefined {
  for (const patch of patches) {
    if (patch.op === 'add' && patch.path.length === 2 && patch.path[0] === 'nodes') {
      return String(patch.path[1]);
    }
  }
  return undefined;
}

// ── Structural guard helpers ─────────────────────────────────────────────────

function requireNode(draft: BuilderDocument, nodeId: NodeId): Node {
  const node = draft.nodes[nodeId];
  if (node === undefined) {
    throw builderError('cmd/structural-violation', `Node "${nodeId}" does not exist.`, ['id']);
  }
  return node;
}

function requireNonRoot(draft: BuilderDocument, nodeId: NodeId): void {
  if (nodeId === draft.rootId) {
    throw builderError('cmd/structural-violation', 'The root node cannot be moved or removed.', [
      'id',
    ]);
  }
}

function slotDeclOf(
  rt: CommandRuntime,
  type: string,
  slot: SlotName,
): { allow: string[]; max?: number } {
  const schema = rt.blocks(type);
  if (schema === undefined) {
    throw builderError('cmd/structural-violation', `Type "${type}" is not registered.`, ['type']);
  }
  const decl = schema.slots?.[slot];
  if (decl === undefined) {
    throw builderError(
      'cmd/structural-violation',
      `Type "${type}" does not declare slot "${slot}".`,
      ['slot'],
    );
  }
  return decl;
}

function requireSlotDecl(
  rt: CommandRuntime,
  parent: Node,
  slot: SlotName,
): { allow: string[]; max?: number } {
  return slotDeclOf(rt, parent.type, slot);
}

function requireAllowed(allow: string[], type: string, owner: string, slot: SlotName): void {
  if (!allow.includes(type)) {
    throw builderError(
      'cmd/structural-violation',
      `Slot "${slot}" of "${owner}" accepts [${allow.join(', ')}], not "${type}".`,
      ['type'],
    );
  }
}

function requireCapacity(
  max: number | undefined,
  nextLength: number,
  owner: string,
  slot: SlotName,
): void {
  if (max !== undefined && nextLength > max) {
    throw builderError(
      'cmd/structural-violation',
      `Slot "${slot}" of "${owner}" holds at most ${String(max)} children.`,
      ['slot'],
    );
  }
}

function parseProps(
  rt: CommandRuntime,
  type: string,
  props: Record<string, JsonValue> | undefined,
): Record<string, JsonValue> {
  const schema = rt.blocks(type);
  if (schema === undefined) {
    throw builderError('cmd/structural-violation', `Type "${type}" is not registered.`, ['type']);
  }
  const parsed = schema.props.safeParse(props ?? {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw builderError(
      'cmd/invalid-args',
      `Props for "${type}" failed its schema${issue === undefined ? '.' : `: ${issue.message}`}`,
      issue === undefined ? ['props'] : ['props', ...(issue.path as (string | number)[])],
    );
  }
  return parsed.data as Record<string, JsonValue>;
}

function requirePropAllowed(rt: CommandRuntime, type: string, key: string, value: JsonValue): void {
  const schema = rt.blocks(type);
  if (schema === undefined) {
    throw builderError('cmd/structural-violation', `Type "${type}" is not registered.`, ['type']);
  }
  const props = schema.props;
  if (!(props instanceof z.ZodObject)) {
    return;
  }
  const keySchema = (props.shape as Record<string, z.ZodType | undefined>)[key];
  if (keySchema === undefined) {
    throw builderError('cmd/structural-violation', `Type "${type}" declares no prop "${key}".`, [
      'key',
    ]);
  }
  const parsed = keySchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw builderError(
      'cmd/invalid-args',
      `Value for "${type}.${key}" failed its schema${issue === undefined ? '.' : `: ${issue.message}`}`,
      ['value'],
    );
  }
}

interface FoundMembership {
  parentId: NodeId;
  slot: SlotName;
  index: number;
}

function findMembership(draft: BuilderDocument, nodeId: NodeId): FoundMembership | undefined {
  for (const parent of Object.values(draft.nodes)) {
    for (const [slot, children] of Object.entries(parent.slots ?? {})) {
      const index = children.indexOf(nodeId);
      if (index !== -1) {
        return { parentId: parent.id, slot, index };
      }
    }
  }
  return undefined;
}

function detachFromParent(draft: BuilderDocument, nodeId: NodeId): void {
  const membership = findMembership(draft, nodeId);
  if (membership === undefined) {
    return;
  }
  const parent = draft.nodes[membership.parentId];
  const children = parent?.slots?.[membership.slot];
  if (parent === undefined || children === undefined) {
    return;
  }
  children.splice(membership.index, 1);
  if (children.length === 0 && parent.slots !== undefined) {
    delete parent.slots[membership.slot];
    if (Object.keys(parent.slots).length === 0) {
      delete parent.slots;
    }
  }
}

function insertIntoSlot(
  parent: Node,
  slot: SlotName,
  nodeId: NodeId,
  index: number | undefined,
): void {
  parent.slots ??= {};
  const children = (parent.slots[slot] ??= []);
  const at = index === undefined ? children.length : Math.min(index, children.length);
  children.splice(at, 0, nodeId);
}

function collectSubtree(draft: BuilderDocument, rootId: NodeId): NodeId[] {
  const collected: NodeId[] = [];
  const stack: NodeId[] = [rootId];
  while (stack.length > 0) {
    const currentId = stack.pop();
    if (currentId === undefined) {
      continue;
    }
    collected.push(currentId);
    const current = draft.nodes[currentId];
    for (const children of Object.values(current?.slots ?? {})) {
      stack.push(...children);
    }
  }
  return collected;
}

function cloneSubtree(draft: BuilderDocument, rt: CommandRuntime, sourceId: NodeId): NodeId {
  const idMap = new Map<NodeId, NodeId>();
  for (const memberId of collectSubtree(draft, sourceId)) {
    idMap.set(memberId, rt.ids.newId());
  }
  for (const [oldId, newId] of idMap) {
    const source = draft.nodes[oldId];
    if (source === undefined) {
      continue;
    }
    // `current` snapshots the draft proxy into plain data before deep-copying.
    const clone: Node = { ...current(source), id: newId };
    if (source.slots !== undefined) {
      const remapped: Record<SlotName, NodeId[]> = {};
      for (const [slot, children] of Object.entries(source.slots)) {
        remapped[slot] = children.map((childId) => idMap.get(childId) ?? childId);
      }
      clone.slots = remapped;
    }
    draft.nodes[newId] = clone;
  }
  const cloneRoot = idMap.get(sourceId);
  if (cloneRoot === undefined) {
    throw builderError('cmd/structural-violation', 'Duplicate failed to allocate ids.', ['id']);
  }
  return cloneRoot;
}
