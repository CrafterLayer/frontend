import { createReactTestConfig } from '@craftkit/test-config/react';

export default createReactTestConfig({
  test: {
    include: ['src/**/*.test.ts?(x)'],
    coverage: {
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      reporter: ['text', 'json-summary'],
    },
  },
});
