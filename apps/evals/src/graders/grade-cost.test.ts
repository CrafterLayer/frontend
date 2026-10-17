import { describe, expect, it } from 'vitest';

import { gradeCost } from './grade-cost';
import { evalCase, runOutput } from './test-support';

const budgeted = evalCase({
  budget: { maxCommands: 4, maxContextTokens: 10_000, maxElapsedMs: 5_000 },
});

describe('gradeCost', () => {
  it('passes and scores 1 when everything is inside budget', () => {
    const result = gradeCost(
      runOutput({
        metrics: {
          commandCount: 2,
          contextFragments: 3,
          contextTokens: 900,
          elapsedMs: 50,
          attempts: 1,
          repaired: false,
          salvaged: null,
        },
      }),
      budgeted,
    );
    expect(result.pass).toBe(true);
    expect(result.score).toBe(1);
    expect(result.reason).toContain('2/4 commands');
  });

  it('fails a plan with more commands than the case allows', () => {
    const result = gradeCost(
      runOutput({
        metrics: {
          commandCount: 9,
          contextFragments: 3,
          contextTokens: 900,
          elapsedMs: 50,
          attempts: 1,
          repaired: false,
          salvaged: null,
        },
      }),
      budgeted,
    );
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('command count');
  });

  it('fails a run that spent more context than the case allows', () => {
    const result = gradeCost(
      runOutput({
        metrics: {
          commandCount: 1,
          contextFragments: 40,
          contextTokens: 99_000,
          elapsedMs: 50,
          attempts: 1,
          repaired: false,
          salvaged: null,
        },
      }),
      budgeted,
    );
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('context tokens');
  });

  it('reports slowness without failing the row', () => {
    /*
      Latency is a property of the machine, not of the plan. A gate on it goes
      red on a loaded CI box for reasons no prompt change can fix, and a suite
      that goes red for unfixable reasons gets muted.
    */
    const result = gradeCost(
      runOutput({
        metrics: {
          commandCount: 1,
          contextFragments: 3,
          contextTokens: 900,
          elapsedMs: 60_000,
          attempts: 1,
          repaired: false,
          salvaged: null,
        },
      }),
      budgeted,
    );
    expect(result.pass).toBe(true);
    expect(result.score).toBeLessThan(1);
    expect(result.reason).toContain('slow');
  });

  it('passes a refusal against a zero-command budget', () => {
    const result = gradeCost(
      runOutput({
        outcome: 'refusal',
        plan: null,
        policy: null,
        metrics: {
          commandCount: 0,
          contextFragments: 3,
          contextTokens: 900,
          elapsedMs: 10,
          attempts: 1,
          repaired: false,
          salvaged: null,
        },
      }),
      evalCase({ budget: { maxCommands: 0, maxContextTokens: 10_000, maxElapsedMs: 5_000 } }),
    );
    expect(result.pass).toBe(true);
  });
});
