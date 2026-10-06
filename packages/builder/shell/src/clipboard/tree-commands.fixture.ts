import { z } from 'zod';

import { defineCommand } from '@craftkit/builder-core';
import {
  builderError,
  customCodeTree,
  customCodeTreeProblems,
  customCodeTreeSchema,
  defineBlockSchema,
  duplicateNodeAt,
  emptyCustomCodeTree,
  extractNodeAt,
  insertNodeAt,
  moveNode,
  patchNodeAt,
  removeNodeAt,
  unwrapNodeAt,
  wrapNodesAt,
  type BlockRenderComponent,
  type BuilderDocument,
  type CustomCodeNode,
  type CustomCodeRoot,
  type JsonValue,
  type TreeOpFailure,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

/*
  TEST-ONLY. The shell cannot depend on `@craftkit/builder-custom-code` (the
  extension sits above it), so its tests register this stand-in: the same
  command NAMES and argument shapes as the extension's tree commands
  (style-manager DESIGN.md §D.2), built on the same pure schema operations and
  judged by the same tree door. It always stores the tree under `tree` and the
  region stylesheet under `css` — the custom-code region's own prop names.
*/

const NullRender: BlockRenderComponent = () => null;

const path = z.array(z.number().int().min(0)).min(1);
const parent = z.array(z.number().int().min(0));

function refuse(failure: TreeOpFailure): never {
  throw builderError('cmd/structural-violation', failure.message, []);
}

function readTree(draft: BuilderDocument, id: string): CustomCodeRoot {
  const node = draft.nodes[id];
  if (node?.type !== 'region') {
    throw builderError('cmd/structural-violation', `Node "${id}" holds no element tree`, ['id']);
  }
  const stored = node.props['tree'] as CustomCodeRoot | undefined;
  return stored === undefined ? emptyCustomCodeTree() : (JSON.parse(JSON.stringify(stored)) as CustomCodeRoot);
}

function writeTree(draft: BuilderDocument, id: string, tree: CustomCodeRoot): void {
  const problem = customCodeTreeProblems(tree)[0];
  if (problem !== undefined) throw builderError('cmd/structural-violation', problem.message, []);
  const parsed = customCodeTreeSchema.safeParse(tree);
  if (!parsed.success) {
    throw builderError('cmd/structural-violation', parsed.error.issues[0]?.message ?? 'Invalid tree', []);
  }
  const node = draft.nodes[id];
  if (node !== undefined) node.props['tree'] = tree as unknown as JsonValue;
}

const looseNode = z.looseObject({ kind: z.enum(['element', 'component', 'icon']) });

export const FIXTURE_TREE_COMMANDS = {
  insertTreeNode: defineCommand({
    args: z.strictObject({ id: z.string(), parent, index: z.number().int().min(0), node: looseNode }),
    run: (args) => (draft) => {
      const result = insertNodeAt(readTree(draft, args.id), args.parent, args.index, args.node as unknown as CustomCodeNode);
      if (!result.ok) refuse(result);
      writeTree(draft, args.id, result.tree);
    },
  }),
  removeTreeNode: defineCommand({
    args: z.strictObject({ id: z.string(), path }),
    run: (args) => (draft) => {
      const result = removeNodeAt(readTree(draft, args.id), args.path);
      if (!result.ok) refuse(result);
      writeTree(draft, args.id, result.tree);
    },
  }),
  duplicateTreeNode: defineCommand({
    args: z.strictObject({ id: z.string(), path }),
    run: (args) => (draft) => {
      const result = duplicateNodeAt(readTree(draft, args.id), args.path);
      if (!result.ok) refuse(result);
      writeTree(draft, args.id, result.tree);
    },
  }),
  patchTreeNode: defineCommand({
    args: z.strictObject({
      id: z.string(),
      path,
      set: z
        .strictObject({
          className: z.string().nullable().optional(),
          text: z.string().nullable().optional(),
          tag: z.string().optional(),
          label: z.string().max(60).nullable().optional(),
          locked: z.boolean().optional(),
        })
        .optional(),
      attributes: z.record(z.string(), z.string().nullable()).optional(),
    }),
    run: (args) => (draft) => {
      const result = patchNodeAt(readTree(draft, args.id), args.path, {
        set: args.set ?? {},
        attributes: args.attributes ?? {},
      });
      if (!result.ok) refuse(result);
      writeTree(draft, args.id, result.tree);
    },
  }),
  moveTreeNode: defineCommand({
    args: z.strictObject({
      id: z.string(),
      from: path,
      to: z.strictObject({ id: z.string().optional(), parent, index: z.number().int().min(0) }),
    }),
    run: (args) => (draft) => {
      const targetId = args.to.id ?? args.id;
      if (targetId === args.id) {
        const result = moveNode(readTree(draft, args.id), args.from, args.to.parent, args.to.index);
        if (!result.ok) refuse(result);
        writeTree(draft, args.id, result.tree);
        return;
      }
      const taken = extractNodeAt(readTree(draft, args.id), args.from);
      if (!taken.ok) refuse(taken);
      const placed = insertNodeAt(readTree(draft, targetId), args.to.parent, args.to.index, taken.removed);
      if (!placed.ok) refuse(placed);
      writeTree(draft, args.id, taken.tree);
      writeTree(draft, targetId, placed.tree);
    },
  }),
  wrapTreeNode: defineCommand({
    args: z.strictObject({
      id: z.string(),
      paths: z.array(path).min(1),
      wrapper: z.strictObject({ tag: z.string(), className: z.string().optional() }),
    }),
    run: (args) => (draft) => {
      const result = wrapNodesAt(readTree(draft, args.id), args.paths, args.wrapper);
      if (!result.ok) refuse(result);
      writeTree(draft, args.id, result.tree);
    },
  }),
  unwrapTreeNode: defineCommand({
    args: z.strictObject({ id: z.string(), path }),
    run: (args) => (draft) => {
      const result = unwrapNodeAt(readTree(draft, args.id), args.path);
      if (!result.ok) refuse(result);
      writeTree(draft, args.id, result.tree);
    },
  }),
};

/** A page that holds regions and plain blocks, plus the tree command stand-ins. */
export const TREE_FIXTURE_VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'tree-fixture-vocab',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'Page',
          props: z.object({}),
          slots: { default: { allow: ['region', 'text'] } },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'region',
          description: 'A composed region',
          props: z.object({
            label: z.string().optional(),
            tree: customCodeTree().default(emptyCustomCodeTree()),
            css: z.string().max(24_000).optional(),
          }),
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({ type: 'text', description: 'Text', props: z.object({}), examples: [] }),
        render: NullRender,
      },
    ],
    commands: FIXTURE_TREE_COMMANDS,
  },
};

