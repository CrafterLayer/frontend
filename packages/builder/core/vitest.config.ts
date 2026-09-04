import { createNodeTestConfig } from '@craftkit/test-config/node';

export default createNodeTestConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      include: ['src/**/*.ts'],
      /*
        A `.spike.ts` is exploratory code that exists to answer ONE architecture
        question with a pass/fail criterion written before it was built. It
        ships nothing — nothing imports `site-kernel.spike.ts` but its own test
        — and the module it informs is written fresh, with full tests, in the
        delivery that follows.
        Holding it to the shipped-code thresholds measures the wrong thing in
        both directions: it would push a spike toward completeness it was
        deliberately denied (no persistence, no extension lifecycle, no site
        commands), and it dilutes the number that is supposed to say how well
        the SHIPPED kernel is tested. Measured: with the spike counted, function
        coverage reads 87.3% and branch 82%; without it, 97.9% and 85.3%.
        The spike's own suite still runs on every `pnpm test`, and its findings
        are recorded where the delivery will read them.
      */
      exclude: ['src/**/*.spike.ts'],
    },
  },
});
