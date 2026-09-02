import { describe, expect, it } from 'vitest';

import type { AiAgentEvent, AiPlan, AiRunFailure, AiValidatedProposal } from '@craftkit/builder';

import {
  activeStageId,
  formatElapsed,
  initialRunProgress,
  reduceRunProgress,
  type RunProgress,
} from './AssistantPanel.progress';

const PLAN: AiPlan = {
  rationale: 'Add a hero block to root.default.',
  commands: [{ command: 'insertNode', args: { type: 'hero', parentId: 'root' } }],
};
/* The runner's `plan.proposed` carries an authenticated proposal; the rows
   never read it, so a bare object stands in for one here. */
const PROPOSAL = {} as AiValidatedProposal;
const FAILURE: AiRunFailure = {
  source: 'provider',
  code: 'http-status',
  message: 'The assistant is temporarily busy.',
  retryable: true,
  status: 503,
};

type Payload = AiAgentEvent extends infer Event
  ? Event extends AiAgentEvent
    ? Omit<Event, 'runId' | 'seq' | 'at'>
    : never
  : never;

/** A run's events in order, each stamped like the runner stamps them. */
function script(runId = 'run-1') {
  let seq = 0;
  return (payload: Payload, at: number): AiAgentEvent => {
    const event: AiAgentEvent = { ...payload, runId, seq, at };
    seq += 1;
    return event;
  };
}

function rows(progress: RunProgress): readonly (readonly [string, string, string | undefined])[] {
  return progress.stages.map((stage) => [stage.id, stage.status, stage.detail] as const);
}

describe('formatElapsed', () => {
  it('prints minutes, seconds and milliseconds, always padded', () => {
    expect(formatElapsed(0)).toBe('00:00.000');
    expect(formatElapsed(1123)).toBe('00:01.123');
    expect(formatElapsed(61004)).toBe('01:01.004');
    expect(formatElapsed(310)).toBe('00:00.310');
  });

  it('never prints a negative or fractional receipt', () => {
    expect(formatElapsed(-40)).toBe('00:00.000');
    expect(formatElapsed(1123.6)).toBe('00:01.124');
  });
});

describe('initialRunProgress', () => {
  it('starts with Plan active the instant the run is asked for', () => {
    const progress = initialRunProgress('never', 5_000);

    expect(rows(progress)).toEqual([
      ['sitemap', 'active', undefined],
      ['structure', 'pending', undefined],
    ]);
    expect(progress.stageSince).toBe(5_000);
    expect(progress.failedAt).toBeNull();
    expect(activeStageId(progress)).toBe('sitemap');
  });

  it('adds the Apply row only when the run may apply', () => {
    expect(initialRunProgress('auto', 0).stages.map(({ id }) => id)).toEqual([
      'sitemap',
      'structure',
      'assembly',
    ]);
    expect(initialRunProgress('never', 0).stages.map(({ id }) => id)).not.toContain('assembly');
  });
});

