/* eslint-disable react-refresh/only-export-components -- test support: never hot-reloaded */
import { z } from 'zod';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import { CustomCode } from '@craftkit/builder-renderer';
import {
  builderError,
  customCodeTree,
  defineBlockSchema,
  duplicateNodeAt,
  emptyCustomCodeTree,
  formatTextRange,
  insertNodeAt,
  moveNode,
  patchNodeAt,
  removeNodeAt,
  setNodeAt,
  setUtilityClassOracle,
  treeNodeAt,
  unwrapNodeAt,
  wrapNodesAt,
  type BlockRenderComponent,
  type BlockRenderProps,
  type BuilderDocument,
  type CustomCodeNode,
  type CustomCodeRoot,
  type Node,
  type RegisteredCommand,
  type TreeOpFailure,
  type TreeTextMark,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

/*
  TEST SUPPORT ONLY (P7). The shell does not depend on the custom-code
  extension, whose page commands are the real tree door; these stand-ins
  apply the SAME pure schema operations to a test region's `tree` prop, so
  the canvas tests can count real transactions through `dispatchGroup`.
*/

type Draft = BuilderDocument;
type Args = Record<string, unknown>;

function treeOf(draft: Draft, id: unknown): { tree: CustomCodeRoot; write: (tree: CustomCodeRoot) => void } {
  const node = typeof id === 'string' ? draft.nodes[id] : undefined;
  if (node === undefined) {
    throw builderError('cmd/structural-violation', `Node "${String(id)}" does not exist`, ['id']);
  }
  const tree = JSON.parse(JSON.stringify(node.props['tree'] ?? emptyCustomCodeTree())) as CustomCodeRoot;
  return {
    tree,
    write: (next) => {
      node.props['tree'] = JSON.parse(JSON.stringify(next)) as never;
    },
  };
}

function refuse(failure: TreeOpFailure): never {
  throw builderError('cmd/structural-violation', failure.message, ['path']);
}

function command(run: (args: Args, draft: Draft) => void): RegisteredCommand {
  return {
    argsSchema: z.record(z.string(), z.unknown()),
    apply: (raw) => (draft) => {
      run(raw as Args, draft);
    },
  };
}

const path = (value: unknown) => value as number[];

export const TEST_TREE_COMMANDS: Readonly<Record<string, RegisteredCommand>> = {
  patchTreeNode: command((args, draft) => {
    const region = treeOf(draft, args['id']);
    const result = patchNodeAt(region.tree, path(args['path']), {
      set: args['set'] as never,
      attributes: args['attributes'] as never,
    });
    if (!result.ok) refuse(result);
    region.write(result.tree);
  }),
  setTreeNode: command((args, draft) => {
    const region = treeOf(draft, args['id']);
    const result = setNodeAt(region.tree, path(args['path']), args['node'] as CustomCodeNode);
    if (!result.ok) refuse(result);
    region.write(result.tree);
  }),
  insertTreeNode: command((args, draft) => {
    const region = treeOf(draft, args['id']);
    const result = insertNodeAt(region.tree, path(args['parent']), args['index'] as number, args['node'] as CustomCodeNode);
    if (!result.ok) refuse(result);
    region.write(result.tree);
  }),
  removeTreeNode: command((args, draft) => {
    const region = treeOf(draft, args['id']);
    const result = removeNodeAt(region.tree, path(args['path']));
    if (!result.ok) refuse(result);
    region.write(result.tree);
  }),
  duplicateTreeNode: command((args, draft) => {
    const region = treeOf(draft, args['id']);
    const result = duplicateNodeAt(region.tree, path(args['path']));
    if (!result.ok) refuse(result);
    region.write(result.tree);
  }),
  moveTreeNode: command((args, draft) => {
    const to = args['to'] as { id?: string; parent: number[]; index: number };
    if (to.id !== undefined && to.id !== args['id']) {
      const source = treeOf(draft, args['id']);
      const taken = removeNodeAt(source.tree, path(args['from']));
      if (!taken.ok) refuse(taken);
      const target = treeOf(draft, to.id);
      const placed = insertNodeAt(target.tree, to.parent, to.index, taken.removed);
      if (!placed.ok) refuse(placed);
      source.write(taken.tree);
      target.write(placed.tree);
      return;
    }
    const region = treeOf(draft, args['id']);
    const result = moveNode(region.tree, path(args['from']), to.parent, to.index);
    if (!result.ok) refuse(result);
    region.write(result.tree);
  }),
  wrapTreeNode: command((args, draft) => {
    const region = treeOf(draft, args['id']);
    const result = wrapNodesAt(region.tree, args['paths'] as number[][], args['wrapper'] as never);
    if (!result.ok) refuse(result);
    region.write(result.tree);
  }),
  unwrapTreeNode: command((args, draft) => {
    const region = treeOf(draft, args['id']);
    const result = unwrapNodeAt(region.tree, path(args['path']));
    if (!result.ok) refuse(result);
    region.write(result.tree);
  }),
  formatTreeText: command((args, draft) => {
    const region = treeOf(draft, args['id']);
    const at = path(args['path']);
    const node = treeNodeAt(region.tree, at);
    if (node === undefined) throw builderError('cmd/structural-violation', 'No node there', ['path']);
    const formatted = formatTextRange(
      node,
      args['start'] as number,
      args['end'] as number,
      args['mark'] as TreeTextMark,
      { className: args['className'] as string | undefined, href: args['href'] as string | undefined },
    );
    if (!formatted.ok) refuse(formatted);
    const result = setNodeAt(region.tree, at, formatted.element);
    if (!result.ok) refuse(result);
    region.write(result.tree);
  }),
};

const PassThrough: BlockRenderComponent = ((props: { slots: Record<string, unknown> }) => (
  <div>{Object.values(props.slots) as React.ReactNode[]}</div>
)) as BlockRenderComponent;

const RegionRender = ((props: BlockRenderProps<{ tree: unknown }>) => (
  <CustomCode tree={props.props.tree} hostId={props.node.id} isCanvas={props.isCanvas} />
)) as unknown as BlockRenderComponent;

export const TREE_TEST_MANIFEST: TrustedExtensionManifest = {
  tier: 1,
  name: 'p7-tree-test-kit',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'Page',
          props: z.object({}),
          slots: { default: { allow: ['region'] } },
          examples: [],
        }),
        render: PassThrough,
      },
      {
        schema: defineBlockSchema({
          type: 'region',
          description: 'A composed region',
          props: z.object({ tree: customCodeTree().default(emptyCustomCodeTree()) }),
          examples: [],
        }),
        render: RegionRender,
      },
    ],
    commands: { ...TEST_TREE_COMMANDS },
  },
};

