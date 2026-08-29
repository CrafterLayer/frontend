import { createNodeTestConfig } from '@craftkit/test-config/node';

export default createNodeTestConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      include: ['src/**/*.ts'],
    },
  },
});
