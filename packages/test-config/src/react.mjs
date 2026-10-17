import react from '@vitejs/plugin-react';
import { coverageConfigDefaults, defineConfig, mergeConfig } from 'vitest/config';

const defaults = defineConfig({
  plugins: [react()],
  test: {
    clearMocks: true,
    environment: 'jsdom',
    // Under a full `pnpm verify` every package shares the machine with a dozen
    // vitest workers plus a Chromium suite, and the FIRST test in a file absorbs
    // jsdom + userEvent warmup on a starved CPU. Vitest's 5s default is a
    // unit-test budget; state the real one instead of letting correct tests fail
    // on contention (playground precedent). A genuine hang still fails, later.
    testTimeout: 30_000,
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