/** A page with one region (`r1`) per tree given, `r2` for the second. */
export function treeKernel(trees: readonly CustomCodeRoot[], dir: 'ltr' | 'rtl' = 'ltr'): BuilderKernel {
  const ids = trees.map((_tree, at) => `r${String(at + 1)}`);
  const document: BuilderDocument = {
    schemaVersion: 1,
    surface: 'site',
    dir,
    rootId: 'root',
    nodes: {
      root: { id: 'root', type: 'page', props: {}, slots: { default: ids } },
      ...Object.fromEntries(
        trees.map((tree, at): [string, Node] => [
          ids[at] ?? '',
          { id: ids[at] ?? '', type: 'region', props: { tree: tree as never } },
        ]),
      ),
    },
  };
  return createBuilder({
    document,
    ports: { clock: fixedClock(), ids: seededIds('p7') },
    extensions: [TREE_TEST_MANIFEST],
  });
}

/** The stored tree of a region. */
export function storedTree(kernel: BuilderKernel, id = 'r1'): CustomCodeRoot {
  return kernel.getDocument().nodes[id]?.props['tree'] as unknown as CustomCodeRoot;
}

/**
 * The live Tailwind compiler is the class oracle in the product; jsdom has
 * none, and the static vocabulary does not list every logical or variant
 * utility the engine writes (`pbs-6`, `max-md:hidden`, `inset-s-[30px]`).
 * Suites that exercise engine writes stand in a permissive oracle, as the
 * engine's own suites do. Returns the restore.
 */
export function permissiveUtilityOracle(): () => void {
  setUtilityClassOracle(() => true);
  return () => {
    setUtilityClassOracle(undefined);
  };
}