describe('reduceRunProgress', () => {
  it('follows a proposing run through its rows, and hands back the same reference on a no-op', () => {
    const event = script();
    const t0 = 10_000;
    const initial = initialRunProgress('never', t0);

    const started = reduceRunProgress(initial, event({ type: 'run.started', apply: 'never' }, t0));
    expect(started).toBe(initial);

    const resolving = reduceRunProgress(started, event({ type: 'skills.resolving' }, t0 + 5));
    expect(resolving).toBe(initial);
    const resolved = reduceRunProgress(
      resolving,
      event({ type: 'skills.resolved', activations: [], omitted: [], totalTokens: 0 }, t0 + 9),
    );
    expect(resolved).toBe(initial);
    const gathering = reduceRunProgress(resolved, event({ type: 'context.gathering' }, t0 + 12));
    expect(gathering).toBe(initial);

    const ready = reduceRunProgress(
      gathering,
      event({ type: 'context.ready', fragmentCount: 12, totalTokens: 900 }, t0 + 1123),
    );
    expect(rows(ready)).toEqual([
      ['sitemap', 'done', '00:01.123'],
      ['structure', 'active', undefined],
    ]);
    expect(ready.stageSince).toBe(t0 + 1123);
    expect(activeStageId(ready)).toBe('structure');

    const proposing = reduceRunProgress(ready, event({ type: 'plan.proposing' }, t0 + 1130));
    expect(proposing).toBe(ready);
    const progress = reduceRunProgress(
      proposing,
      event({ type: 'plan.progress', text: 'Drafting the plan…' }, t0 + 1200),
    );
    expect(progress).toBe(ready);

    const checking = reduceRunProgress(
      progress,
      event({ type: 'plan.validating', attempt: 1 }, t0 + 1300),
    );
    expect(rows(checking)[1]).toEqual(['structure', 'active', 'Checking']);
    const checkingAgain = reduceRunProgress(
      checking,
      event({ type: 'plan.validating', attempt: 1 }, t0 + 1301),
    );
    expect(checkingAgain).toBe(checking);

    const repairing = reduceRunProgress(
      checking,
      event({ type: 'plan.repairing', issues: ['first', 'second'] }, t0 + 1320),
    );
    expect(rows(repairing)[1]).toEqual(['structure', 'active', 'Repairing 2']);

    const rechecking = reduceRunProgress(
      repairing,
      event({ type: 'plan.validating', attempt: 2 }, t0 + 1400),
    );
    expect(rows(rechecking)[1]).toEqual(['structure', 'active', 'Checking again']);

    const proposed = reduceRunProgress(
      rechecking,
      event({ type: 'plan.proposed', plan: PLAN, proposal: PROPOSAL }, t0 + 1433),
    );
    expect(rows(proposed)).toEqual([
      ['sitemap', 'done', '00:01.123'],
      ['structure', 'done', '00:00.310'],
    ]);
    expect(activeStageId(proposed)).toBeNull();

    const completed = reduceRunProgress(
      proposed,
      event({ type: 'run.completed', status: 'proposed' }, t0 + 1440),
    );
    expect(completed).toBe(proposed);
    expect(completed.failedAt).toBeNull();
  });

  it('runs the Apply row only in Auto, from the proposal to the completed change', () => {
    const event = script();
    const t0 = 0;
    let progress = initialRunProgress('auto', t0);
    progress = reduceRunProgress(
      progress,
      event({ type: 'context.ready', fragmentCount: 3, totalTokens: 80 }, 500),
    );
    progress = reduceRunProgress(progress, event({ type: 'plan.validating', attempt: 1 }, 700));
    progress = reduceRunProgress(
      progress,
      event({ type: 'plan.proposed', plan: PLAN, proposal: PROPOSAL }, 810),
    );
    expect(rows(progress)).toEqual([
      ['sitemap', 'done', '00:00.500'],
      ['structure', 'done', '00:00.310'],
      ['assembly', 'active', undefined],
    ]);
    expect(progress.stageSince).toBe(810);

    const applying = reduceRunProgress(progress, event({ type: 'plan.applying' }, 812));
    expect(applying).toBe(progress);

    const completed = reduceRunProgress(
      applying,
      event({ type: 'run.completed', status: 'applied' }, 2_812),
    );
    // Apply's clock starts when the proposal lands (810), not at plan.applying.
    expect(rows(completed)[2]).toEqual(['assembly', 'done', '00:02.002']);
    expect(activeStageId(completed)).toBeNull();
  });

  it('ignores an Apply step when the run could never apply', () => {
    const event = script();
    let progress = initialRunProgress('never', 0);
    progress = reduceRunProgress(
      progress,
      event({ type: 'context.ready', fragmentCount: 1, totalTokens: 1 }, 100),
    );
    const settled = reduceRunProgress(
      progress,
      event({ type: 'plan.proposed', plan: PLAN, proposal: PROPOSAL }, 200),
    );
    expect(reduceRunProgress(settled, event({ type: 'plan.applying' }, 201))).toBe(settled);
  });

  it('marks the active row failed with the typed reason and remembers where it broke', () => {
    const event = script();
    let progress = initialRunProgress('never', 0);
    progress = reduceRunProgress(
      progress,
      event({ type: 'context.ready', fragmentCount: 1, totalTokens: 1 }, 100),
    );
    progress = reduceRunProgress(progress, event({ type: 'plan.proposing' }, 101));

    const failed = reduceRunProgress(progress, event({ type: 'run.failed', error: FAILURE }, 400));
    expect(rows(failed)).toEqual([
      ['sitemap', 'done', '00:00.100'],
      ['structure', 'failed', 'The assistant is temporarily busy.'],
    ]);
    expect(failed.failedAt).toBe('structure');
    expect(activeStageId(failed)).toBeNull();
  });

  it('fails at Plan when the request never reached the provider', () => {
    const event = script();
    const progress = initialRunProgress('never', 0);
    const failed = reduceRunProgress(
      progress,
      event(
        {
          type: 'run.failed',
          error: {
            source: 'context',
            code: 'context-budget',
            message: 'Too big.',
            retryable: false,
          },
        },
        50,
      ),
    );
    expect(rows(failed)[0]).toEqual(['sitemap', 'failed', 'Too big.']);
    expect(failed.failedAt).toBe('sitemap');
  });

  it('cancels the active row when the person stops the run', () => {
    const event = script();
    let progress = initialRunProgress('auto', 0);
    progress = reduceRunProgress(
      progress,
      event({ type: 'context.ready', fragmentCount: 1, totalTokens: 1 }, 100),
    );
    const cancelled = reduceRunProgress(
      progress,
      event(
        {
          type: 'run.cancelled',
          error: { source: 'run', code: 'cancelled', message: 'Aborted', retryable: false },
        },
        300,
      ),
    );
    expect(rows(cancelled)).toEqual([
      ['sitemap', 'done', '00:00.100'],
      ['structure', 'cancelled', undefined],
      ['assembly', 'pending', undefined],
    ]);
    expect(cancelled.failedAt).toBeNull();
  });

  it('leaves a settled run alone: no row can be re-opened or re-settled', () => {
    const event = script();
    let progress = initialRunProgress('never', 0);
    progress = reduceRunProgress(
      progress,
      event({ type: 'context.ready', fragmentCount: 1, totalTokens: 1 }, 100),
    );
    progress = reduceRunProgress(
      progress,
      event({ type: 'plan.proposed', plan: PLAN, proposal: PROPOSAL }, 200),
    );
    const completed = reduceRunProgress(
      progress,
      event({ type: 'run.completed', status: 'proposed' }, 201),
    );

    expect(
      reduceRunProgress(
        completed,
        event({ type: 'context.ready', fragmentCount: 1, totalTokens: 1 }, 300),
      ),
    ).toBe(completed);
    expect(reduceRunProgress(completed, event({ type: 'plan.validating', attempt: 1 }, 301))).toBe(
      completed,
    );
    expect(reduceRunProgress(completed, event({ type: 'run.failed', error: FAILURE }, 302))).toBe(
      completed,
    );
  });

  it('returns the same reference for an event it does not know', () => {
    const progress = initialRunProgress('never', 0);
    const foreign = {
      type: 'run.paused',
      runId: 'run-1',
      seq: 0,
      at: 1,
    } as unknown as AiAgentEvent;
    expect(reduceRunProgress(progress, foreign)).toBe(progress);
  });
});
