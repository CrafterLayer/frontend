import { baseConfig } from '@craftkit/eslint-config/base';
import { headlessConfig } from '@craftkit/eslint-config/headless';
import { reactConfig } from '@craftkit/eslint-config/react';
import { storybookConfig } from '@craftkit/eslint-config/storybook';

export default [
  ...baseConfig,
  ...reactConfig,
  ...storybookConfig,
  ...headlessConfig(['packages/builder/schema/src/**', 'packages/builder/core/src/**']),
];
