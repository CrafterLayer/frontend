import { createReactTestConfig } from '@craftkit/test-config/react';

export default createReactTestConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx'],
    },
  },
});
