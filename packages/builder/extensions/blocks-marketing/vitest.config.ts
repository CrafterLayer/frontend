import { createReactTestConfig } from '@craftkit/test-config/react';

export default createReactTestConfig({
  test: {
    // This public entry carries CSS text; other component CSS stays mocked.
    css: { include: [/\/section-layout\.css\?raw$/u] },
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
    },
  },
});
