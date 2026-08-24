import { baseConfig } from '@craftkit/eslint-config/base';
import { reactConfig } from '@craftkit/eslint-config/react';
import { storybookConfig } from '@craftkit/eslint-config/storybook';

export default [...baseConfig, ...reactConfig, ...storybookConfig];
