import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import {
  fixedClock,
  fixtureBlocks,
  landingFixture,
  seededIds,
} from '@craftkit/builder-core/testing';

import { createAiSkillRegistry } from '../skills';
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

  it('never makes a second repair attempt when the single repair remains invalid', async () => {
    const stillBad: AiPlan = {
      rationale: 'Second wrong answer.',
      commands: [{ command: 'alsoInvented', args: {} }],
    };
    const seen: string[] = [];
    const provider: AiPlanProvider = {
      propose: () => Promise.resolve(badPlan),
      repair: (_request, _context, plan) => {
        seen.push(plan.commands[0]?.command ?? '?');
        return Promise.resolve(stillBad);
      },
    };

    await expect(
      generateAiPlan({
        kernel: planKernel(),
        provider,
        request: 'add copy',
        validationPorts: { clock: fixedClock(20), ids: seededIds('one-round') },
      }),
    ).rejects.toThrow(/alsoInvented/);

    expect(seen).toEqual(['invent']);
  });

  it('stops after one failed repair with the final issues', async () => {
    let repairs = 0;
    const provider: AiPlanProvider = {
      propose: () => Promise.resolve(badPlan),
      repair: () => {
        repairs += 1;
        return Promise.resolve(badPlan);
      },
    };

    await expect(
      generateAiPlan({
        kernel: planKernel(),
        provider,
        request: 'add copy',
        validationPorts: { clock: fixedClock(20), ids: seededIds('exhausted') },
      }),
    ).rejects.toThrow(AiPlanRejectedError);
    expect(repairs).toBe(1);
  });

  it('activates selected-block skills, discloses their bodies, and repairs policy violations once', async () => {
    const registry = createAiSkillRegistry([
      {
        schemaVersion: 1,
        id: 'craftkit.hero-copy',
        name: 'Hero copy',
        description: 'Improve the selected hero copy.',
        version: '2.0.0',
        instructions: 'Write one precise hero heading.',
        activation: { mode: 'auto', selectedBlockTypes: ['hero'] },
        restrictToCommands: ['setProp'],
      },
    ]);
    const issues: AiPlanValidationIssue[][] = [];
    const provider: AiPlanProvider = {
      propose: (_request, context) => {
        expect(context.skills).toEqual([
          expect.objectContaining({ id: 'craftkit.hero-copy', reason: 'auto' }),
        ]);
        expect(context.fragments.at(-1)?.body).toContain('Write one precise hero heading.');
        return Promise.resolve(goodPlan); // insertNode is outside the skill restriction
      },
      repair: (_request, _context, _plan, rejected) => {
        issues.push([...rejected]);
        return Promise.resolve({
          rationale: 'Use the skill-restricted edit command.',
          commands: [
            { command: 'setProp', args: { id: 'hero1', key: 'heading', value: 'Sharper copy' } },
          ],
        });
      },
    };

    const generated = await generateAiPlan({
      kernel: planKernel(),
      provider,
      request: 'Improve this heading',
      selection: ['hero1'],
      skillRegistry: registry,
      validationPorts: { clock: fixedClock(20), ids: seededIds('skill-generation') },
    });

    expect(generated.commands[0]?.command).toBe('setProp');
    expect(issues).toHaveLength(1);
    expect(issues[0]?.[0]?.code).toBe('policy-rejected');
  });

  it('fails before provider work when the complete serialized context exceeds its hard budget', async () => {
    let proposed = false;

    await expect(
      generateAiPlan({
        kernel: planKernel(),
        provider: {
          propose: () => {
            proposed = true;
            return Promise.resolve(goodPlan);
          },
        },
        request: 'add copy',
        contextProviders: [
          { id: 'large', collect: () => ({ title: 'Large', body: 'x'.repeat(1_000) }) },
        ],
        maxContextTokens: 10,
        validationPorts: { clock: fixedClock(20), ids: seededIds('context-budget') },
      }),
    ).rejects.toThrow(/context.*budget/i);

    expect(proposed).toBe(false);
  });

  it('rejects an oversized request before calling the proposal provider', async () => {
    let proposed = false;

    await expect(
      generateAiPlan({
        kernel: planKernel(),
        provider: {
          propose: () => {
            proposed = true;
            return Promise.resolve(goodPlan);
          },
        },
        request: 'x'.repeat(100_000),
        maxContextTokens: 10_000,
        validationPorts: { clock: fixedClock(20), ids: seededIds('request-budget') },
      }),
    ).rejects.toThrow(/context.*budget/i);

    expect(proposed).toBe(false);
  });

  it('rejects oversized conversation history before calling the proposal provider', async () => {
    let proposed = false;

    await expect(
      generateAiPlan({
        kernel: planKernel(),
        provider: {
          propose: () => {
            proposed = true;
            return Promise.resolve(goodPlan);
          },
        },
        request: 'add copy',
        history: [{ role: 'user', text: 'x'.repeat(100_000) }],
        maxContextTokens: 10_000,
        validationPorts: { clock: fixedClock(20), ids: seededIds('history-budget') },
      }),
    ).rejects.toThrow(/context.*budget/i);

    expect(proposed).toBe(false);
  });

  it('rejects an oversized repair wire attempt before calling the repair provider', async () => {
    let proposed = false;
    let repaired = false;
    const oversizedRejectedPlan: AiPlan = {
      rationale: 'x'.repeat(100_000),
      commands: [{ command: 'invent', args: {} }],
    };

    await expect(
      generateAiPlan({
        kernel: planKernel(),
        provider: {
          propose: () => {
            proposed = true;
            return Promise.resolve(oversizedRejectedPlan);
          },
          repair: () => {
            repaired = true;
            return Promise.resolve(goodPlan);
          },
        },
        request: 'add copy',
        maxContextTokens: 10_000,
        validationPorts: { clock: fixedClock(20), ids: seededIds('repair-budget') },
      }),
    ).rejects.toThrow(/context.*budget/i);

    expect(proposed).toBe(true);
    expect(repaired).toBe(false);
  });
});
