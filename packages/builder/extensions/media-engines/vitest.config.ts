import { createNodeTestConfig } from '@craftkit/test-config/node';

export default createNodeTestConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    coverage: {
      include: ['src/**/*.ts'],
      // Scenes draw through a real WebGL context; they are exercised in the static-preview live check.
      exclude: ['src/scenes/**', 'src/entry.ts', 'src/pixi-entry.ts'],
    },
  },
});
