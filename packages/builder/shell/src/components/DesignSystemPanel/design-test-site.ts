/*
  Test-only: a real site kernel for the design-system surfaces (P9).

  The shell does not depend on the custom-code extension, so this registers
  the smallest stand-ins with the same TYPES and the same command NAMES: a
  `customCode` region with a `tree` prop, a `customCodeSymbol` instance, an
  image block, and `patchTreeNode` / `setTreeNode` / `insertTreeNode` built on
  the same pure tree ops the extension's commands wrap. Everything else —
  the site dispatcher, the library commands, Undo — is the product's own.
*/
import { z } from 'zod';

import { createSiteBuilder, type BuilderSiteKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  builderError,
  customCodeTree,
  defaultDesignSystem,
  defineBlockSchema,
  emptyCustomCodeTree,
  insertNodeAt,
  LATEST_SITE_VERSION,
  patchNodeAt,
  setNodeAt,
  type AssetEntry,
  type BlockRenderComponent,
  type BuilderDocument,
  type BuilderSite,
  type CustomCodeNode,
  type CustomCodeRoot,
  type Node,
  type RegisteredCommand,
  type SiteLibrary,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

const NullRender: BlockRenderComponent = () => null;

function regionTree(node: Node | undefined): CustomCodeRoot {
  const tree = node?.props['tree'];
  if (node === undefined || typeof tree !== 'object' || tree === null) {
    throw builderError('cmd/structural-violation', 'No region tree here.');
  }
  return tree as unknown as CustomCodeRoot;
}

function treeCommand(
  run: (tree: CustomCodeRoot, args: Record<string, unknown>) => CustomCodeRoot,
): RegisteredCommand {
  return {
    argsSchema: z.looseObject({ id: z.string() }),
    apply: (raw) => (draft) => {
      const args = raw as Record<string, unknown>;
      const node = draft.nodes[String(args['id'])];
      const next = run(regionTree(node), args);
      if (node !== undefined) node.props['tree'] = next as never;
    },
  };
}

function unwrap<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  if (!result.ok) {
    throw builderError(
      'cmd/structural-violation',
      (result as unknown as { message: string }).message,
    );
  }
  return result as Extract<T, { ok: true }>;
}

export const DESIGN_TEST_VOCABULARY: TrustedExtensionManifest = {
  tier: 1,
  name: 'design-system-test',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'Page',
          props: z.object({}),
          slots: { default: { allow: ['customCode', 'customCodeSymbol', 'picture'] } },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'customCode',
          description: 'A composed region',
          props: z.object({
            label: z.string().max(80).default('Custom section'),
            tree: customCodeTree().default(emptyCustomCodeTree()),
            css: z.string().default(''),
          }),
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'customCodeSymbol',
          description: 'A symbol instance',
          props: z.object({
            label: z.string().max(80).default('Symbol'),
            symbolId: z.string(),
            overrides: z.array(z.looseObject({ path: z.array(z.number()) })).default([]),
          }),
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'picture',
          description: 'An image block',
          props: z.object({ image: z.looseObject({}).optional() }),
          examples: [],
        }),
        render: NullRender,
      },
    ],
    commands: {
      patchTreeNode: treeCommand((tree, args) => {
        const patch = {
          set: (args['set'] ?? {}) as Record<string, string | null>,
          attributes: (args['attributes'] ?? {}) as Record<string, string | null>,
        };
        return unwrap(patchNodeAt(tree, args['path'] as number[], patch)).tree;
      }),
      setTreeNode: treeCommand(
        (tree, args) =>
          unwrap(setNodeAt(tree, args['path'] as number[], args['node'] as CustomCodeNode)).tree,
      ),
      insertTreeNode: treeCommand(
        (tree, args) =>
          unwrap(
            insertNodeAt(
              tree,
              args['parent'] as number[],
              args['index'] as number,
              args['node'] as CustomCodeNode,
            ),
          ).tree,
      ),
    },
  },
};

export const THREE_CARDS: CustomCodeRoot = {
  kind: 'root',
  children: [
    {
      kind: 'element',
      tag: 'section',
      className: 'grid gap-4',
      children: [
        { kind: 'element', tag: 'article', className: 'group rounded-lg p-4 bg-accent', text: 'One' },
        { kind: 'element', tag: 'article', className: 'group rounded-lg p-4 bg-accent', text: 'Two' },
        { kind: 'element', tag: 'article', className: 'group rounded-lg p-4 bg-accent', text: 'Three' },
      ],
    },
  ],
};

export interface DesignTestSiteOptions {
  readonly tree?: CustomCodeRoot | undefined;
  readonly library?: SiteLibrary | undefined;
  readonly assets?: Readonly<Record<string, AssetEntry>> | undefined;
  /** Extra root children after the region (node id → node). */
  readonly extraNodes?: Readonly<Record<string, Node>> | undefined;
}

export function designTestDocument(options: DesignTestSiteOptions = {}): BuilderDocument {
  const extra = options.extraNodes ?? {};
  return {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: {
      root: {
        id: 'root',
        type: 'page',
        props: {},
        slots: { default: ['region', ...Object.keys(extra)] },
      },
      region: {
        id: 'region',
        type: 'customCode',
        props: { label: 'Cards', tree: (options.tree ?? THREE_CARDS) as never, css: '' },
      },
      ...extra,
    },
  };
}

export function designTestSite(options: DesignTestSiteOptions = {}): BuilderSite {
  return {
    siteVersion: LATEST_SITE_VERSION,
    dir: 'ltr',
    pages: [
      {
        id: 'home',
        address: '/',
        title: 'Home',
        purpose: 'Testing.',
        audience: 'tests',
        document: designTestDocument(options),
        regions: [],
      },
    ],
    sharedRegions: {},
    designSystem: defaultDesignSystem(),
    assets: { ...(options.assets ?? {}) },
    ...(options.library === undefined ? {} : { library: options.library }),
  };
}

/** A live site kernel over `designTestSite(options)`. */
export function createDesignTestKernel(options: DesignTestSiteOptions = {}): BuilderSiteKernel {
  return createSiteBuilder({
    site: designTestSite(options),
    extensions: [DESIGN_TEST_VOCABULARY],
    ports: { clock: fixedClock(1), ids: seededIds('design') },
  });
}

/** The region's tree on the home page, as it stands. */
export function homeTree(kernel: BuilderSiteKernel): CustomCodeRoot {
  const node = kernel.page('home').getDocument().nodes['region'];
  return node?.props['tree'] as unknown as CustomCodeRoot;
}
