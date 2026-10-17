import { z } from 'zod';

import { CUSTOM_CODE_MAX_DEPTH, TREE_TEXT_MARKS } from '@craftkit/builder-schema';

/*
  The argument schemas of the tree commands (style-manager DESIGN.md §D.2),
  kept apart from the handlers so the agent tools, the shell and the docs can
  read the exact shapes without pulling in the command bodies.

  Every object is STRICT: an unknown key is a refusal, never silently
  ignored, because for the agent an ignored key is a change it believes it made.
*/

const nodeId = z.string().min(1);
const index = z.number().int().min(0);

/** Child indices from the tree root to one node; never empty (the root is not a node). */
export const treeNodePathArg = z.array(index).min(1).max(CUSTOM_CODE_MAX_DEPTH);

/** A container's address: `[]` is the tree root. */
export const treeParentPathArg = z.array(index).max(CUSTOM_CODE_MAX_DEPTH);

/**
 * A node, checked here only for its kind; the full shape is checked by the
 * tree door once the node sits in its tree, where its parent is known.
 */
export const treeNodeArg = z.looseObject({ kind: z.enum(['element', 'component', 'icon']) });

export const setTreeNodeArgs = z.strictObject({
  id: nodeId,
  path: treeNodePathArg,
  node: treeNodeArg,
});

export const patchTreeNodeArgs = z.strictObject({
  id: nodeId,
  path: treeNodePathArg,
  set: z
    .strictObject({
      className: z.string().max(1_000).nullable().optional(),
      text: z.string().max(20_000).nullable().optional(),
      tag: z.string().min(1).max(32).optional(),
      label: z.string().max(60).nullable().optional(),
      locked: z.boolean().optional(),
    })
    .optional(),
  attributes: z.record(z.string().min(1).max(64), z.string().max(2_000).nullable()).optional(),
});

export const insertTreeNodeArgs = z.strictObject({
  id: nodeId,
  parent: treeParentPathArg,
  index,
  node: treeNodeArg,
});

export const removeTreeNodeArgs = z.strictObject({ id: nodeId, path: treeNodePathArg });

export const moveTreeNodeArgs = z.strictObject({
  id: nodeId,
  from: treeNodePathArg,
  to: z.strictObject({
    /** Another custom-code region on the same page; absent = the same region. */
    id: nodeId.optional(),
    parent: treeParentPathArg,
    index,
  }),
});

export const duplicateTreeNodeArgs = z.strictObject({ id: nodeId, path: treeNodePathArg });

export const wrapTreeNodeArgs = z.strictObject({
  id: nodeId,
  paths: z.array(treeNodePathArg).min(1).max(200),
  wrapper: z.strictObject({
    tag: z.string().min(1).max(32),
    className: z.string().max(1_000).optional(),
  }),
});

export const unwrapTreeNodeArgs = z.strictObject({ id: nodeId, path: treeNodePathArg });

export const formatTreeTextArgs = z.strictObject({
  id: nodeId,
  path: treeNodePathArg,
  start: index,
  end: z.number().int().min(1),
  mark: z.enum(TREE_TEXT_MARKS),
  className: z.string().max(1_000).optional(),
  href: z.string().max(2_000).optional(),
});

/** The typed args map — what `dispatch` / `dispatchGroup` steps take for each name. */
export interface TreeNodeCommands {
  setTreeNode: z.input<typeof setTreeNodeArgs>;
  patchTreeNode: z.input<typeof patchTreeNodeArgs>;
  insertTreeNode: z.input<typeof insertTreeNodeArgs>;
  removeTreeNode: z.input<typeof removeTreeNodeArgs>;
  moveTreeNode: z.input<typeof moveTreeNodeArgs>;
  duplicateTreeNode: z.input<typeof duplicateTreeNodeArgs>;
  wrapTreeNode: z.input<typeof wrapTreeNodeArgs>;
  unwrapTreeNode: z.input<typeof unwrapTreeNodeArgs>;
  formatTreeText: z.input<typeof formatTreeTextArgs>;
}

export type TreeNodeCommandName = keyof TreeNodeCommands;

export const TREE_NODE_COMMAND_NAMES = [
  'setTreeNode',
  'patchTreeNode',
  'insertTreeNode',
  'removeTreeNode',
  'moveTreeNode',
  'duplicateTreeNode',
  'wrapTreeNode',
  'unwrapTreeNode',
  'formatTreeText',
] as const satisfies readonly TreeNodeCommandName[];

/** One typed grouped-dispatch step: `{ command, args }` with args checked by name. */
export type TreeNodeStep = {
  [K in TreeNodeCommandName]: { command: K; args: TreeNodeCommands[K] };
}[TreeNodeCommandName];

/** Build a typed step for `kernel.dispatchGroup`. */
export function treeNodeStep<K extends TreeNodeCommandName>(
  command: K,
  args: TreeNodeCommands[K],
): { command: K; args: TreeNodeCommands[K] } {
  return { command, args };
}
