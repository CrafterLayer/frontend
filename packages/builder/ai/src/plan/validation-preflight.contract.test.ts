import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createBuilder } from '@craftkit/builder-core';
import {
  defineBlockSchema,
  type BlockRenderComponent,
  type BuilderDocument,
  type ClockPort,
  type IdPort,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import type { AiPlan } from '../types';
import { validateAiPlan } from './validate-plan';

const NullRender: BlockRenderComponent = () => null;

const page = defineBlockSchema({
  type: 'preflight-page',
  description: 'A root block used to prove AI plans pass through the kernel door.',
  props: z.object({}),
  // `preflight-ghost` is intentionally allowed but not registered, which lets
  // the scratch kernel reach the registry lookup rather than only slot refusal.
  slots: { default: { allow: ['preflight-ghost', 'preflight-hero', 'preflight-text'], max: 8 } },
  examples: [],
});

const hero = defineBlockSchema({
  type: 'preflight-hero',
  description: 'A hero that accepts only text actions.',
  props: z.object({ heading: z.string().min(1).default('Reliable plans') }),
  slots: { actions: { allow: ['preflight-text'], max: 2 } },
  examples: [],
});

const text = defineBlockSchema({
  type: 'preflight-text',
  description: 'A plain text block.',
  props: z.object({ content: z.string().min(1).default('Validated copy') }),
  examples: [],
});

const vocabulary: TrustedExtensionManifest = {
  tier: 1,
  name: 'builder-ai-preflight-contract-fixture',
  version: '0.0.0',
  contributes: {
    blocks: [
      { schema: page, render: NullRender },
      { schema: hero, render: NullRender },
      { schema: text, render: NullRender },
    ],
  },
};

function documentFixture(): BuilderDocument {
  return {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: {
      root: {
        id: 'root',
        type: 'preflight-page',
        props: {},
        slots: { default: ['hero-1'] },
      },
      'hero-1': {
        id: 'hero-1',
        type: 'preflight-hero',
        props: { heading: 'Reliable plans' },
      },
    },
  };
}

function countedPorts(seed: string): {
  readonly ports: { clock: ClockPort; ids: IdPort };
  readonly calls: () => { clock: number; ids: number };
} {
  let clockCalls = 0;
  let idCalls = 0;
  return {
    ports: {
      clock: {
        now() {
          clockCalls += 1;
          return clockCalls;
        },
      },
      ids: {
        newId() {
          idCalls += 1;
          return `${seed}-${String(idCalls)}`;
        },
      },
    },
    calls: () => ({ clock: clockCalls, ids: idCalls }),
  };
}

function preflightKernel() {
  const live = countedPorts('live');
  return {
    kernel: createBuilder({
      document: documentFixture(),
      extensions: [vocabulary],
      ports: live.ports,
    }),
    live,
  };
}

const validPlan: AiPlan = {
  rationale: 'Add validated supporting copy.',
  commands: [
    {
      command: 'insertNode',
      args: {
        type: 'preflight-text',
        props: { content: 'Only the command door writes this.' },
        parentId: 'root',
      },
    },
  ],
};

describe('AI plan scratch-kernel preflight', () => {
  // Mutation proof: in validate-plan.ts, replace `scratch.dispatch(step.command, step.args, 'ai')`
  // with `kernel.dispatch(step.command, step.args, 'ai')`; the live snapshot and live-port assertions must fail.
  it('uses dedicated scratch clock and id ports without touching the live document or transaction log', () => {
    const { kernel, live } = preflightKernel();
    const validation = countedPorts('validation');
    const beforeDocument = structuredClone(kernel.getDocument());
    const beforeTransactions = structuredClone(kernel.transactions());

    expect(validateAiPlan(validPlan, kernel, validation.ports)).toEqual({
      ok: true,
      plan: validPlan,
    });
    // A scratch insert gets one transaction id plus one inserted-node id.
    expect(validation.calls()).toEqual({ clock: 1, ids: 2 });
    expect(live.calls()).toEqual({ clock: 0, ids: 0 });
    expect(kernel.getDocument()).toEqual(beforeDocument);
    expect(kernel.transactions()).toEqual(beforeTransactions);
    expect(kernel.canUndo()).toBe(false);
  });

  // Mutation proof: in validate-plan.ts, replace `code: 'unknown-command'` with
  // `code: 'invalid-args'`; the issue-code assertion below must fail.
  it('reports unknown commands as unknown-command before any dry run', () => {
    const { kernel } = preflightKernel();
    const result = validateAiPlan(
      { rationale: 'Invent a bypass.', commands: [{ command: 'invent', args: {} }] },
      kernel,
      countedPorts('unknown').ports,
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

  // Mutation proof: in validate-plan.ts, replace `code: 'invalid-args'` with
  // `code: 'unknown-command'`; the issue-code assertion below must fail.
  it('reports malformed command arguments as invalid-args before any dry run', () => {
    const { kernel } = preflightKernel();
    const result = validateAiPlan(
      {
        rationale: 'Omit required command fields.',
        commands: [{ command: 'insertNode', args: { type: 'preflight-text' } }],
      },
      kernel,
      countedPorts('malformed').ports,
    );

    expect(result).toMatchObject({ ok: false, issues: [{ code: 'invalid-args', step: 0 }] });
  });

  // Mutation proof: in validate-plan.ts, change `blocks: kernel.context.registry.blocks().map` to
  // `blocks: kernel.context.registry.blocks().filter(({ schema }) => schema.type !== 'preflight-page').map`;
  // this exact unregistered-child message must fail because the scratch parent is then missing instead.
  it('reports an unregistered block type as a door-rejected scratch-kernel failure', () => {
    const { kernel } = preflightKernel();
    const result = validateAiPlan(
      {
        rationale: 'Insert a type that the slot permits but the registry does not know.',
        commands: [{ command: 'insertNode', args: { type: 'preflight-ghost', parentId: 'root' } }],
      },
      kernel,
      countedPorts('unregistered').ports,
    );

    expect(result).toMatchObject({ ok: false, issues: [{ code: 'door-rejected', step: 0 }] });
    if (!result.ok) {
      expect(result.issues[0]?.message).toContain('Type "preflight-ghost" is not registered.');
    }
  });

  // Mutation proof: in validate-plan.ts, change `blocks: kernel.context.registry.blocks().map` to
  // `blocks: kernel.context.registry.blocks().filter(({ schema }) => schema.type !== 'preflight-hero').map`;
  // the exact slot-allow message must fail because the scratch parent is then missing instead.
  it('reports a slot allow refusal as a door-rejected scratch-kernel failure', () => {
    const { kernel } = preflightKernel();
    const result = validateAiPlan(
      {
        rationale: 'Put a hero into a text-only actions slot.',
        commands: [
          {
            command: 'insertNode',
            args: { type: 'preflight-hero', parentId: 'hero-1', slot: 'actions' },
          },
        ],
      },
      kernel,
      countedPorts('slot-refusal').ports,
    );

    expect(result).toMatchObject({ ok: false, issues: [{ code: 'door-rejected', step: 0 }] });
    if (!result.ok) {
      expect(result.issues[0]?.message).toContain(
        'Slot "actions" of "hero-1" accepts [preflight-text], not "preflight-hero".',
      );
    }
  });
});
