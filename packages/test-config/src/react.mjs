import react from '@vitejs/plugin-react';
import { coverageConfigDefaults, defineConfig, mergeConfig } from 'vitest/config';

const defaults = defineConfig({
  plugins: [react()],
  test: {
    clearMocks: true,
    environment: 'jsdom',
    restoreMocks: true,
    setupFiles: ['@craftkit/test-config/setup'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      exclude: [...coverageConfigDefaults.exclude, '**/*.stories.*', '**/*.docs.mdx'],
      thresholds: {
        branches: 85,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
  },
});

export function createReactTestConfig(overrides = {}) {
  return mergeConfig(defaults, defineConfig(overrides));
}
