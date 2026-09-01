import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createBuilder } from '@craftkit/builder-core';
import {
  fakeExtension,
  fixedClock,
  fixtureBlocks,
  landingFixture,
  seededIds,
} from '@craftkit/builder-core/testing';
import { defineBlockSchema, type TrustedExtensionManifest } from '@craftkit/builder-schema';

import { createScriptedAiPlanProvider } from '../testing';
import type { AiPlan } from '../types';
import { generateAiPlan } from './generate-plan';
import { AiPlanRejectedError, assertValidAiPlan, validateAiPlan } from './validate-plan';

function planKernel() {
  return createBuilder({
    document: landingFixture(),
    extensions: [fixtureBlocks, fakeExtension],
    ports: { clock: fixedClock(10), ids: seededIds('live') },
  });
}

function validationPorts(seed = 'validate') {
  return { clock: fixedClock(20), ids: seededIds(seed) };
}

const unknownChildHost: TrustedExtensionManifest = {
  tier: 1,
  name: 'unknown-child-host',
  version: '0.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'A test root whose slot names an unavailable child type.',
          props: z.object({}),
          slots: { default: { allow: ['ghost'] } },
          examples: [],
        }),
        render: () => null,
      },
    ],
  },
};

function unknownChildKernel() {
  return createBuilder({
    extensions: [unknownChildHost],
    ports: { clock: fixedClock(10), ids: seededIds('unknown-child-live') },
  });
}

const utilityClassHost: TrustedExtensionManifest = {
  tier: 1,
  name: 'utility-class-host',
  version: '0.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'Root for utility-class policy tests.',
          props: z.object({}),
          slots: { default: { allow: ['plain', 'styled'] } },
          examples: [],
        }),
        render: () => null,
      },
      {
        schema: defineBlockSchema({
          type: 'plain',
          description: 'A block without a raw utility field.',
          props: z.object({
            heading: z.string().default('Heading'),
          }),
          examples: [],
        }),
        render: () => null,
      },
      {
        schema: defineBlockSchema({
          type: 'styled',
          description: 'A block whose raw utility field is human-only.',
          props: z.object({
            heading: z.string().default('Heading'),
            className: z.string().optional(),
          }),
          propertyGroups: {
            className: { tab: 'advanced', kind: 'utility-classes' },
          },
          examples: [],
        }),
        render: () => null,
      },
    ],
  },
};

function utilityClassKernel() {
  return createBuilder({
    document: {
      schemaVersion: 1,
      surface: 'site',
      dir: 'ltr',
      rootId: 'root',
      nodes: {
        root: {
          id: 'root',
          type: 'page',
          props: {},
          slots: { default: ['styled-1', 'plain-1'] },
        },
        'styled-1': { id: 'styled-1', type: 'styled', props: { heading: 'Existing' } },
        'plain-1': { id: 'plain-1', type: 'plain', props: { heading: 'Existing' } },
      },
    },
    extensions: [utilityClassHost],
    ports: { clock: fixedClock(10), ids: seededIds('utility-class-live') },
  });
}

const validPlan: AiPlan = {
  rationale: 'Add supporting copy to the existing section.',
  commands: [
    {
      command: 'insertNode',
      args: { type: 'text', props: { content: 'Generated copy' }, parentId: 'sec1' },
    },
  ],
};

