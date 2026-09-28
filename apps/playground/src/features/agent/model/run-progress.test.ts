import { describe, expect, it } from 'vitest';

import type { AiAgentEvent, AiPlan, AiRunFailure, AiValidatedProposal } from '@craftkit/builder';

import {
  activeStageId,
  appendLiveProgress,
  formatClock,
  formatElapsed,
  initialRunProgress,
  liveStageElapsed,
  MAX_LIVE_PROGRESS_LINES,
  receiptOf,
  reduceRunProgress,
  runStageKey,
  stagesWithLiveClock,
  type RunProgress,
} from './run-progress';

const PLAN: AiPlan = {
  rationale: 'Add a hero block to root.default.',
  commands: [{ command: 'insertNode', args: { type: 'hero', parentId: 'root' } }],
};
/* `plan.proposed` carries an authenticated proposal; the rows never read it. */
const PROPOSAL = {} as AiValidatedProposal;
const FAILURE: AiRunFailure = {
  source: 'provider',
  code: 'http-status',
  message: 'The assistant server answered with status 503.',
  retryable: true,
  status: 503,
};

type Payload = AiAgentEvent extends infer Event
  ? Event extends AiAgentEvent
    ? Omit<Event, 'runId' | 'seq' | 'at'>
    : never
  : never;

/** A run's events in order, each stamped the way `runAiAgent` stamps them. */
function script(runId = 'run-1') {
  let seq = 0;
  return (payload: Payload, at: number): AiAgentEvent => {
    const event: AiAgentEvent = { ...payload, runId, seq, at };
    seq += 1;
    return event;
  };
}

function rows(progress: RunProgress) {
  return progress.stages.map((stage) => [stage.id, stage.status, stage.detail] as const);
}

function feed(progress: RunProgress, events: readonly AiAgentEvent[]): RunProgress {
  return events.reduce(reduceRunProgress, progress);
}

describe('initialRunProgress', () => {
  it('opens on reading, with the live line already keyed', () => {
    const progress = initialRunProgress('never', 5_000);

    expect(rows(progress)).toEqual([
      ['reading', 'active', 'edit.started'],
      ['writing', 'pending', undefined],
    ]);
    expect(progress.startedAt).toBe(5_000);
    expect(progress.stageSince).toBe(5_000);
    expect(progress.failedAt).toBeNull();
    expect(runStageKey(progress)).toBe('edit.started');
  });

  it('adds the applying row only when the run may apply', () => {
    expect(initialRunProgress('auto', 0).stages.map(({ id }) => id)).toEqual([
      'reading',
      'writing',
      'applying',
    ]);
    expect(initialRunProgress('never', 0).stages.map(({ id }) => id)).not.toContain('applying');
  });
});

