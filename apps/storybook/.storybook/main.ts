import type { StorybookConfig } from '@storybook/react-vite';

const config = {
  stories: [
    '../../../packages/ui/src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    '../../../packages/ui/src/**/*.docs.mdx',
  ],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-vitest'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
} satisfies StorybookConfig;

export default config;
