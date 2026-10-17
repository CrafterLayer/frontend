import { coverageConfigDefaults, defineConfig, mergeConfig } from 'vitest/config';

const defaults = defineConfig({
  test: {
    clearMocks: true,
    environment: 'node',
    restoreMocks: true,
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

export function createNodeTestConfig(overrides = {}) {
  return mergeConfig(defaults, defineConfig(overrides));
}
