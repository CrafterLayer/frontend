import {
  builderError,
  duplicateNodeAt,
  extractNodeAt,
  formatTextRange,
  insertNodeAt,
  moveNode,
  patchNodeAt,
  removeNodeAt,
  setNodeAt,
  treeNodeAt,
  unwrapNodeAt,
  wrapNodesAt,
  type CustomCodeNode,
  type RegisteredCommand,
  type TreeNodePatch,
} from '@craftkit/builder-schema';

import { definePageCommand } from './define-page-command';
import { opRefusal, readRegionTree, writeRegionTree } from './tree-access';
import {
  duplicateTreeNodeArgs,
  formatTreeTextArgs,
  insertTreeNodeArgs,
  moveTreeNodeArgs,
  patchTreeNodeArgs,
  removeTreeNodeArgs,
  setTreeNodeArgs,
  unwrapTreeNodeArgs,
  wrapTreeNodeArgs,
  type TreeNodeCommandName,
} from './tree-node-args';

/*
  ── Path-addressed tree commands (style-manager DESIGN.md §D.2, D4) ──────────

  Before these, every element edit was a whole-tree `setProp` spliced on the
  client, and every agent edit a text find/replace. Now the panel, the canvas,
  the layers tree, copy/paste and the agent share ONE write path per edit:

    parse args (Law V) → resolve the region's tree prop by DECLARATION →
    apply the pure op → tree door (per-tag problems, tree schema, the block's
    own prop schema) → write.

  Contributed as page commands through this extension's manifest, so the
  kernel's core command set is not edited. Each command is one mutation over
  one draft; several of them in `dispatchGroup` are still one transaction and
  one Undo. Every refusal is `cmd/structural-violation` (or `cmd/invalid-args`
  from the args parse) with "what is wrong · what to send instead".
*/

const setTreeNode = definePageCommand({
  args: setTreeNodeArgs,
  run: (args) => (draft, rt) => {
    const region = readRegionTree(draft, rt, args.id);
    const result = setNodeAt(region.tree, args.path, args.node as unknown as CustomCodeNode);
    if (!result.ok) opRefusal(result, ['path']);
    writeRegionTree(region, result.tree);
  },
});

const patchTreeNode = definePageCommand({
  args: patchTreeNodeArgs,
  run: (args) => (draft, rt) => {
    const set = args.set ?? {};
    const attributes = args.attributes ?? {};
    if (Object.keys(set).length === 0 && Object.keys(attributes).length === 0) {
      throw builderError(
        'cmd/invalid-args',
        'patchTreeNode changes nothing · send "set" with className, text, tag, label or locked, and/or "attributes"',
        ['set'],
      );
    }
    const region = readRegionTree(draft, rt, args.id);
    const patch: TreeNodePatch = { set, attributes };
    const result = patchNodeAt(region.tree, args.path, patch);
    if (!result.ok) opRefusal(result, ['path']);
    writeRegionTree(region, result.tree);
  },
});

const insertTreeNode = definePageCommand({
  args: insertTreeNodeArgs,
  run: (args) => (draft, rt) => {
    const region = readRegionTree(draft, rt, args.id);
    const result = insertNodeAt(
      region.tree,
      args.parent,
      args.index,
      args.node as unknown as CustomCodeNode,
    );
    if (!result.ok) opRefusal(result, result.code === 'index-out-of-range' ? ['index'] : ['parent']);
    writeRegionTree(region, result.tree);
  },
});

const removeTreeNode = definePageCommand({
  args: removeTreeNodeArgs,
  run: (args) => (draft, rt) => {
    const region = readRegionTree(draft, rt, args.id);
    const result = removeNodeAt(region.tree, args.path);
    if (!result.ok) opRefusal(result, ['path']);
    writeRegionTree(region, result.tree);
  },
});

const moveTreeNode = definePageCommand({
  args: moveTreeNodeArgs,
  run: (args) => (draft, rt) => {
    const targetId = args.to.id ?? args.id;
    if (targetId === args.id) {
      const region = readRegionTree(draft, rt, args.id);
      const result = moveNode(region.tree, args.from, args.to.parent, args.to.index);
      if (!result.ok) {
        opRefusal(result, result.code === 'path-not-found' && treeNodeAt(region.tree, args.from) === undefined ? ['from'] : ['to']);
      }
      writeRegionTree(region, result.tree);
      return;
    }
    // Across regions of one page: one draft, two writes — still ONE transaction.
    const source = readRegionTree(draft, rt, args.id);
    const target = readRegionTree(draft, rt, targetId, ['to', 'id']);
    const taken = extractNodeAt(source.tree, args.from);
    if (!taken.ok) opRefusal(taken, ['from']);
    const placed = insertNodeAt(target.tree, args.to.parent, args.to.index, taken.removed);
    if (!placed.ok) opRefusal(placed, ['to']);
    writeRegionTree(source, taken.tree);
    writeRegionTree(target, placed.tree);
  },
});

const duplicateTreeNode = definePageCommand({
  args: duplicateTreeNodeArgs,
  run: (args) => (draft, rt) => {
    const region = readRegionTree(draft, rt, args.id);
    const result = duplicateNodeAt(region.tree, args.path);
    if (!result.ok) opRefusal(result, ['path']);
    writeRegionTree(region, result.tree);
  },
});

const wrapTreeNode = definePageCommand({
  args: wrapTreeNodeArgs,
  run: (args) => (draft, rt) => {
    const region = readRegionTree(draft, rt, args.id);
    const result = wrapNodesAt(region.tree, args.paths, args.wrapper);
    if (!result.ok) opRefusal(result, result.code === 'invalid-value' ? ['wrapper', 'tag'] : ['paths']);
    writeRegionTree(region, result.tree);
  },
});

const unwrapTreeNode = definePageCommand({
  args: unwrapTreeNodeArgs,
  run: (args) => (draft, rt) => {
    const region = readRegionTree(draft, rt, args.id);
    const result = unwrapNodeAt(region.tree, args.path);
    if (!result.ok) opRefusal(result, ['path']);
    writeRegionTree(region, result.tree);
  },
});

const formatTreeText = definePageCommand({
  args: formatTreeTextArgs,
  run: (args) => (draft, rt) => {
    const region = readRegionTree(draft, rt, args.id);
    const element = treeNodeAt(region.tree, args.path);
    if (element === undefined) {
      throw builderError(
        'cmd/structural-violation',
        `No element at [${args.path.join(',')}] · send the path of a text element in this region`,
        ['path'],
      );
    }
    const formatted = formatTextRange(element, args.start, args.end, args.mark, {
      className: args.className,
      href: args.href,
    });
    if (!formatted.ok) {
      opRefusal(formatted, formatted.code === 'invalid-range' ? ['start'] : formatted.code === 'invalid-value' ? ['href'] : ['path']);
    }
    const result = setNodeAt(region.tree, args.path, formatted.element);
    /* v8 ignore next -- the path resolved above, so the replacement resolves too. */
    if (!result.ok) opRefusal(result, ['path']);
    writeRegionTree(region, result.tree);
  },
});

/** The nine tree commands, keyed by their registered names. */
export const treeNodeCommands: Readonly<Record<TreeNodeCommandName, RegisteredCommand>> = {
  setTreeNode,
  patchTreeNode,
  insertTreeNode,
  removeTreeNode,
  moveTreeNode,
  duplicateTreeNode,
  wrapTreeNode,
  unwrapTreeNode,
  formatTreeText,
};
