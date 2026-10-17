import { describe, expect, it } from 'vitest';

import type { RunRecord, SelectionTarget } from '@craftkit/builder-schema';

import {
  createMemoryRunJournal,
  createRunCoordinator,
  type RunRevalidationInput,
  type RunRevalidationPort,
} from './run-coordinator';

function target(siteRevision = 'site-1', sourceRevision = 'source-1'): SelectionTarget {
  return {
    pageId: 'home',
    sourceOrNodeId: {
      projectId: 'project',
      modulePath: 'pages/home/Page.tsx',
      sourceRevision,
      astNodeId: 'hero-heading',
    },
    revision: siteRevision,
    capabilities: ['inspect', 'editText', 'editSource'],
  };
}

function revalidation(): RunRevalidationPort & {
  projectRevision: string;
  siteRevision: string;
  currentTarget: SelectionTarget | null;
} {
  return {
    projectRevision: 'source-1',
    siteRevision: 'site-1',
    currentTarget: target(),
    revalidate(input: RunRevalidationInput) {
      return Promise.resolve({
        ok: true as const,
        currentProjectRevision: this.projectRevision,
        currentSiteRevision: this.siteRevision,
        target: input.target === null ? null : this.currentTarget,
      });
    },
  };
}

function setup() {
  let time = 100;
  const journal = createMemoryRunJournal({ durableForTests: true });
  const validation = revalidation();
  const coordinator = createRunCoordinator({
    journal,
    revalidation: validation,
    now: () => time++,
  });
  return { coordinator, journal, validation };
}

async function start(
  coordinator: ReturnType<typeof createRunCoordinator>,
  runId = 'run-1',
): Promise<RunRecord> {
  return coordinator.startRun({
    runId,
    siteId: 'site',
    projectId: 'project',
    pageId: 'home',
    mode: 'auto',
    target: target(),
    baseRevision: 'source-1',
    routingPolicyVersion: 'economic-v1',
  });
}

