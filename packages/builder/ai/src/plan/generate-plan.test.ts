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
});
