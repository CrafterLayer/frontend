import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import type { StorybookConfig } from '@storybook/react-vite';

const storybookRoot = fileURLToPath(new URL('..', import.meta.url));
const playgroundRoot = fileURLToPath(new URL('../../playground', import.meta.url));

/*
  Radix packages the playground (the agent panel) imports, read from its own
  manifest so a new one is pre-bundled without anyone remembering this file.
*/
const playgroundManifest = JSON.parse(
  readFileSync(path.join(playgroundRoot, 'package.json'), 'utf8'),
) as { dependencies?: Record<string, string> };
const playgroundRadix = Object.keys(playgroundManifest.dependencies ?? {}).filter((name) =>
  name.startsWith('@radix-ui/'),
);

/*
  Pre-bundle the playground's Radix packages up front. Left to discovery, a
  vitest run whose dep cache predates an import finds it mid-run, re-optimizes,
  and Vite reloads the page under a running test: ~100 stories then fail in a
  row and the run hangs with no output.

  A bare id does not work here. These are dependencies of apps/playground, not
  of this app, so `@radix-ui/react-dialog` does not resolve from Storybook's
  Vite root and Vite skips it ("Failed to resolve dependency"). Vite's nested
  syntax `parent > dep` resolves `dep` from `parent`'s directory, and Vite finds
  `parent` at `<root>/node_modules/<parent>/package.json`; a `parent` written
  relative to `<root>/node_modules` therefore anchors the lookup at
  apps/playground. When a playground file then imports the bare id, Vite matches
  it to the nested entry by resolved file, so nothing is discovered mid-run.
*/
function playgroundRadixIncludes(root: string): string[] {
  const anchor = path.relative(path.join(root, 'node_modules'), playgroundRoot);
  return playgroundRadix.map((name) => `${anchor} > ${name}`);
}

const config = {
  /*
    Docs pages: every component with a `*.docs.mdx` attaches it with
    `<Meta of={Stories} />`, and that MDX IS the component's docs page. Such a
    stories file must NOT also carry `tags: ['autodocs']` — Storybook 10's
    indexer refuses the pair as a duplicate docs entry ("You created a
    component docs page … but also tagged the CSF file with 'autodocs'"), and
    one such pair failed this app's test task on every run. Keep `autodocs`
    only on a stories file that has no attached MDX.
  */
  stories: [
    '../../../packages/ui/src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    '../../../packages/ui/src/**/*.docs.mdx',
    '../../../packages/builder/*/src/**/*.stories.@(ts|tsx)',
    '../../../packages/builder/*/src/**/*.docs.mdx',
    '../../../packages/builder/extensions/*/src/**/*.stories.@(ts|tsx)',
    '../../../packages/builder/extensions/*/src/**/*.docs.mdx',
    '../../../apps/playground/src/**/*.stories.@(ts|tsx)',
    '../../../apps/playground/src/**/*.docs.mdx',
    '../../../apps/adaptive-spec-router/src/**/*.stories.@(ts|tsx)',
    '../../../apps/adaptive-spec-router/src/**/*.docs.mdx',
  ],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-vitest'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  /*
    Storybook owns its own Vite config, so the Tailwind plugin has to be added
    here as well as in the playground. Without it the catalog renders every
    utility as an unknown class and a component that is correct in the product
    looks broken in review.
  */
  viteFinal: (config) => ({
    ...config,
    plugins: [...(config.plugins ?? []), tailwindcss()],
    optimizeDeps: {
      ...config.optimizeDeps,
      include: [
        ...(config.optimizeDeps?.include ?? []),
        ...playgroundRadixIncludes(config.root ?? storybookRoot),
      ],
    },
  }),
} satisfies StorybookConfig;

export default config;
