import { createReactTestConfig } from '@craftkit/test-config/react';

export default createReactTestConfig({
  // Tests never read the developer's `.env.local`. Loading it pointed the app at
  // the live ai-server (the model picker fetched /v1/models, failing the
  // "no network" scenarios) and printed its bearer token in failure output.
  // CI has no env file either, so this is the configuration the suite is for.
  envDir: false,
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    // These are END-TO-END app scenarios: each one mounts the whole playground and
    // drives a real journey, and several resolve the LAZY EDITOR ROAD — a dynamic
    // import plus an editing engine mounting. That is legitimately slower than a
    // component render, and under `pnpm verify` every package competes for the same
    // CPU. Vitest's 5s default is a unit-test budget; state the real one instead of
    // letting correct tests fail on contention. A genuine hang still fails, just later.
    testTimeout: 30_000,
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx'],
    },
  },
});