describe('AI plan validation', () => {
  it('accepts a typed command plan only after it survives the real scratch-kernel door', () => {
    const kernel = planKernel();
    const before = kernel.getDocument();

    expect(validateAiPlan(validPlan, kernel, validationPorts())).toEqual({
      ok: true,
      plan: validPlan,
    });
    expect(kernel.getDocument()).toBe(before);
    expect(kernel.transactions()).toHaveLength(0);
  });

  it('validates registered extension commands in the same ordered dry run', () => {
    const kernel = planKernel();
    const plan: AiPlan = {
      rationale: 'Exercise a contributed command.',
      commands: [{ command: 'fake.tag', args: { id: 'ghost' } }],
    };
    expect(validateAiPlan(plan, kernel, validationPorts('extension'))).toEqual({ ok: true, plan });
  });

  it.each([
    ['a scalar plan', null, 'An AI plan must be an object.'],
    ['an empty rationale', { rationale: '', commands: [{}] }, 'non-empty rationale'],
    ['no commands', { rationale: 'Nothing', commands: [] }, 'at least one command'],
    ['a scalar command', { rationale: 'Bad step', commands: [1] }, 'step 0 must be an object'],
    [
      'a missing command name',
      { rationale: 'Bad name', commands: [{ args: {} }] },
      'needs a command name',
    ],
    [
      'missing args',
      { rationale: 'Bad args', commands: [{ command: 'insertNode' }] },
      'needs command arguments',
    ],
  ])('rejects %s structurally', (_name, candidate, message) => {
    const result = validateAiPlan(candidate, planKernel(), validationPorts('shape'));
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('invalid-plan');
      expect(result.issues[0]?.message).toContain(message);
    }
  });

  it('rejects an unknown command before dry-run', () => {
    const result = validateAiPlan(
      { rationale: 'Unknown.', commands: [{ command: 'invent', args: {} }] },
      planKernel(),
      validationPorts('unknown-command'),
    );
    expect(result).toEqual({
      ok: false,
      issues: [
        {
          code: 'unknown-command',
          message: 'Step 0 names unknown command "invent".',
          step: 0,
        },
      ],
    });
  });

  it('rejects malformed command arguments before a handler can see them', () => {
    const result = validateAiPlan(
      {
        rationale: 'Malformed.',
        commands: [{ command: 'insertNode', args: { type: 'text' } }],
      },
      planKernel(),
      validationPorts('invalid-args'),
    );
    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: 'invalid-args', step: 0 }],
    });
  });

  it.each([
    ['setProp', { id: 'styled-1', key: 'className', value: 'p-8' }],
    ['setResponsive', { id: 'styled-1', breakpoint: 'mobile', key: 'className', value: 'p-4' }],
    [
      'insertNode',
      { type: 'styled', parentId: 'root', props: { heading: 'New', className: 'p-8' } },
    ],
    [
      'applyPatches',
      {
        patches: [
          {
            op: 'add',
            path: ['nodes', 'styled-1', 'props', 'className'],
            value: 'p-8',
          },
        ],
      },
    ],
    [
      'applyPatches',
      {
        patches: [
          {
            op: 'replace',
            path: ['nodes'],
            value: {
              'styled-1': {
                id: 'styled-1',
                type: 'styled',
                props: { heading: 'New', className: 'p-8' },
              },
            },
          },
        ],
      },
    ],
  ])(
    'rejects AI-authored utility-class properties through %s before scratch work',
    (command, args) => {
      const kernel = utilityClassKernel();
      const result = validateAiPlan(
        { rationale: 'Try to author a human-only utility field.', commands: [{ command, args }] },
        kernel,
        validationPorts(`utility-${command}`),
      );

      expect(result).toMatchObject({
        ok: false,
        issues: [{ code: 'policy-rejected', step: 0 }],
      });
      if (!result.ok) {
        expect(result.issues[0]?.message).toMatch(/utility-classes.*human-only/i);
      }
      expect(kernel.transactions()).toEqual([]);
    },
  );

  it('tracks ordered applyPatches type changes before checking later utility-class writes', () => {
    const kernel = utilityClassKernel();
    const result = validateAiPlan(
      {
        rationale: 'Try to hide a human-only utility write behind an earlier type change.',
        commands: [
          {
            command: 'applyPatches',
            args: {
              patches: [
                {
                  op: 'replace',
                  path: ['nodes', 'plain-1', 'type'],
                  value: 'styled',
                },
              ],
            },
          },
          {
            command: 'setProp',
            args: { id: 'plain-1', key: 'className', value: 'p-8' },
          },
        ],
      },
      kernel,
      validationPorts('utility-ordered-type-change'),
      {
        allowedCommands: ['applyPatches', 'setProp'],
        maxCommands: 8,
        maxOperations: 8,
      },
    );

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: 'policy-rejected', step: 1 }],
    });
    if (!result.ok) {
      expect(result.issues[0]?.message).toMatch(/utility-classes.*human-only/i);
    }
    expect(kernel.transactions()).toEqual([]);
  });

  it.each([
    [
      'child rejected by the slot',
      { type: 'text', parentId: 'hero1', slot: 'actions' },
      'accepts [button]',
    ],
    [
      'props rejected by the block schema',
      { type: 'hero', parentId: 'root', props: { tone: 'neon', heading: 'No' } },
      'failed its schema',
    ],
  ])('refuses a plan with %s', (_name, args, expected) => {
    const result = validateAiPlan(
      { rationale: 'Invalid structural proposal.', commands: [{ command: 'insertNode', args }] },
      planKernel(),
      validationPorts('door'),
    );
    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: 'door-rejected', step: 0 }],
    });
    if (!result.ok) {
      expect(result.issues[0]?.message).toContain(expected);
    }
  });

  it('refuses an unknown block type even when the parent slot names it as allowed', () => {
    const result = validateAiPlan(
      {
        rationale: 'Try an unavailable registered type.',
        commands: [{ command: 'insertNode', args: { type: 'ghost', parentId: 'root' } }],
      },
      unknownChildKernel(),
      validationPorts('unknown-block'),
    );
    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: 'door-rejected', step: 0 }],
    });
    if (!result.ok) {
      expect(result.issues[0]?.message).toContain('not registered');
    }
  });

  it('refuses to return an invalid provider proposal', async () => {
    const invalid: AiPlan = {
      rationale: 'Try to bypass the registry.',
      commands: [{ command: 'insertNode', args: { type: 'ghost', parentId: 'root', props: {} } }],
    };

    await expect(
      generateAiPlan({
        kernel: planKernel(),
        provider: createScriptedAiPlanProvider(invalid),
        request: 'add a ghost block',
        validationPorts: validationPorts('provider-refusal'),
      }),
    ).rejects.toMatchObject({ name: 'AiPlanRejectedError' });
  });

  it('passes an explicit selection and provider list into context assembly', async () => {
    const plan = await generateAiPlan({
      kernel: planKernel(),
      provider: createScriptedAiPlanProvider(validPlan),
      request: 'add supporting copy',
      selection: ['sec1'],
      contextProviders: [],
      validationPorts: validationPorts('context-options'),
    });
    expect(plan).toEqual(validPlan);
  });

  it('the assertion surface carries every validation issue', () => {
    expect(() =>
      assertValidAiPlan(
        { rationale: 'Bad.', commands: [{ command: 'missing', args: {} }] },
        planKernel(),
        validationPorts('assert'),
      ),
    ).toThrow(AiPlanRejectedError);
  });

  it('carries a human step title through validation and drops a non-string one', () => {
    const kernel = planKernel();
    const titled = {
      rationale: 'Add copy with a named step.',
      commands: [
        {
          command: 'insertNode',
          args: { type: 'text', props: { content: 'Generated copy' }, parentId: 'sec1' },
          title: 'إضافة نص ترحيبي',
        },
      ],
    };

    const result = validateAiPlan(titled, kernel, validationPorts('titled'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.commands[0]?.title).toBe('إضافة نص ترحيبي');
    }

    const badTitle = {
      rationale: 'Numeric title.',
      commands: [
        {
          command: 'insertNode',
          args: { type: 'text', props: { content: 'x' }, parentId: 'sec1' },
          title: 7,
        },
      ],
    };
    const lenient = validateAiPlan(badTitle, planKernel(), validationPorts('bad-title'));
    expect(lenient.ok).toBe(true);
    if (lenient.ok) {
      expect(lenient.plan.commands[0]?.title).toBeUndefined();
    }
  });

  it('blames a plan only for NEW damage: pre-existing document violations do not reject it', () => {
    // A document that is ALREADY invalid (tone outside the enum) before any plan.
    const kernel = createBuilder({
      document: {
        ...landingFixture(),
        nodes: {
          ...landingFixture().nodes,
          hero1: {
            id: 'hero1',
            type: 'hero',
            props: { tone: 'purple', heading: 'Build faster' },
            slots: { actions: ['cta1', 'cta2'] },
          },
        },
      },
      extensions: [fixtureBlocks],
      ports: { clock: fixedClock(10), ids: seededIds('stale-live') },
    });

    // A perfectly good plan that never touches the stale node must pass…
    expect(validateAiPlan(validPlan, kernel, validationPorts('stale-ok'))).toEqual({
      ok: true,
      plan: validPlan,
    });

    // …while a plan that CREATES a new violation is still rejected.
    const breaking: AiPlan = {
      rationale: 'Push the section count past its cap.',
      commands: [{ command: 'setProp', args: { id: 'p1', key: 'content', value: 42 } }],
    };
    const result = validateAiPlan(breaking, kernel, validationPorts('stale-broken'));
    expect(result.ok).toBe(false);
  });

  it('carries a follow-up suggestion through validation and drops a non-string one', () => {
    const staged = {
      rationale: 'Stage one: the structure.',
      commands: [
        {
          command: 'insertNode',
          args: { type: 'text', props: { content: 'Generated copy' }, parentId: 'sec1' },
        },
      ],
      followUp: 'كمل التنسيق والألوان',
    };

    const result = validateAiPlan(staged, planKernel(), validationPorts('follow-up'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.followUp).toBe('كمل التنسيق والألوان');
    }

    const bad = { ...staged, followUp: 9 };
    const lenient = validateAiPlan(bad, planKernel(), validationPorts('follow-up-bad'));
    expect(lenient.ok).toBe(true);
    if (lenient.ok) {
      expect(lenient.plan.followUp).toBeUndefined();
    }
  });
});