describe('reduceRunProgress', () => {
  it('maps every stage to a catalog key, never to prose', () => {
    const event = script();
    const keys: (string | null)[] = [];
    let progress = initialRunProgress('auto', 0);
    keys.push(runStageKey(progress));
    for (const next of [
      event({ type: 'context.ready', fragmentCount: 3, totalTokens: 90 }, 100),
      event({ type: 'plan.validating', attempt: 1 }, 200),
      event({ type: 'plan.repairing', issues: ['a', 'b'] }, 300),
      event({ type: 'plan.validating', attempt: 2 }, 400),
      event({ type: 'plan.proposed', plan: PLAN, proposal: PROPOSAL }, 500),
    ]) {
      progress = reduceRunProgress(progress, next);
      keys.push(runStageKey(progress));
    }
    progress = reduceRunProgress(
      progress,
      event({ type: 'run.completed', status: 'applied' }, 600),
    );
    keys.push(runStageKey(progress));

    expect(keys).toEqual([
      'edit.started',
      'edit.writing',
      'edit.checking',
      'edit.repairing',
      'edit.checking',
      'edit.applying',
      null,
    ]);
  });

  it('measures each settled row in milliseconds and keeps no live line on it', () => {
    const event = script();
    const progress = feed(initialRunProgress('never', 10_000), [
      event({ type: 'context.ready', fragmentCount: 1, totalTokens: 1 }, 11_123),
      event({ type: 'plan.proposed', plan: PLAN, proposal: PROPOSAL }, 14_000),
      event({ type: 'run.completed', status: 'proposed' }, 14_010),
    ]);

    expect(progress.stages).toEqual([
      { id: 'reading', status: 'done', elapsedMs: 1_123 },
      { id: 'writing', status: 'done', elapsedMs: 2_877 },
    ]);
    // The run's origin never moves, whatever the rows do.
    expect(progress.startedAt).toBe(10_000);
    expect(progress.stageSince).toBeNull();
  });

  it('hands back the same reference for every event that moves no row', () => {
    const event = script();
    const initial = initialRunProgress('never', 0);

    for (const quiet of [
      event({ type: 'run.started', apply: 'never' }, 1),
      event({ type: 'skills.resolving' }, 2),
      event({ type: 'skills.resolved', activations: [], omitted: [], totalTokens: 0 }, 3),
      event({ type: 'context.gathering' }, 4),
      event({ type: 'plan.proposing' }, 5),
      event({ type: 'plan.progress', text: 'Thinking about the hero…' }, 6),
      event({ type: 'plan.applying' }, 7),
      // Checking before the writing row is open moves nothing.
      event({ type: 'plan.validating', attempt: 1 }, 8),
    ]) {
      expect(reduceRunProgress(initial, quiet)).toBe(initial);
    }
  });

  it('ignores a repeated check on the same key (reference-equal)', () => {
    const event = script();
    const checking = feed(initialRunProgress('never', 0), [
      event({ type: 'context.ready', fragmentCount: 1, totalTokens: 1 }, 10),
      event({ type: 'plan.validating', attempt: 1 }, 20),
    ]);

    expect(reduceRunProgress(checking, event({ type: 'plan.validating', attempt: 2 }, 30))).toBe(
      checking,
    );
  });

  it('never opens an applying row on a run that could not apply', () => {
    const event = script();
    const progress = feed(initialRunProgress('never', 0), [
      event({ type: 'context.ready', fragmentCount: 1, totalTokens: 1 }, 10),
      event({ type: 'plan.proposed', plan: PLAN, proposal: PROPOSAL }, 20),
    ]);

    expect(rows(progress)).toEqual([
      ['reading', 'done', undefined],
      ['writing', 'done', undefined],
    ]);
    expect(activeStageId(progress)).toBeNull();
  });

  it('fails the active row and remembers where, without keeping the provider text', () => {
    const event = script();
    const progress = feed(initialRunProgress('auto', 0), [
      event({ type: 'context.ready', fragmentCount: 1, totalTokens: 1 }, 100),
      event({ type: 'run.failed', error: FAILURE }, 400),
    ]);

    expect(progress.failedAt).toBe('writing');
    expect(progress.stages[1]).toEqual({ id: 'writing', status: 'failed', elapsedMs: 300 });
    expect(JSON.stringify(progress)).not.toContain('503');
  });

  it('cancels the active row when the run is stopped', () => {
    const event = script();
    const progress = feed(initialRunProgress('auto', 0), [
      event({ type: 'run.cancelled', error: { ...FAILURE, code: 'cancelled' } }, 250),
    ]);

    expect(progress.stages[0]).toEqual({ id: 'reading', status: 'cancelled', elapsedMs: 250 });
    expect(progress.failedAt).toBeNull();
    expect(progress.stageSince).toBeNull();
  });

  it('leaves a settled run alone: no row can be re-opened or re-settled', () => {
    const event = script();
    const settled = feed(initialRunProgress('never', 0), [
      event({ type: 'run.cancelled', error: { ...FAILURE, code: 'cancelled' } }, 50),
    ]);

    for (const late of [
      event({ type: 'context.ready', fragmentCount: 1, totalTokens: 1 }, 60),
      event({ type: 'run.completed', status: 'proposed' }, 70),
      event({ type: 'run.failed', error: FAILURE }, 80),
    ]) {
      expect(reduceRunProgress(settled, late)).toBe(settled);
    }
  });
});