describe('run coordinator', () => {
  it('revalidates target and base before starting and allows one mutating run per project', async () => {
    const { coordinator, validation } = setup();
    await start(coordinator);

    await expect(start(coordinator, 'run-2')).rejects.toMatchObject({
      code: 'active-run-exists',
    });

    await coordinator.stopRun('run-1');
    validation.currentTarget = null;
    await expect(start(coordinator, 'run-stale')).rejects.toMatchObject({ code: 'stale-target' });

    validation.currentTarget = target();
    validation.projectRevision = 'source-2';
    await expect(start(coordinator, 'run-old-base')).rejects.toMatchObject({ code: 'stale-base' });
  });

  it('refuses a second mutating run when a prior host left one active in the journal', async () => {
    const journal = createMemoryRunJournal({ durableForTests: true });
    const validation = revalidation();
    const firstHost = createRunCoordinator({ journal, revalidation: validation, now: () => 1 });
    const nextHost = createRunCoordinator({ journal, revalidation: validation, now: () => 2 });
    await start(firstHost, 'run-first-host');

    await expect(start(nextHost, 'run-next-host')).rejects.toMatchObject({
      code: 'active-run-exists',
    });
  });

  it('aborts the entire cancellation tree and rejects late provider or tool results', async () => {
    const { coordinator } = setup();
    await start(coordinator);
    const provider = coordinator.createCancellationScope('run-1', 'provider');
    const tool = coordinator.createCancellationScope('run-1', 'tool', 'provider');
    const compiler = coordinator.createCancellationScope('run-1', 'compiler');
    const lease = await coordinator.beginUnit('run-1', {
      unitId: 'hero',
      stage: 'generate',
      provider: 'openai',
      model: 'terra',
    });

    await coordinator.stopRun('run-1', 'Stop and revise');

    expect(provider.signal.aborted).toBe(true);
    expect(tool.signal.aborted).toBe(true);
    expect(compiler.signal.aborted).toBe(true);
    expect(lease.signal.aborted).toBe(true);
    expect(coordinator.isResultCurrent(lease)).toBe(false);
    expect(() => {
      coordinator.assertResultCurrent(lease);
    }).toThrow(/stopped, superseded, or stale/);
    await expect(
      coordinator.completeUnit(lease, { checkpointId: 'late', checkpoint: { patch: 1 } }),
    ).rejects.toMatchObject({ code: 'stale-result' });
    expect(coordinator.getRun('run-1')).toMatchObject({
      status: 'stopped',
      outcome: 'stopped',
      cancellation: { requested: true, reason: 'Stop and revise' },
    });
  });

  it('publishes completed units only after a durable checkpoint exists', async () => {
    const { coordinator, journal } = setup();
    await start(coordinator);
    const lease = await coordinator.beginUnit('run-1', { unitId: 'header', stage: 'generate' });
    const record = await coordinator.completeUnit(lease, {
      checkpointId: 'checkpoint-header',
      checkpoint: { files: ['pages/home/Header.tsx'] },
      latencyMs: 12,
      usage: { inputTokens: 10, outputTokens: 4 },
    });

    expect(journal.checkpoint('checkpoint-header')).toEqual({
      files: ['pages/home/Header.tsx'],
    });
    expect(record.units[0]).toMatchObject({
      unitId: 'header',
      status: 'completed',
      checkpointId: 'checkpoint-header',
      persisted: { kind: 'durable' },
      usage: { inputTokens: 10, outputTokens: 4, cachedInputTokens: null },
    });
  });

  it('serializes parallel unit journal writes without losing either checkpoint', async () => {
    const { coordinator } = setup();
    await start(coordinator);
    const [first, second] = await Promise.all([
      coordinator.beginUnit('run-1', { unitId: 'hero', stage: 'generate' }),
      coordinator.beginUnit('run-1', { unitId: 'footer', stage: 'generate' }),
    ]);
    await Promise.all([
      coordinator.completeUnit(first, { checkpointId: 'checkpoint-hero', checkpoint: { ok: 1 } }),
      coordinator.completeUnit(second, {
        checkpointId: 'checkpoint-footer',
        checkpoint: { ok: 2 },
      }),
    ]);

    expect(coordinator.getRun('run-1')?.units).toEqual([
      expect.objectContaining({ unitId: 'hero', status: 'completed' }),
      expect.objectContaining({ unitId: 'footer', status: 'completed' }),
    ]);
  });

  it('resumes into a new queued successor and never applies a completed unit twice', async () => {
    const { coordinator } = setup();
    await start(coordinator);
    const completed = await coordinator.beginUnit('run-1', {
      unitId: 'completed-header',
      stage: 'generate',
    });
    await coordinator.completeUnit(completed, {
      checkpointId: 'checkpoint-header',
      checkpoint: { patch: 'header' },
    });
    await coordinator.beginUnit('run-1', { unitId: 'interrupted-main', stage: 'generate' });
    await coordinator.stopRun('run-1');

    const successor = await coordinator.resumeRun('run-1', 'run-2');
    expect(successor).toMatchObject({
      runId: 'run-2',
      predecessorRunId: 'run-1',
      status: 'queued',
    });
    expect(successor.units).toEqual([
      expect.objectContaining({ unitId: 'completed-header', status: 'completed', attempt: 1 }),
      expect.objectContaining({ unitId: 'interrupted-main', status: 'queued', attempt: 1 }),
    ]);

    await coordinator.activateRun('run-2');
    await expect(
      coordinator.beginUnit('run-2', { unitId: 'completed-header', stage: 'generate' }),
    ).rejects.toMatchObject({ code: 'unit-already-completed' });
    const retry = await coordinator.beginUnit('run-2', {
      unitId: 'interrupted-main',
      stage: 'generate',
    });
    expect(retry.attempt).toBe(2);
  });

  it('turns a journaled host interruption into a terminal predecessor before resume', async () => {
    const journal = createMemoryRunJournal({ durableForTests: true });
    const validation = revalidation();
    const firstHost = createRunCoordinator({ journal, revalidation: validation, now: () => 100 });
    await start(firstHost);
    const completed = await firstHost.beginUnit('run-1', {
      unitId: 'completed-header',
      stage: 'generate',
    });
    await firstHost.completeUnit(completed, {
      checkpointId: 'checkpoint-header',
      checkpoint: { patch: 'header' },
    });
    await firstHost.beginUnit('run-1', { unitId: 'interrupted-main', stage: 'generate' });

    const restoredHost = createRunCoordinator({ journal, revalidation: validation, now: () => 200 });
    const successor = await restoredHost.resumeRun('run-1', 'run-recovered');

    expect(successor.units).toEqual([
      expect.objectContaining({ unitId: 'completed-header', status: 'completed' }),
      expect.objectContaining({ unitId: 'interrupted-main', status: 'queued' }),
    ]);
    await expect(journal.loadRun('run-1')).resolves.toMatchObject({
      status: 'stopped',
      outcome: 'stopped',
      cancellation: { requested: true, reason: 'Recovered after an interrupted host session.' },
    });
  });

  it('holds exactly one editable next request and pauses it after Stop until continuation', async () => {
    const { coordinator, validation } = setup();
    await start(coordinator);
    const request = await coordinator.queueRequest({
      requestId: 'next-1',
      siteId: 'site',
      projectId: 'project',
      pageId: 'home',
      mode: 'auto',
      prompt: 'Add testimonials',
      target: target(),
      baseRevision: 'source-1',
    });
    expect(request.paused).toBe(false);
    await expect(
      coordinator.queueRequest({ ...request, requestId: 'next-2', prompt: 'Add pricing' }),
    ).rejects.toMatchObject({ code: 'queued-request-exists' });

    const edited = await coordinator.editQueuedRequest(
      'project',
      'next-1',
      'Add three customer stories',
    );
    expect(edited.prompt).toBe('Add three customer stories');
    await coordinator.stopRun('run-1');
    expect(coordinator.getQueuedRequest('project')?.paused).toBe(true);

    validation.projectRevision = 'source-2';
    validation.currentTarget = target('site-1', 'source-2');
    const continued = await coordinator.continueQueuedRequest('project', 'next-1');
    expect(continued).toMatchObject({ paused: false, baseRevision: 'source-2' });
    expect(coordinator.getQueuedRequest('project')).toBeUndefined();
  });

  it('refuses to expose a run when its journal only acknowledges session memory', async () => {
    const sessionOnly = createMemoryRunJournal();
    const coordinator = createRunCoordinator({
      journal: sessionOnly,
      revalidation: revalidation(),
      now: () => 1,
    });

    await expect(start(coordinator)).rejects.toMatchObject({ code: 'journal-not-durable' });
    expect(coordinator.getRun('run-1')).toBeUndefined();
  });
});
