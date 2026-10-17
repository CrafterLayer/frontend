import { describe, expect, it } from 'vitest';

import { createUsageLedger, type AttemptUsage } from './usage';

function usage(overrides: Partial<AttemptUsage> = {}): AttemptUsage {
  return {
    runId: 'run',
    unitId: 'hero',
    attempt: 1,
    stage: 'generation',
    provider: 'openai',
    model: 'gpt-5.6-terra',
    accepted: false,
    failed: false,
    latencyMs: 100,
    inputTokens: 100,
    cachedInputTokens: 20,
    cacheWriteTokens: 4,
    outputTokens: 40,
    costUsd: 0.1,
    ...overrides,
  };
}

describe('usage ledger', () => {
  it('includes failed, repair, review, and escalation spend in accepted-output cost', () => {
    const ledger = createUsageLedger();
    ledger.record(usage({ failed: true, costUsd: 0.1 }));
    ledger.record(usage({ attempt: 2, stage: 'technical-repair', failed: true, costUsd: 0.2 }));
    ledger.record(usage({ attempt: 3, stage: 'visual-repair', costUsd: 0.3 }));
    ledger.record(usage({ attempt: 4, stage: 'review', costUsd: 0.4 }));
    ledger.record(usage({ attempt: 5, stage: 'escalation', accepted: true, costUsd: 1 }));

    expect(ledger.summary()).toMatchObject({
      attempts: 5,
      acceptedOutputs: 1,
      failedAttempts: 2,
      technicalRepairs: 1,
      visualRepairs: 1,
      reviews: 1,
      escalations: 1,
      totalCostUsd: 2,
      acceptedOutputCostUsd: 2,
    });
  });

  it('divides all attributable attempts by the count of accepted outputs', () => {
    const ledger = createUsageLedger();
    ledger.record(usage({ accepted: true, costUsd: 1 }));
    ledger.record(usage({ unitId: 'pricing', accepted: true, costUsd: 2 }));
    expect(ledger.summary().acceptedOutputCostUsd).toBe(1.5);
  });

  it('preserves unknown provider usage instead of counting it as zero', () => {
    const ledger = createUsageLedger();
    ledger.record(
      usage({
        accepted: true,
        cachedInputTokens: null,
        cacheWriteTokens: null,
        costUsd: null,
      }),
    );

    expect(ledger.summary()).toMatchObject({
      cachedInputTokens: null,
      cacheWriteTokens: null,
      totalCostUsd: null,
      acceptedOutputCostUsd: null,
      unknownFields: ['cacheWriteTokens', 'cachedInputTokens', 'costUsd'],
    });
  });

  it('does not expose mutable ledger records', () => {
    const ledger = createUsageLedger();
    ledger.record(usage());
    const read = ledger.attempts() as AttemptUsage[];
    read.splice(0);
    expect(ledger.summary().attempts).toBe(1);
  });
});
