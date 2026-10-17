import { baseConfig } from '@craftkit/eslint-config/base';
import { headlessConfig } from '@craftkit/eslint-config/headless';

export default [...baseConfig, ...headlessConfig(['src/**'])];
