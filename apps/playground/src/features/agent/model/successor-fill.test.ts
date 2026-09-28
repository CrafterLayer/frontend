/**
 * Successor runs' pure half (SPEC §4.8 footer, FR-054): the writer's brief, the target
 * guard, and the events that reopen and settle the same record, so the rows ink in place.
 */
import type { AiBuildOwnEvent, AiPlan } from '@craftkit/builder';
import { describe, expect, it } from 'vitest';

import { createBuildKernel } from '../testing/scripted-engine';
import { initialBuildProgress, landedCount, reduceBuildProgress, type BuildProgress } from './build-progress';
import {
  guardSection,
  holdsValues,
  reopenForSuccessor,
  sectionLabel,
  sectionValues,
  successorBrief,
  successorCompletedEvent,
  taskCompletedEvent,
  taskStartedEvent,
  unwrittenKeys,
} from './successor-fill';

function stoppedBuild(): BuildProgress {
  const events: AiBuildOwnEvent[] = [
    { type: 'build.scaffolding', runId: 'run-1', seq: 0, at: 0 },
    {
      type: 'build.planned',
      runId: 'run-1',
      seq: 1,
      at: 1,
      direction: 'Calm and clinical.',
      tasks: [
        { id: 'a', title: 'Hero' },
        { id: 'b', title: 'Proof' },
        { id: 'c', title: 'Pricing' },
      ],
    },
    { type: 'task.started', runId: 'run-1', seq: 2, at: 2, position: 1, total: 3, task: { id: 'a', title: 'Hero' }, attempt: 1 },
    { type: 'task.completed', runId: 'run-1', seq: 3, at: 3, position: 1, total: 3, task: { id: 'a', title: 'Hero' }, attempts: 1 },
    { type: 'build.stopped', runId: 'run-1', seq: 4, at: 4, reason: 'signal' },
    {
      type: 'build.completed',
      runId: 'run-1',
      seq: 5,
      at: 5,
      tasks: [
        { id: 'a', title: 'Hero', status: 'applied', attempts: 1, landing: { transactionId: 'tx-a', label: 'Assistant: 1/3 — Hero', before: { tree: '' }, after: { tree: 'A' } } },
        { id: 'b', title: 'Proof', status: 'not-started', attempts: 0, reason: 'stopped', reasonCode: 'stopped' },
        { id: 'c', title: 'Pricing', status: 'not-started', attempts: 0, reason: 'stopped', reasonCode: 'stopped' },
      ],
      applied: 1,
      skipped: 0,
      elapsedMs: 5,
      outcome: 'signal',
    },
  ];
  return events.reduce(reduceBuildProgress, initialBuildProgress('run-1', 0));
}

describe('successor fills', () => {
  it('labels a section the way the build does', () => {
    expect(sectionLabel(2, 3, 'Proof')).toBe('Assistant: 2/3 — Proof');
  });

  it('keeps only the writer’s own region’s tree and css', () => {
    const plan: AiPlan = {
      rationale: 'x',
      commands: [
        { command: 'setProp', args: { id: 'b', key: 'tree', value: 'B' } },
        { command: 'setProp', args: { id: 'a', key: 'tree', value: 'hijack' } },
        { command: 'setProp', args: { id: 'b', key: 'label', value: 'rename' } },
        { command: 'removeNode', args: { id: 'c' } },
      ],
    };
    expect(guardSection(plan, 'b')).toEqual({
      plan: { rationale: 'x', commands: [{ command: 'setProp', args: { id: 'b', key: 'tree', value: 'B' } }] },
      dropped: 3,
    });
    expect(guardSection({ rationale: 'x', commands: [] }, 'b')).toBeNull();
  });

  it('compares a region’s values as data', () => {
    const kernel = createBuildKernel();
    kernel.dispatch('insertNode', { type: 'region', parentId: 'root', props: { label: 'Hero', tree: '' } });
    const id = Object.keys(kernel.getDocument().nodes).find((key) => key !== 'root') ?? '';
    expect(sectionValues(kernel.getDocument(), id)).toEqual({ tree: '' });
    expect(holdsValues(kernel.getDocument(), id, { tree: '' })).toBe(true);
    expect(holdsValues(kernel.getDocument(), id, { tree: 'x' })).toBe(false);
    expect(holdsValues(kernel.getDocument(), 'gone', { tree: '' })).toBe(false);
  });

  it('briefs the writer with the direction, its place, its region and the request', () => {
    const progress = stoppedBuild();
    const task = progress.tasks[1];
    if (task === undefined) throw new Error('no task');
    const brief = successorBrief({ direction: progress.direction, request: 'a clinic page', task, total: 3 });
    expect(brief).toContain('Calm and clinical.');
    expect(brief).toContain('SECTION 2 OF 3: Proof');
    expect(brief).toContain('REGION ID: b');
    expect(brief).toContain('a clinic page');
  });

  it('reopens the record for the named sections and settles it with the whole count', () => {
    const progress = stoppedBuild();
    expect(unwrittenKeys(progress)).toEqual(['b', 'c']);
    const reopened = reopenForSuccessor(progress, new Set(['b']), 10);
    expect(reopened.report).toBeNull();
    expect(reopened.phase).toBe('building');
    expect(reopened.tasks.map((task) => task.status)).toEqual(['landed', 'waiting', 'notWritten']);

    const proof = reopened.tasks[1];
    if (proof === undefined) throw new Error('no task');
    let next = reduceBuildProgress(reopened, taskStartedEvent(reopened, proof, 11, 1));
    expect(next.tasks[1]?.status).toBe('writing');
    next = reduceBuildProgress(next, taskCompletedEvent(next, proof, 12, 2));
    const landing = { transactionId: 'tx-b', label: 'Assistant: 2/3 — Proof', before: { tree: '' }, after: { tree: 'B' } };
    const done = reduceBuildProgress(
      next,
      successorCompletedEvent(next, new Map([['b', landing]]), {
        stopped: false,
        priorElapsedMs: 5,
        elapsedMs: 7,
        at: 13,
        seq: 3,
      }),
    );
    expect(landedCount(done)).toBe(2);
    expect(done.report).toEqual({ applied: 2, skipped: 0, elapsedMs: 12, outcome: 'completed' });
    expect(done.tasks[1]?.landing).toEqual(landing);
    expect(done.tasks[2]?.status).toBe('notWritten');
  });
});
