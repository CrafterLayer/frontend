import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import {
  fixedClock,
  fixtureBlocks,
  landingFixture,
  seededIds,
} from '@craftkit/builder-core/testing';

import type { AiEffectiveCommandPolicy } from '../skills';
import type { AiPlan } from '../types';
import { applyAiPlan } from './apply-plan';
import { validateAiPlan } from './validate-plan';

function kernel() {
  return createBuilder({
    document: landingFixture(),
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(10), ids: seededIds('policy-live') },
  });
}

function ports(seed: string) {
  return { clock: fixedClock(20), ids: seededIds(seed) };
}

const plan: AiPlan = {
  rationale: 'Update the hero copy.',
  commands: [
    {
      command: 'setProp',
      args: { id: 'hero1', key: 'heading', value: 'Policy checked' },
      title: 'تحديث عنوان الواجهة',
    },
  ],
};

describe('AI plan command-policy enforcement', () => {
  it('rejects a registered command that the effective policy does not allow', () => {
    const policy: AiEffectiveCommandPolicy = {
      allowedCommands: ['insertNode'],
      maxCommands: 10,
    };

    expect(validateAiPlan(plan, kernel(), ports('deny'), policy)).toEqual({
      ok: false,
      issues: [
        {
          code: 'policy-rejected',
          message: 'Step 0 command "setProp" is not allowed by the active AI policy.',
          step: 0,
        },
      ],
    });
  });

  it('rejects a plan that exceeds the policy command bound before dry-run', () => {
    const oversized: AiPlan = {
      rationale: 'Too many edits.',
      commands: [...plan.commands, ...plan.commands],
    };
    const policy: AiEffectiveCommandPolicy = {
      allowedCommands: ['setProp'],
      maxCommands: 1,
    };

    const result = validateAiPlan(oversized, kernel(), ports('bound'), policy);

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: 'policy-rejected' }],
    });
    if (!result.ok) expect(result.issues[0]?.message).toContain('at most 1 command');
  });

  it('rejects an oversized raw command array before reading or parsing its steps', () => {
    let stepReads = 0;
    const unreadableStep = new Proxy(
      {},
      {
        get() {
          stepReads += 1;
          throw new Error('an over-budget step must not be inspected');
        },
      },
    );
    const oversized = {
      rationale: 'Do far too much work.',
      commands: Array.from({ length: 10_000 }, () => unreadableStep),
    };

    const result = validateAiPlan(oversized, kernel(), ports('raw-bound'), {
      allowedCommands: ['setProp'],
      maxCommands: 1,
    });

    expect(result).toMatchObject({ ok: false, issues: [{ code: 'policy-rejected' }] });
    expect(stepReads).toBe(0);
  });

  it('rechecks policy at apply time and leaves the live kernel untouched on denial', () => {
    const live = kernel();
    const before = live.getDocument();

    expect(() =>
      applyAiPlan({
        kernel: live,
        plan,
        validationPorts: ports('apply-denied'),
        policy: { allowedCommands: ['insertNode'], maxCommands: 10 },
      }),
    ).toThrow(/not allowed/);
    expect(live.getDocument()).toBe(before);
    expect(live.transactions()).toEqual([]);
  });

  it('applies through one human-labelled AI transaction', () => {
    const live = kernel();
    const applied = applyAiPlan({
      kernel: live,
      plan,
      validationPorts: ports('apply-allowed'),
      policy: { allowedCommands: ['setProp'], maxCommands: 10 },
      label: 'تحديث محتوى الواجهة الرئيسية',
    });

    expect(applied.transactions).toHaveLength(1);
    expect(applied.transactions[0]).toMatchObject({
      author: 'ai',
      command: 'تحديث محتوى الواجهة الرئيسية',
    });
  });
});