/** Two regions (A: heading + card(list), B: one paragraph) and a text block. */
export function treeFixtureDocument(dir: 'ltr' | 'rtl' = 'ltr'): BuilderDocument {
  return {
    schemaVersion: 1,
    surface: 'site',
    dir,
    rootId: 'root',
    nodes: {
      root: { id: 'root', type: 'page', props: {}, slots: { default: ['rA', 'rB', 't1'] } },
      rA: {
        id: 'rA',
        type: 'region',
        props: {
          tree: {
            kind: 'root',
            children: [
              { kind: 'element', tag: 'h2', text: 'Our story', className: 'ck-glow text-4xl font-bold text-accent' },
              {
                kind: 'element',
                tag: 'div',
                className: 'flex flex-col gap-4 p-6',
                children: [
                  { kind: 'element', tag: 'p', text: 'First' },
                  { kind: 'element', tag: 'p', text: 'Second' },
                ],
              },
            ],
          },
          css: '.ck-glow { box-shadow: 0 0 8px currentColor; }',
        },
      },
      rB: {
        id: 'rB',
        type: 'region',
        props: {
          tree: { kind: 'root', children: [{ kind: 'element', tag: 'p', text: 'Elsewhere', className: 'text-sm' }] },
        },
      },
      t1: { id: 't1', type: 'text', props: {} },
    },
  };
}
