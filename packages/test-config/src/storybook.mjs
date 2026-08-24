import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export function createStorybookTestConfig({ configDir, setupFiles = [] }) {
  return defineConfig({
    plugins: [storybookTest({ configDir })],
    test: {
      name: 'storybook',
      setupFiles,
      browser: {
        enabled: true,
        headless: true,
        provider: playwright(),
        instances: [{ browser: 'chromium' }],
      },
    },
  });
}
