import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import {
  fixedClock,
  fixtureBlocks,
  landingFixture,
  seededIds,
} from '@craftkit/builder-core/testing';

import { createAiSkillRegistry } from '../skills';
import type { AiPlan, AiPlanProvider } from '../types';
import { runAiAgent, type AiAgentEvent } from './index';

function kernel() {
  return createBuilder({
    document: landingFixture(),
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(10), ids: seededIds('agent-live') },
  });
}

function validationPorts(seed: string) {
  return { clock: fixedClock(20), ids: seededIds(seed) };
}

const validPlan: AiPlan = {
  rationale: 'Update the selected hero.',
  commands: [
    {
      command: 'setProp',
      args: { id: 'hero1', key: 'heading', value: 'Agent checked' },
      title: 'تحديث عنوان الواجهة',
    },
  ],
};

function skills() {
  return createAiSkillRegistry([
    {
      schemaVersion: 1,
      id: 'craftkit.hero-copy',
      name: 'Hero copy',
      description: 'Improve selected hero copy.',
      version: '1.0.0',
      instructions: 'Keep the hero heading concise.',
      activation: { mode: 'auto', selectedBlockTypes: ['hero'] },
      restrictToCommands: ['setProp'],
    },
  ]);
}

describe('runAiAgent', () => {
  it('runs a review-only proposal with deterministic ordered events and one terminal event', async () => {
    const events: AiAgentEvent[] = [];
    const live = kernel();

    const result = await runAiAgent({
      runId: 'run-review',
      clock: fixedClock(100, 5),
      kernel: live,
      provider: { propose: () => Promise.resolve(validPlan) },
      request: 'Improve this hero',
      selection: ['hero1'],
      validationPorts: validationPorts('review'),
      skillRegistry: skills(),
      apply: 'never',
      onEvent: (event) => events.push(event),
    });

    expect(result).toMatchObject({ runId: 'run-review', status: 'proposed', plan: validPlan });
    expect(result.proposal.plan).toBe(result.plan);
    expect(result.proposal.policy).toBe(result.policy);
    expect(result.proposal.skillActivations).toEqual([
      expect.objectContaining({ id: 'craftkit.hero-copy', reason: 'auto' }),
    ]);
    expect(result.proposal.contextFingerprint).toMatch(/^ai-context-v1-sha256-[a-f0-9]{64}$/);
    expect(result.proposal.proposalFingerprint).toMatch(/^ai-proposal-v1-sha256-[a-f0-9]{64}$/);
    expect(Object.isFrozen(result.proposal)).toBe(true);
    expect(live.transactions()).toEqual([]);
    expect(events.map(({ type }) => type)).toEqual([
      'run.started',
      'skills.resolving',
      'skills.resolved',
      'context.gathering',
      'context.ready',
      'plan.proposing',
      'plan.validating',
      'plan.proposed',
      'run.completed',
    ]);
    expect(events.map(({ seq }) => seq)).toEqual(events.map((_event, index) => index));
    expect(events.map(({ at }) => at)).toEqual(events.map((_event, index) => 100 + index * 5));
    expect(
      events.filter(({ type }) => type.startsWith('run.') && type !== 'run.started'),
    ).toHaveLength(1);
  });

  it('applies the exact validated plan through one labelled AI transaction', async () => {
    const events: AiAgentEvent[] = [];
    const live = kernel();
    const before = structuredClone(live.getDocument());

    const result = await runAiAgent({
      runId: 'run-apply',
      clock: fixedClock(200),
      kernel: live,
      provider: { propose: () => Promise.resolve(validPlan) },
      request: 'Improve this hero',
      selection: ['hero1'],
      validationPorts: validationPorts('apply'),
      skillRegistry: skills(),
      apply: 'auto',
      label: 'تحسين واجهة الصفحة',
      onEvent: (event) => events.push(event),
    });

    expect(result.status).toBe('applied');
    expect(result.applied?.proposal).toBe(result.proposal);
    expect(result.applied?.transactions).toHaveLength(1);
    expect(live.transactions()).toHaveLength(1);
    expect(live.transactions()[0]).toMatchObject({
      author: 'ai',
      command: 'تحسين واجهة الصفحة',
    });
    expect(events.map(({ type }) => type).slice(-2)).toEqual(['plan.applying', 'run.completed']);
    expect(events.map(({ type }) => type)).not.toContain('plan.proposed');
    expect(live.undo()).toBe(true);
    expect(live.getDocument()).toEqual(before);
  });

  it('cannot report failure after a throwing kernel observer watches a committed apply', async () => {
    const live = kernel();
    const events: AiAgentEvent[] = [];
    live.context.events.on('tx.applied', () => {
      throw new Error('telemetry observer failed');
    });

    const result = await runAiAgent({
      runId: 'run-observer-isolation',
      clock: fixedClock(250),
      kernel: live,
      provider: { propose: () => Promise.resolve(validPlan) },
      request: 'Improve this hero',
      validationPorts: validationPorts('observer-isolation'),
      apply: 'auto',
      onEvent: (event) => events.push(event),
    });

    expect(result.status).toBe('applied');
    expect(live.transactions()).toHaveLength(1);
    expect(events.at(-1)?.type).toBe('run.completed');
    expect(events.map(({ type }) => type)).not.toContain('run.failed');
  });

  it('does not let a telemetry observer mutate the detached validated proposal', async () => {
    const providerPlan: AiPlan = {
      rationale: 'Set the original heading.',
      commands: [
        {
          command: 'setProp',
          args: { id: 'hero1', key: 'heading', value: 'Original heading' },
        },
      ],
    };
    const attemptMutation = (mutation: () => void): void => {
      try {
        mutation();
      } catch {
        // The observer receives a deeply frozen validated proposal.
      }
    };
    const result = await runAiAgent({
      runId: 'run-observer-plan-isolation',
      clock: fixedClock(260),
      kernel: kernel(),
      provider: { propose: () => Promise.resolve(providerPlan) },
      request: 'Improve this hero',
      validationPorts: validationPorts('observer-plan-isolation'),
      onEvent: (event) => {
        if (event.type !== 'plan.proposed') return;
        attemptMutation(() => {
          (event.plan as { rationale: string }).rationale = 'Observer changed it';
        });
        attemptMutation(() => {
          (event.plan.commands as AiPlan['commands'][number][]).push({
            command: 'removeNode',
            args: { id: 'hero1' },
          });
        });
        attemptMutation(() => {
          (event.plan.commands[0]?.args as { value: string }).value = 'Observer changed it';
        });
        attemptMutation(() => {
          (event.proposal.policy.allowedCommands as string[]).push('removeNode');
        });
      },
    });

    expect(result.plan).not.toBe(providerPlan);
    expect(result.plan.commands[0]?.args).not.toBe(providerPlan.commands[0]?.args);
    expect(result.plan).toEqual(providerPlan);
    expect(Object.isFrozen(result.plan)).toBe(true);
    expect(Object.isFrozen(result.plan.commands)).toBe(true);
    expect(Object.isFrozen(result.plan.commands[0]?.args)).toBe(true);
    expect(Object.isFrozen(result.proposal.policy.allowedCommands)).toBe(true);
    expect(
      result.proposal.policy.allowedCommands.filter((command) => command === 'removeNode'),
    ).toHaveLength(1);
  });

  it('pins generation authority before provider work so caller mutation cannot broaden auto apply', async () => {
    const live = kernel();
    const before = live.getDocument();
    const allowedCommands = ['setProp'];
    const removePlan: AiPlan = {
      rationale: 'Try newly added authority.',
      commands: [{ command: 'removeNode', args: { id: 'hero1' } }],
    };

    await expect(
      runAiAgent({
        runId: 'run-policy-mutation',
        clock: fixedClock(280),
        kernel: live,
        provider: {
          propose: () => {
            allowedCommands.push('removeNode');
            return Promise.resolve(removePlan);
          },
        },
        request: 'Do not gain authority from caller mutation',
        validationPorts: validationPorts('policy-mutation'),
        policy: { allowedCommands, maxCommands: 2, maxOperations: 2 },
        apply: 'auto',
      }),
    ).rejects.toThrow(/not allowed/i);

    expect(live.getDocument()).toBe(before);
    expect(live.transactions()).toEqual([]);
  });

  it('resolves effective policy once so context, validation, and proposal pin the same authority', async () => {
    let reads = 0;
    const unstablePolicy = Object.defineProperty({}, 'allowedCommands', {
      enumerable: true,
      get(): readonly string[] {
        reads += 1;
        return reads <= 2 ? ['setDocMeta'] : ['setProp'];
      },
    });
    const result = await runAiAgent({
      runId: 'run-single-policy-resolution',
      clock: fixedClock(285),
      kernel: kernel(),
      provider: {
        propose: (_request, context) => {
          expect(context.commands?.map(({ name }) => name)).toEqual(['setDocMeta']);
          return Promise.resolve({
            rationale: 'Change direction with the exact advertised authority.',
            commands: [{ command: 'setDocMeta', args: { dir: 'rtl' } }],
          });
        },
      },
      request: 'Change direction',
      validationPorts: validationPorts('single-policy-resolution'),
      policy: unstablePolicy,
      apply: 'never',
    });

    expect(reads).toBe(2);
    expect(result.proposal.policy.allowedCommands).toEqual(['setDocMeta']);
    expect(result.plan.commands).toEqual([{ command: 'setDocMeta', args: { dir: 'rtl' } }]);
  });

  it('surfaces validation and performs at most one repair', async () => {
    let calls = 0;
    const events: AiAgentEvent[] = [];
    const forbidden: AiPlan = {
      rationale: 'Try a command outside the active skill.',
      commands: [
        {
          command: 'insertNode',
          args: { type: 'text', parentId: 'sec1', props: { content: 'x' } },
        },
      ],
    };
    const provider: AiPlanProvider = {
      propose: () => {
        calls += 1;
        return Promise.resolve(forbidden);
      },
      repair: () => {
        calls += 1;
        return Promise.resolve(validPlan);
      },
    };

    await runAiAgent({
      runId: 'run-repair',
      clock: fixedClock(300),
      kernel: kernel(),
      provider,
      request: 'Improve this hero',
      selection: ['hero1'],
      validationPorts: validationPorts('repair'),
      skillRegistry: skills(),
      onEvent: (event) => events.push(event),
    });

    expect(calls).toBe(2);
    expect(events.filter(({ type }) => type === 'plan.validating')).toHaveLength(2);
    expect(events.filter(({ type }) => type === 'plan.repairing')).toHaveLength(1);
  });

  it('cancels before provider work and emits no event after run.cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const events: AiAgentEvent[] = [];
    let proposed = false;

    await expect(
      runAiAgent({
        runId: 'run-pre-cancel',
        clock: fixedClock(400),
        kernel: kernel(),
        provider: {
          propose: () => {
            proposed = true;
            return Promise.resolve(validPlan);
          },
        },
        request: 'cancelled',
        validationPorts: validationPorts('pre-cancel'),
        signal: controller.signal,
        onEvent: (event) => events.push(event),
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(proposed).toBe(false);
    expect(events.map(({ type }) => type)).toEqual(['run.started', 'run.cancelled']);
    expect(events.at(-1)).toMatchObject({
      type: 'run.cancelled',
      error: {
        source: 'run',
        code: 'cancelled',
        retryable: false,
      },
    });
    const cancelled = events.at(-1);
    if (cancelled?.type !== 'run.cancelled') {
      throw new Error('Expected run.cancelled to be the terminal event.');
    }
    expect(Object.isFrozen(cancelled.error)).toBe(true);
  });

  it('normalizes a custom AbortSignal reason to AbortError and keeps typed cancellation', async () => {
    const controller = new AbortController();
    const customReason = new Error('Stopped by custom host reason.');
    controller.abort(customReason);
    const events: AiAgentEvent[] = [];

    await expect(
      runAiAgent({
        runId: 'run-custom-cancel-reason',
        clock: fixedClock(450),
        kernel: kernel(),
        provider: { propose: () => Promise.resolve(validPlan) },
        request: 'cancelled with a custom reason',
        validationPorts: validationPorts('custom-cancel-reason'),
        signal: controller.signal,
        onEvent: (event) => events.push(event),
      }),
    ).rejects.toMatchObject({
      name: 'AbortError',
      message: customReason.message,
    });

    expect(events.at(-1)).toMatchObject({
      type: 'run.cancelled',
      error: {
        source: 'run',
        code: 'cancelled',
        message: customReason.message,
        retryable: false,
      },
    });
  });

  it('cancels between proposal and apply without mutating the document', async () => {
    const controller = new AbortController();
    const events: AiAgentEvent[] = [];
    const live = kernel();
    const before = live.getDocument();

    await expect(
      runAiAgent({
        runId: 'run-mid-cancel',
        clock: fixedClock(500),
        kernel: live,
        provider: { propose: () => Promise.resolve(validPlan) },
        request: 'cancel before apply',
        validationPorts: validationPorts('mid-cancel'),
        apply: 'auto',
        signal: controller.signal,
        onEvent: (event) => {
          events.push(event);
          if (event.type === 'plan.applying') controller.abort();
        },
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(live.getDocument()).toBe(before);
    expect(live.transactions()).toEqual([]);
    expect(events.at(-1)?.type).toBe('run.cancelled');
    expect(events.filter(({ type }) => type === 'run.cancelled')).toHaveLength(1);
  });

  it('prevents a superseded delayed run from validating or mutating after a newer run starts', async () => {
    const live = kernel();
    const before = live.getDocument();
    const staleEvents: AiAgentEvent[] = [];
    let currentRunId = 'run-stale';
    let releaseStale: ((plan: AiPlan) => void) | undefined;
    let emitStaleProgress: (() => void) | undefined;
    let markStaleStarted: (() => void) | undefined;
    const staleStarted = new Promise<void>((resolve) => {
      markStaleStarted = resolve;
    });
    const delayedPlan = new Promise<AiPlan>((resolve) => {
      releaseStale = resolve;
    });

    const staleRun = runAiAgent({
      runId: 'run-stale',
      clock: fixedClock(550),
      kernel: live,
      provider: {
        propose: (_request, _context, live) => {
          markStaleStarted?.();
          emitStaleProgress = () => live?.onProgress?.('stale progress');
          return delayedPlan;
        },
      },
      request: 'Apply this delayed result',
      validationPorts: validationPorts('stale-run'),
      apply: 'auto',
      isCurrentRun: (runId) => runId === currentRunId,
      onEvent: (event) => staleEvents.push(event),
    });
    const staleRejection = expect(staleRun).rejects.toMatchObject({ name: 'AbortError' });

    await staleStarted;
    currentRunId = 'run-current';
    emitStaleProgress?.();
    const current = await runAiAgent({
      runId: 'run-current',
      clock: fixedClock(560),
      kernel: live,
      provider: { propose: () => Promise.resolve(validPlan) },
      request: 'Review the newer result',
      validationPorts: validationPorts('current-run'),
      isCurrentRun: (runId) => runId === currentRunId,
    });
    releaseStale?.(validPlan);

    expect(current.status).toBe('proposed');
    await staleRejection;
    expect(live.getDocument()).toBe(before);
    expect(live.transactions()).toEqual([]);
    expect(staleEvents.at(-1)?.type).toBe('run.cancelled');
    expect(staleEvents.map(({ type }) => type)).not.toContain('plan.progress');
    expect(staleEvents.map(({ type }) => type)).not.toContain('plan.validating');
    expect(staleEvents.map(({ type }) => type)).not.toContain('plan.applying');
  });

  it('fails closed on an unknown runtime apply mode before provider work', async () => {
    const live = kernel();
    let proposed = false;

    await expect(
      runAiAgent({
        runId: 'run-invalid-apply',
        clock: fixedClock(575),
        kernel: live,
        provider: {
          propose: () => {
            proposed = true;
            return Promise.resolve(validPlan);
          },
        },
        request: 'Do not infer authority from invalid input',
        validationPorts: validationPorts('invalid-apply'),
        apply: 'unexpected' as 'auto',
      }),
    ).rejects.toThrow(/apply.*never.*auto/i);

    expect(proposed).toBe(false);
    expect(live.transactions()).toEqual([]);
  });

  it('emits one failed terminal event when the provider fails', async () => {
    const events: AiAgentEvent[] = [];
    const failure = new Error('provider unavailable');

    await expect(
      runAiAgent({
        runId: 'run-failed',
        clock: fixedClock(600),
        kernel: kernel(),
        provider: { propose: () => Promise.reject(failure) },
        request: 'fail',
        validationPorts: validationPorts('failed'),
        onEvent: (event) => events.push(event),
      }),
    ).rejects.toBe(failure);

    expect(events.at(-1)).toMatchObject({
      type: 'run.failed',
      error: {
        source: 'unknown',
        code: 'unknown',
        message: 'provider unavailable',
        retryable: false,
      },
    });
    expect(events.filter(({ type }) => type === 'run.failed')).toHaveLength(1);
  });

  it('forwards every bounded option, streams progress, and isolates a throwing observer', async () => {
    const events: AiAgentEvent[] = [];
    const live = kernel();

    const result = await runAiAgent({
      runId: 'run-all-options',
      clock: fixedClock(700),
      kernel: live,
      provider: {
        propose: (_request, context, options) => {
          expect(context.fragments.map(({ title }) => title)).toEqual([
            'Active AI skill: craftkit.hero-copy',
            // fast-edits: the selected hero's section is shown whole, the rest outlined.
            'Document focus',
          ]);
          expect(options?.history).toEqual([{ role: 'user', text: 'Earlier request' }]);
          options?.onProgress?.('Reading the selected hero');
          return Promise.resolve(validPlan);
        },
      },
      request: 'Improve this hero',
      selection: ['hero1'],
      contextProviders: [],
      history: [{ role: 'user', text: 'Earlier request' }],
      validationPorts: validationPorts('all-options'),
      skillRegistry: skills(),
      selectedSkillIds: ['craftkit.hero-copy'],
      policy: {
        allowedCommands: ['setProp'],
        deniedCommands: ['removeNode'],
        maxCommands: 2,
        maxActiveSkills: 2,
        maxSkillTokens: 1_000,
        maxContextTokens: 64_000,
        allowUntrustedSkills: false,
      },
      apply: 'auto',
      onEvent: (event) => {
        events.push(event);
        if (event.type === 'plan.progress') throw new Error('observer failure');
      },
    });

    expect(result.status).toBe('applied');
    expect(result.skills?.activations).toEqual([
      expect.objectContaining({ id: 'craftkit.hero-copy', reason: 'explicit' }),
    ]);
    expect(events.map(({ type }) => type)).toContain('plan.progress');
    expect(live.transactions()[0]?.command).toBe('AI: Update the selected hero.');
  });
});
