import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import {
  fixedClock,
  fixtureBlocks,
  landingFixture,
  seededIds,
} from '@craftkit/builder-core/testing';

import { AiProviderError } from '../provider/errors';
import { AI_PLAN_WIRE_MAX_INVALID_OUTPUT_MESSAGE_LENGTH } from '../provider/wire';
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

  it('uses exactly one bounded repair round for a retryable invalid-output failure', async () => {
    const calls: string[] = [];
    const invalidOutput = new AiProviderError(
      'x'.repeat(AI_PLAN_WIRE_MAX_INVALID_OUTPUT_MESSAGE_LENGTH * 4),
      { code: 'invalid-output', retryable: true },
    );
    const provider: AiPlanProvider = {
      propose: () => {
        calls.push('propose');
        return Promise.reject(invalidOutput);
      },
      repair: (_request, _context, attempted, issues) => {
        calls.push('repair');
        expect(attempted).toEqual({ rationale: '', commands: [] });
        expect(issues).toEqual([
          {
            code: 'invalid-plan',
            message: 'x'.repeat(AI_PLAN_WIRE_MAX_INVALID_OUTPUT_MESSAGE_LENGTH),
          },
        ]);
        return Promise.resolve(goodPlan);
      },
    };

    await expect(
      generateAiPlan({
        kernel: planKernel(),
        provider,
        request: 'add copy',
        validationPorts: { clock: fixedClock(20), ids: seededIds('invalid-output-repair') },
      }),
    ).resolves.toEqual(goodPlan);
    expect(calls).toEqual(['propose', 'repair']);
  });

  it('surfaces the final invalid-output classification without a third provider call', async () => {
    const first = new AiProviderError('First malformed answer.', {
      code: 'invalid-output',
      retryable: true,
    });
    const final = new AiProviderError('Repair was malformed too.', {
      code: 'invalid-output',
      retryable: true,
    });
    let proposeCalls = 0;
    let repairCalls = 0;
    const provider: AiPlanProvider = {
      propose: () => {
        proposeCalls += 1;
        return Promise.reject(first);
      },
      repair: () => {
        repairCalls += 1;
        return Promise.reject(final);
      },
    };

    const generation = generateAiPlan({
      kernel: planKernel(),
      provider,
      request: 'add copy',
      validationPorts: { clock: fixedClock(20), ids: seededIds('invalid-output-final') },
    });

    await expect(generation).rejects.toBe(final);
    await expect(generation).rejects.toMatchObject({
      code: 'invalid-output',
      retryable: true,
      message: 'Repair was malformed too.',
    });
    expect(proposeCalls).toBe(1);
    expect(repairCalls).toBe(1);
  });

  it('does not repair non-retryable invalid output or a different provider failure', async () => {
    const failures = [
      new AiProviderError('Final invalid output.', {
        code: 'invalid-output',
        retryable: false,
      }),
      new AiProviderError('Network unavailable.', { code: 'network', retryable: true }),
    ];

    for (const [index, failure] of failures.entries()) {
      let repairCalls = 0;
      const provider: AiPlanProvider = {
        propose: () => Promise.reject(failure),
        repair: () => {
          repairCalls += 1;
          return Promise.resolve(goodPlan);
        },
      };
      const generation = generateAiPlan({
        kernel: planKernel(),
        provider,
        request: 'add copy',
        validationPorts: {
          clock: fixedClock(20),
          ids: seededIds(`invalid-output-no-repair-${String(index)}`),
        },
      });

      await expect(generation).rejects.toBe(failure);
      expect(repairCalls).toBe(0);
    }
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

  it('fails before provider work when the session and active Skill leave no command authority', async () => {
    let proposed = false;
    const registry = createAiSkillRegistry([
      {
        schemaVersion: 1,
        id: 'craftkit.copy-only',
        name: 'Copy only',
        description: 'Limit this run to property edits.',
        version: '1.0.0',
        instructions: 'Only edit an existing property.',
        activation: { mode: 'explicit' },
        restrictToCommands: ['setProp'],
      },
    ]);

    const generation = generateAiPlan({
      kernel: planKernel(),
      provider: {
        propose: () => {
          proposed = true;
          return Promise.resolve(goodPlan);
        },
      },
      request: 'add copy',
      skillRegistry: registry,
      selectedSkillIds: ['craftkit.copy-only'],
      policy: { allowedCommands: ['insertNode'] },
      validationPorts: { clock: fixedClock(20), ids: seededIds('empty-authority') },
    });

    await expect(generation).rejects.toMatchObject({
      name: 'AiCommandPolicyError',
      code: 'empty-effective-policy',
    });
    await expect(generation).rejects.toThrow(/craftkit\.copy-only.*session\.allowedCommands/i);
    expect(proposed).toBe(false);
  });

  it('serializes only commands permitted by the exact effective generation policy', async () => {
    const provider: AiPlanProvider = {
      propose: (_request, context) => {
        expect(context.commands?.map(({ name }) => name)).toEqual(['setProp']);
        expect(context.omissions).toEqual([
          expect.objectContaining({ source: 'commands', reason: 'policy-filtered' }),
        ]);
        return Promise.resolve({
          rationale: 'Use the only command permitted for this run.',
          commands: [
            { command: 'setProp', args: { id: 'hero1', key: 'heading', value: 'Policy-pinned' } },
          ],
        });
      },
    };

    await generateAiPlan({
      kernel: planKernel(),
      provider,
      request: 'retitle the hero',
      policy: { allowedCommands: ['setProp'] },
      validationPorts: { clock: fixedClock(20), ids: seededIds('policy-context') },
    });
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
