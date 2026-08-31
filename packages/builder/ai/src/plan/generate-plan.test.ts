import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import {
  fixedClock,
  fixtureBlocks,
  landingFixture,
  seededIds,
} from '@craftkit/builder-core/testing';

import type { AiPlan, AiPlanProvider, AiPlanValidationIssue } from '../types';
import { generateAiPlan } from './generate-plan';
import { AiPlanRejectedError } from './validate-plan';

function planKernel() {
  return createBuilder({
    document: landingFixture(),
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(10), ids: seededIds('live') },
  });
}

const goodPlan: AiPlan = {
  rationale: 'Add supporting copy to the existing section.',
  commands: [
    {
      command: 'insertNode',
      args: { type: 'text', props: { content: 'Generated copy' }, parentId: 'sec1' },
    },
  ],
};

const badPlan: AiPlan = {
  rationale: 'Name a command that does not exist.',
  commands: [{ command: 'invent', args: {} }],
};

describe('generateAiPlan repair loop', () => {
  it('gives a repairing provider one chance to fix a rejected plan', async () => {
    const repairCalls: { plan: AiPlan; issues: readonly AiPlanValidationIssue[] }[] = [];
    const provider: AiPlanProvider = {
      propose: () => Promise.resolve(badPlan),
      repair: (_request, _context, plan, issues) => {
        repairCalls.push({ plan, issues });
        return Promise.resolve(goodPlan);
      },
    };

    const plan = await generateAiPlan({
      kernel: planKernel(),
      provider,
      request: 'add copy',
      validationPorts: { clock: fixedClock(20), ids: seededIds('repair') },
    });

    expect(plan).toEqual(goodPlan);
    expect(repairCalls).toHaveLength(1);
    expect(repairCalls[0]?.plan).toEqual(badPlan);
    expect(repairCalls[0]?.issues[0]?.code).toBe('unknown-command');
  });

  it('rejects with the repaired attempt issues when the repair also fails', async () => {
    const provider: AiPlanProvider = {
      propose: () => Promise.resolve(badPlan),
      repair: () =>
        Promise.resolve({
          rationale: 'Still wrong.',
          commands: [{ command: 'stillInvented', args: {} }],
        }),
    };

    const rejection = generateAiPlan({
      kernel: planKernel(),
      provider,
      request: 'add copy',
      validationPorts: { clock: fixedClock(20), ids: seededIds('repair-fails') },
    });

    await expect(rejection).rejects.toThrow(AiPlanRejectedError);
    await expect(rejection).rejects.toThrow(/stillInvented/);
  });

  it('never calls repair when the first proposal already passes', async () => {
    let repaired = false;
    const provider: AiPlanProvider = {
      propose: () => Promise.resolve(goodPlan),
      repair: () => {
        repaired = true;
        return Promise.resolve(goodPlan);
      },
    };

    const plan = await generateAiPlan({
      kernel: planKernel(),
      provider,
      request: 'add copy',
      validationPorts: { clock: fixedClock(20), ids: seededIds('no-repair') },
    });

    expect(plan).toEqual(goodPlan);
    expect(repaired).toBe(false);
  });

  it('hands the live options (signal + onProgress) to propose and to repair', async () => {
    const controller = new AbortController();
    const onProgress = () => undefined;
    const seen: ('propose' | 'repair')[] = [];
    const provider: AiPlanProvider = {
      propose: (_request, _context, options) => {
        seen.push('propose');
        expect(options?.signal).toBe(controller.signal);
        expect(options?.onProgress).toBe(onProgress);
        return Promise.resolve(badPlan);
      },
      repair: (_request, _context, _plan, _issues, options) => {
        seen.push('repair');
        expect(options?.signal).toBe(controller.signal);
        expect(options?.onProgress).toBe(onProgress);
        return Promise.resolve(goodPlan);
      },
    };

    const plan = await generateAiPlan({
      kernel: planKernel(),
      provider,
      request: 'add copy',
      validationPorts: { clock: fixedClock(20), ids: seededIds('live-options') },
      signal: controller.signal,
      onProgress,
    });

    expect(plan).toEqual(goodPlan);
    expect(seen).toEqual(['propose', 'repair']);
  });

  it('still rejects immediately for a provider without a repair method', async () => {
    const provider: AiPlanProvider = { propose: () => Promise.resolve(badPlan) };

    await expect(
      generateAiPlan({
        kernel: planKernel(),
        provider,
        request: 'add copy',
        validationPorts: { clock: fixedClock(20), ids: seededIds('no-method') },
      }),
    ).rejects.toThrow(AiPlanRejectedError);
  });

  it('forwards the conversation history to the provider', async () => {
    const history = [{ role: 'user' as const, text: 'add a hero' }];
    let seen: unknown;
    const provider: AiPlanProvider = {
      propose: (_request, _context, options) => {
        seen = options?.history;
        return Promise.resolve(goodPlan);
      },
    };

    await generateAiPlan({
      kernel: planKernel(),
      provider,
      request: 'make it blue',
      validationPorts: { clock: fixedClock(20), ids: seededIds('history') },
      history,
    });

    expect(seen).toEqual(history);
  });

  it('gives the provider a SECOND repair round before giving up', async () => {
    const stillBad: AiPlan = {
      rationale: 'Second wrong answer.',
      commands: [{ command: 'alsoInvented', args: {} }],
    };
    const seen: string[] = [];
    const provider: AiPlanProvider = {
      propose: () => Promise.resolve(badPlan),
      repair: (_request, _context, plan) => {
        seen.push(plan.commands[0]?.command ?? '?');
        return Promise.resolve(seen.length === 1 ? stillBad : goodPlan);
      },
    };

    const plan = await generateAiPlan({
      kernel: planKernel(),
      provider,
      request: 'add copy',
      validationPorts: { clock: fixedClock(20), ids: seededIds('two-rounds') },
    });

    expect(plan).toEqual(goodPlan);
    // Round 1 saw the original failure; round 2 saw ITS OWN failed repair.
    expect(seen).toEqual(['invent', 'alsoInvented']);
  });

  it('stops after two failed repairs with the final issues', async () => {
    const provider: AiPlanProvider = {
      propose: () => Promise.resolve(badPlan),
      repair: () => Promise.resolve(badPlan),
    };

    await expect(
      generateAiPlan({
        kernel: planKernel(),
        provider,
        request: 'add copy',
        validationPorts: { clock: fixedClock(20), ids: seededIds('exhausted') },
      }),
    ).rejects.toThrow(AiPlanRejectedError);
  });
});
