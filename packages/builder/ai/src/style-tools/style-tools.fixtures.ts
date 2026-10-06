import { z } from 'zod';

import { createBuilder, createSiteBuilder, defineCommand, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  builderError,
  type BuilderSite,
  type CustomCodeRoot,
  type JsonValue,
  type RegisteredCommand,
  type TrustedExtensionManifest,
  utilityVocabulary,
} from '@craftkit/builder-schema';
import { onePageSite } from '@craftkit/builder-schema/testing';

import { agentToolsFixtureBlocks, fixtureDocument, type FixtureOptions } from '../tools/agent/agent-tools.fixtures';
import { applyTreeStep, asTreeRoot, TREE_COMMANDS } from './tree-steps';

/*
  Test-only. The ai package (layer 2) may not depend on the custom-code
  extension (layer 4), so its nine tree commands are registered here as the
  same thing the extension contributes: page commands that apply the schema's
  pure ops and the tree door (customCodeTreeProblems + customCodeTreeSchema)
  through `applyTreeStep`, then write the region's `tree` prop. The real
  handlers are exercised end to end in P11's integration pass.
*/

function treeCommand(name: string): RegisteredCommand {
  return defineCommand({
    args: z.looseObject({ id: z.string().min(1) }),
    run: (args) => (draft) => {
      const result = applyTreeStep({ command: name, args }, (id) => {
        const node = draft.nodes[id];
        return node === undefined ? undefined : asTreeRoot(JSON.parse(JSON.stringify(node.props['tree'] ?? null)));
      });
      if (!result.ok) throw builderError('cmd/structural-violation', result.error);
      for (const [id, tree] of result.writes) {
        const node = draft.nodes[id];
        if (node !== undefined) node.props['tree'] = tree as unknown as JsonValue;
      }
    },
  });
}

export const treeCommandsFixture: TrustedExtensionManifest = {
  tier: 1,
  name: 'tree-commands-fixture',
  version: '0.0.0',
  contributes: {
    commands: Object.fromEntries(TREE_COMMANDS.map((name) => [name, treeCommand(name)])),
  },
};

/** The agent-tools fixture page, with the tree commands registered. */
export function styleKernel(options: FixtureOptions = {}): BuilderKernel {
  return createBuilder({
    document: fixtureDocument(options),
    extensions: [agentToolsFixtureBlocks, treeCommandsFixture],
    ports: { clock: fixedClock(1), ids: seededIds('style-tools') },
  });
}

/** The same page inside a one-page site; returns the site and its page lens (site commands route). */
export function styleSite(options: FixtureOptions = {}): { site: ReturnType<typeof createSiteBuilder>; page: BuilderKernel } {
  const base = onePageSite(options.locale === 'ar' ? 'rtl' : 'ltr');
  const [home] = base.pages;
  if (home === undefined) throw new Error('fixture: no home page');
  const site: BuilderSite = { ...base, pages: [{ ...home, document: fixtureDocument(options) }] };
  const kernel = createSiteBuilder({
    site,
    extensions: [agentToolsFixtureBlocks, treeCommandsFixture],
    ports: { clock: fixedClock(1), ids: seededIds('style-site') },
  });
  return { site: kernel, page: kernel.page(home.id) };
}

/** A region's tree as the kernel holds it. */
export function treeOf(kernel: BuilderKernel, id: string): CustomCodeRoot {
  const tree = asTreeRoot(kernel.getDocument().nodes[id]?.props['tree']);
  if (tree === undefined) throw new Error(`fixture: ${id} has no tree`);
  return tree;
}

/**
 * The live compiler's verdict, approximated for tests: the static vocabulary
 * plus any arbitrary value / CSS-variable utility (what Tailwind 4 generates
 * on demand in the product, where the renderer registers the real oracle).
 */
export function permissiveOracle(name: string): boolean {
  if (/\[[^\]]+\]|\(--[a-z0-9-]+\)/u.test(name)) return true;
  // Any variant stack (max-md:, hover:, max-lg:focus-visible:) over a utility the vocabulary has.
  const base = name.slice(name.lastIndexOf(':') + 1);
  return base !== name && utilityVocabulary().has(base);
}
