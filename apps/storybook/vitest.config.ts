import { fileURLToPath } from 'node:url';

import { createStorybookTestConfig } from '@craftkit/test-config/storybook';

const configDir = fileURLToPath(new URL('./.storybook', import.meta.url));
const setupFile = fileURLToPath(new URL('./.storybook/vitest.setup.ts', import.meta.url));

export default createStorybookTestConfig({
  configDir,
  setupFiles: [setupFile],
});
