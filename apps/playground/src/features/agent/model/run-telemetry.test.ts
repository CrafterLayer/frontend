import { describe, expect, it } from 'vitest';
import type { AiAgentEvent } from '@craftkit/builder';
import { EMPTY_RUN_TELEMETRY, reduceRunTelemetry, telemetryTotals } from './run-telemetry';

const base = { runId: 'build/fill-1', at: 1, seq: 1 };
const measured = { inputTokens: 13, outputTokens: 7, cacheReadTokens: 3, cacheWriteTokens: null };
const event: AiAgentEvent = {
  ...base,
  type: 'provider.usage',
  attemptId: 'build/fill-1/attempt-1',
  usage: measured,
};
describe('run telemetry', () => {
  it.each(['usage', 'start'] as const)(
    'keeps the ledger bounded and totals unknown after the 65th %s',
    (kind) => {
      let state = EMPTY_RUN_TELEMETRY;
      const usage = {
        inputTokens: 1,
        outputTokens: 1,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        costUsd: 0.01,
      };
      for (let i = 1; i <= 64; i += 1) {
        const runId = `physical-${String(i)}`;
        state = reduceRunTelemetry(state, { ...base, runId, type: 'plan.proposing' });
        state = reduceRunTelemetry(state, {
          ...event,
          runId,
          attemptId: `${runId}/attempt-1`,
          usage,
        });
      }
      expect(telemetryTotals(state).inputTokens).toBe(64);
      const runId = 'physical-65';
      state = reduceRunTelemetry(
        state,
        kind === 'usage'
          ? { ...event, runId, attemptId: `${runId}/attempt-1`, usage }
          : { ...base, runId, type: 'plan.proposing' },
      );
      expect(Object.keys(state.attempts)).toHaveLength(64);
      expect(state.startedEvents?.length).toBeLessThanOrEqual(64);
      expect(state.overflowed).toBe(true);
      expect(telemetryTotals(state)).toMatchObject({
        inputTokens: null,
        outputTokens: null,
        cacheReadTokens: null,
        cacheWriteTokens: null,
        costUsd: null,
      });
      // A later known/duplicate receipt cannot clear evidence that some calls were omitted.
      state = reduceRunTelemetry(state, {
        ...event,
        runId: 'physical-1',
        attemptId: 'physical-1/attempt-1',
        usage,
      });
      expect(state.overflowed).toBe(true);
      expect(telemetryTotals(state).inputTokens).toBeNull();
    },
  );
  it('attributes public activity and ignores private narration from older peers', () => {
    const state = reduceRunTelemetry(
      undefined,
      { ...base, type: 'plan.progress', text: 'Writing the design…' },
      'Hero',
    );
    expect(state.activity).toEqual([{ stage: 'writing', scope: 'Hero' }]);
    expect(
      reduceRunTelemetry(state, { ...base, type: 'plan.progress', text: 'Private reasoning text' }),
    ).toBe(state);
    expect(
      reduceRunTelemetry(
        state,
        { ...base, type: 'plan.progress', text: 'Writing the design…' },
        'Hero',
      ),
    ).toBe(state);
  });
  it('deduplicates measured attempts and keeps partial counts unknown', () => {
    const state = reduceRunTelemetry(EMPTY_RUN_TELEMETRY, event);
    expect(reduceRunTelemetry(state, event)).toBe(state);
    expect(telemetryTotals(state)).toMatchObject({
      inputTokens: 13,
      outputTokens: 7,
      cacheWriteTokens: null,
      costUsd: null,
    });
  });
  it('does not describe unreported parallel calls as fully measured', () => {
    const started = reduceRunTelemetry(undefined, { ...base, type: 'plan.proposing' });
    const other = reduceRunTelemetry(started, {
      ...base,
      runId: 'build/fill-2',
      type: 'plan.proposing',
    });
    expect(telemetryTotals(reduceRunTelemetry(other, event)).inputTokens).toBeNull();
  });
  it('includes an unmeasured page planner and deduplicates repeated call-start events', () => {
    const start = { ...base, type: 'plan.proposing' as const };
    const first = reduceRunTelemetry(undefined, start);
    expect(reduceRunTelemetry(first, start)).toBe(first);
    const planner = reduceRunTelemetry(first, {
      ...base,
      runId: 'build/page-plan',
      type: 'page-plan.proposing',
      attempt: 1,
    });
    const state = reduceRunTelemetry(planner, event);
    expect(telemetryTotals(state)).toMatchObject({
      requests: 2,
      inputTokens: null,
      outputTokens: null,
    });
  });
  it('adds independent usage exactly once and local cached replies add zero', () => {
    const one = reduceRunTelemetry(undefined, event);
    const two = reduceRunTelemetry(one, {
      ...event,
      runId: 'build/fill-2',
      attemptId: 'build/fill-2/attempt-1',
    });
    const cached = reduceRunTelemetry(two, {
      ...event,
      runId: 'cache',
      attemptId: 'cache/attempt-1',
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        costUsd: 0,
        cached: true,
      },
    });
    expect(telemetryTotals(cached)).toMatchObject({
      inputTokens: 26,
      outputTokens: 14,
      cachedReplies: 1,
    });
  });
});
