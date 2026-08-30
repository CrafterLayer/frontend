import tailwindcss from '@tailwindcss/vite';
import type { StorybookConfig } from '@storybook/react-vite';

const config = {
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
  }),
} satisfies StorybookConfig;

export default config;
