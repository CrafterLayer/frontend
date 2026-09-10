import { describe, expect, it } from 'vitest';

import {
  DEFAULT_RUN_CONCURRENCY,
  MAX_RUN_CONCURRENCY,
  createRunScheduler,
  type ScheduledUnit,
} from './run-scheduler';

function success(id: string, path: string): ScheduledUnit<string> {
  return {
    unitId: id,
    filePaths: [path],
    execute: () => Promise.resolve({ ok: true, value: id }),
  };
}

describe('run scheduler', () => {
  it('uses three workers by default and never exceeds six', async () => {
    const scheduler = createRunScheduler();
    const units = Array.from({ length: 8 }, (_, index) =>
      success(`u-${String(index)}`, `pages/${String(index)}.tsx`),
    );

    expect((await scheduler.run({ runId: 'run', projectId: 'project', units })).concurrency).toBe(
      DEFAULT_RUN_CONCURRENCY,
    );
    await expect(
      scheduler.run({
        runId: 'bad',
        projectId: 'other',
        units,
        concurrency: MAX_RUN_CONCURRENCY + 1,
      }),
    ).rejects.toThrow('Concurrency must be');
  });

  it('runs at most the requested independent concurrency', async () => {
    const scheduler = createRunScheduler();
    let active = 0;
    let peak = 0;
    const units = Array.from({ length: 5 }, (_, index): ScheduledUnit<number> => ({
      unitId: `u-${String(index)}`,
      filePaths: [`${String(index)}.tsx`],
      execute: async () => {
        active += 1;
        peak = Math.max(peak, active);
        await Promise.resolve();
        active -= 1;
        return { ok: true, value: index };
      },
    }));

    await scheduler.run({ runId: 'run', projectId: 'project', units, concurrency: 2 });
    expect(peak).toBe(2);
  });

  it('refuses two unit writers for the same file before executing either', async () => {
    const scheduler = createRunScheduler();
    await expect(
      scheduler.run({
        runId: 'run',
        projectId: 'project',
        units: [success('one', 'page.tsx'), success('two', 'page.tsx')],
      }),
    ).rejects.toThrow('has two writers');
  });

  it('allows two technical repairs and one escalation, then stops', async () => {
    const scheduler = createRunScheduler();
    const contexts: { attempt: number; escalated: boolean; previousFailure: string | null }[] = [];
    const report = await scheduler.run({
      runId: 'run',
      projectId: 'project',
      units: [
        {
          unitId: 'hero',
          filePaths: ['hero.tsx'],
          execute: (context) => {
            contexts.push({
              attempt: context.attempt,
              escalated: context.escalated,
              previousFailure: context.previousFailure,
            });
            return Promise.resolve({
              ok: false,
              reason: 'compile failed',
              repair: 'technical',
              retryable: true,
            });
          },
        },
      ],
    });

    expect(contexts).toEqual([
      { attempt: 1, escalated: false, previousFailure: null },
      { attempt: 2, escalated: false, previousFailure: 'compile failed' },
      { attempt: 3, escalated: false, previousFailure: 'compile failed' },
      { attempt: 4, escalated: true, previousFailure: 'compile failed' },
    ]);
    expect(report.units[0]).toMatchObject({
      status: 'failed',
      attempts: 4,
      technicalRepairs: 2,
      escalated: true,
    });
  });

  it('allows one visual repair', async () => {
    const scheduler = createRunScheduler();
    let calls = 0;
    const report = await scheduler.run({
      runId: 'run',
      projectId: 'project',
      units: [
        {
          unitId: 'hero',
          filePaths: ['hero.tsx'],
          execute: () => {
            calls += 1;
            return Promise.resolve(
              calls === 1
                ? { ok: false, reason: 'weak hierarchy', repair: 'visual', retryable: true }
                : { ok: true, value: 'fixed' },
            );
          },
        },
      ],
    });

    expect(report.units[0]).toMatchObject({ status: 'completed', attempts: 2, visualRepairs: 1 });
  });

  it('rejects another active mutating run for the same project', async () => {
    const scheduler = createRunScheduler();
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const running = scheduler.run({
      runId: 'one',
      projectId: 'project',
      units: [
        {
          unitId: 'unit',
          filePaths: ['one.tsx'],
          execute: async () => {
            await blocked;
            return { ok: true, value: 'done' };
          },
        },
      ],
    });

    await expect(
      scheduler.run({ runId: 'two', projectId: 'project', units: [success('two', 'two.tsx')] }),
    ).rejects.toThrow('active mutating run');
    release();
    await running;
  });

  it('allows a read-only run while the project writer is active', async () => {
    const scheduler = createRunScheduler();
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const writer = scheduler.run({
      runId: 'writer',
      projectId: 'project',
      units: [
        {
          unitId: 'write',
          filePaths: ['page.tsx'],
          execute: async () => {
            await blocked;
            return { ok: true, value: 'done' };
          },
        },
      ],
    });

    await expect(
      scheduler.run({
        runId: 'ask',
        projectId: 'project',
        mutates: false,
        units: [{ ...success('explain', 'read-only-context'), filePaths: [] }],
      }),
    ).resolves.toMatchObject({ runId: 'ask', units: [{ status: 'completed' }] });
    release();
    await writer;
  });

  it('rejects late output after cancellation', async () => {
    const scheduler = createRunScheduler();
    const controller = new AbortController();
    const reportPromise = scheduler.run({
      runId: 'run',
      projectId: 'project',
      signal: controller.signal,
      units: [
        {
          unitId: 'unit',
          filePaths: ['page.tsx'],
          execute: async () => {
            controller.abort();
            await Promise.resolve();
            return { ok: true, value: 'late' };
          },
        },
      ],
    });

    expect((await reportPromise).units[0]).toMatchObject({ status: 'cancelled' });
  });
});
