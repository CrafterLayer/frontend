import { createNodeTestConfig } from '@craftkit/test-config/node';

export default createNodeTestConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // A real AssetPack run encodes images with sharp: give it room on a cold cache.
    testTimeout: 60_000,
  },
});