describe('formatClock', () => {
  it('prints m:ss, minutes unpadded, to the second and never finer', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(4_999)).toBe('0:04');
    expect(formatClock(141_000)).toBe('2:21');
    expect(formatClock(3_725_000)).toBe('62:05');
  });

  it('never prints a negative clock, and prints Latin digits only', () => {
    expect(formatClock(-1_000)).toBe('0:00');
    expect(formatClock(112_000)).toMatch(/^[0-9:]+$/u);
  });
});

describe('formatElapsed (Technical details only)', () => {
  it('prints minutes, seconds and milliseconds, always padded, never negative', () => {
    expect(formatElapsed(1_123)).toBe('00:01.123');
    expect(formatElapsed(61_004)).toBe('01:01.004');
    expect(formatElapsed(-40)).toBe('00:00.000');
  });
});

describe('receiptOf', () => {
  it('measures the whole run and names the row that was cancelled', () => {
    const event = script();
    const progress = feed(initialRunProgress('auto', 1_000), [
      event({ type: 'context.ready', fragmentCount: 1, totalTokens: 1 }, 2_000),
      event({ type: 'run.cancelled', error: { ...FAILURE, code: 'cancelled' } }, 7_500),
    ]);

    expect(receiptOf(progress, 7_500)).toEqual({ elapsedMs: 6_500, stage: 'writing' });
  });

  it('names the failed row, and the open one for a run a reload ended', () => {
    const event = script();
    const failed = feed(initialRunProgress('auto', 0), [
      event({ type: 'run.failed', error: FAILURE }, 900),
    ]);
    expect(receiptOf(failed, 900)?.stage).toBe('reading');

    const open = initialRunProgress('auto', 0);
    expect(receiptOf(open, open.stageSince ?? 0)).toEqual({ elapsedMs: 0, stage: 'reading' });
  });

  it('says nothing about a run with no usable clock', () => {
    expect(receiptOf(initialRunProgress('auto', Number.NaN), 10)).toBeNull();
    expect(receiptOf(initialRunProgress('auto', 0), Number.NaN)).toBeNull();
  });
});

describe('the live clock (Technical details only)', () => {
  it('measures the active row from the caller clock and leaves settled rows alone', () => {
    const event = script();
    const progress = feed(initialRunProgress('never', 0), [
      event({ type: 'context.ready', fragmentCount: 1, totalTokens: 1 }, 1_000),
    ]);

    expect(liveStageElapsed(progress, 4_000)).toBe(3_000);
    expect(stagesWithLiveClock(progress, 4_000)).toEqual([
      { id: 'reading', status: 'done', elapsedMs: 1_000 },
      { id: 'writing', status: 'active', detail: 'edit.writing', elapsedMs: 3_000 },
    ]);
  });

  it('hands back the same stages once nothing runs', () => {
    const event = script();
    const settled = feed(initialRunProgress('never', 0), [
      event({ type: 'run.failed', error: FAILURE }, 10),
    ]);

    expect(liveStageElapsed(settled, 99)).toBeNull();
    expect(stagesWithLiveClock(settled, 99)).toBe(settled.stages);
  });
});

describe('appendLiveProgress (Technical details only)', () => {
  it('drops blanks and immediate repeats, and keeps a bounded tail', () => {
    let log = appendLiveProgress(undefined, '  ');
    expect(log).toEqual([]);
    log = appendLiveProgress(log, 'one');
    expect(appendLiveProgress(log, 'one')).toBe(log);
    for (let index = 0; index < MAX_LIVE_PROGRESS_LINES + 5; index += 1) {
      log = appendLiveProgress(log, `line ${String(index)}`);
    }
    expect(log).toHaveLength(MAX_LIVE_PROGRESS_LINES);
    expect(log.at(-1)).toBe(`line ${String(MAX_LIVE_PROGRESS_LINES + 4)}`);
  });
});
