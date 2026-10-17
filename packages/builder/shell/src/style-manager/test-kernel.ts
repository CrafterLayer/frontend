/*
  Test-only kernel for the style manager.

  The shell may not import the custom-code extension, so the tests register a
  minimal `patchTreeNode` with the same argument shape and the same pure
  helper (`patchNodeAt`) behind it. What the tests prove is the PANEL's side
  of the contract — the steps it sends, how many transactions, the labels —
  and the real command's own validation is tested where it lives.
*/
import { z } from 'zod';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  builderError,
  customCodeTree,
  defineBlockSchema,
  emptyCustomCodeTree,
  patchNodeAt,
  type BlockRenderComponent,
  type BuilderDocument,
  type CustomCodeRoot,
  type RegisteredCommand,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

const NullRender: BlockRenderComponent = () => null;

const patchArgs = z.strictObject({
  id: z.string(),
  path: z.array(z.number().int().min(0)).min(1),
  set: z
    .strictObject({
      className: z.string().nullable().optional(),
      text: z.string().nullable().optional(),
    })
    .optional(),
  attributes: z.record(z.string(), z.string().nullable()).optional(),
});

const patchTreeNode: RegisteredCommand = {
  argsSchema: patchArgs,
  apply(raw) {
    const args = patchArgs.parse(raw);
    return (draft) => {
      const node = draft.nodes[args.id];
      if (node === undefined) throw builderError('cmd/structural-violation', 'no such region', ['id']);
      const tree = JSON.parse(JSON.stringify(node.props['tree'])) as CustomCodeRoot;
      const attributes = args.attributes ?? {};
      // The real door refuses unknown attributes; this stand-in refuses one so the
      // refusal path can be shown at the attribute.
      if (Object.hasOwn(attributes, 'onclick')) {
        throw builderError('cmd/invalid-args', 'onclick is not an attribute a tree may carry', ['attributes']);
      }
      const result = patchNodeAt(tree, args.path, {
        set: args.set ?? {},
        attributes,
      });
      if (!result.ok) throw builderError('cmd/invalid-args', result.message, ['path']);
      node.props['tree'] = result.tree as never;
    };
  },
};

export function styleTestManifest(withCommand: boolean): TrustedExtensionManifest {
  return {
    tier: 1,
    name: withCommand ? 'style-manager-test' : 'style-manager-test-bare',
    version: '1.0.0',
    contributes: {
      blocks: [
        {
          schema: defineBlockSchema({
            type: 'page',
            description: 'Page',
            props: z.object({}),
            slots: { default: { allow: ['region', 'card'] } },
            examples: [],
          }),
          render: NullRender,
        },
        {
          schema: defineBlockSchema({
            type: 'region',
            description: 'A composed region',
            props: z.object({
              label: z.string().max(80).default('Custom section'),
              tree: customCodeTree().default(emptyCustomCodeTree()),
            }),
            examples: [],
          }),
          render: NullRender,
        },
        {
          schema: defineBlockSchema({
            type: 'card',
            description: 'Card',
            props: z.object({
              title: z.string().default('Hi'),
              className: z.string().max(1000).default(''),
            }),
            propertyGroups: {
              title: { tab: 'content', section: 'Content' },
              className: { tab: 'design', section: 'Classes', kind: 'utility-classes' },
            },
            examples: [],
          }),
          render: NullRender,
        },
      ],
      ...(withCommand ? { commands: { patchTreeNode } } : {}),
    },
  };
}

export const TEST_TREE: CustomCodeRoot = {
  kind: 'root',
  children: [
    {
      kind: 'element',
      tag: 'section',
      className: 'grid gap-8 p-4',
      children: [
        { kind: 'element', tag: 'h2', className: 'text-lg', text: 'Our story' },
        { kind: 'element', tag: 'p', className: 'text-sm', text: 'Since 1999' },
        { kind: 'element', tag: 'a', className: 'text-lg', text: 'Read', attributes: { href: '/about' } },
        { kind: 'icon', name: 'mail', size: 20 },
      ],
    },
  ],
};

export function makeStyleTestKernel(
  options: { readonly withCommand?: boolean; readonly dir?: 'ltr' | 'rtl'; readonly tree?: CustomCodeRoot } = {},
): BuilderKernel {
  const document: BuilderDocument = {
    schemaVersion: 1,
    surface: 'site',
    dir: options.dir ?? 'ltr',
    rootId: 'root',
    nodes: {
      root: { id: 'root', type: 'page', props: {}, slots: { default: ['r1', 'c1'] } },
      r1: { id: 'r1', type: 'region', props: { label: 'Story', tree: (options.tree ?? TEST_TREE) as never } },
      c1: { id: 'c1', type: 'card', props: { title: 'Hello', className: 'p-4' } },
    },
  };
  return createBuilder({
    document,
    extensions: [styleTestManifest(options.withCommand ?? true)],
    ports: { clock: fixedClock(), ids: seededIds('sm') },
  });
}

/** The class string of the node at `path` in region r1. */
export function classAt(kernel: BuilderKernel, ...path: number[]): string | undefined {
  let node: unknown = kernel.getDocument().nodes['r1']?.props['tree'];
  for (const index of path) node = (node as { children: unknown[] }).children[index];
  return (node as { className?: string }).className;
}
