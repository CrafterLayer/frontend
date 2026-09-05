import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  type BlockRenderComponent,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { createCraftkitAiSkillRegistry } from '../skills/builtins';
import { createAiSkillRegistry } from '../skills/registry';
import type { AiPlan, AiPlanProvider, AssembledAiContext } from '../types';
import { AI_PLAN_MODE_SKILL_ID, outlineAiPlan } from './outline-plan';

const Null: BlockRenderComponent = () => null;
const vocabulary: TrustedExtensionManifest = {
  tier: 1,
  name: 'outline-vocabulary',
  version: '0.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'The page root.',
          props: z.object({}),
          slots: { default: { allow: ['hero'] } },
          examples: [],
        }),
        render: Null,
      },
      {
        schema: defineBlockSchema({
          type: 'hero',
          description: 'An opening section.',
          props: z.object({ heading: z.string().default('') }),
          examples: [],
        }),
        render: Null,
      },
    ],
  },
};

function kernelOf(): BuilderKernel {
  return createBuilder({
    extensions: [vocabulary],
    ports: { clock: fixedClock(), ids: seededIds('outline') },
  });
}

function providerReturning(plan: AiPlan): AiPlanProvider & { seen: AssembledAiContext[] } {
  const seen: AssembledAiContext[] = [];
  return {
    seen,
    propose: (_request, context) => {
      seen.push(context);
      return Promise.resolve(plan);
    },
  };
}

const registry = createCraftkitAiSkillRegistry();

describe('outlineAiPlan', () => {
  it('returns the plan as PROSE and never touches the document', async () => {
    const kernel = kernelOf();
    const before = JSON.stringify(kernel.getDocument());
    const provider = providerReturning({
      rationale: 'GOAL: a clinic page.\nOUTLINE: hero, services, contact.',
      commands: [],
      followUp: 'ابدأ البناء',
    });

    const outline = await outlineAiPlan({
      kernel,
      provider,
      request: 'صفحة عيادة أسنان',
      skillRegistry: registry,
    });

    expect(outline.rationale).toContain('OUTLINE:');
    expect(outline.followUp).toBe('ابدأ البناء');
    expect(outline.droppedCommands).toBe(0);
    // The claim that matters: nothing was written, and no transaction exists.
    expect(JSON.stringify(kernel.getDocument())).toBe(before);
    expect(kernel.transactions()).toEqual([]);
  });

  it('activates craftkit.plan-mode without the caller naming it', async () => {
    const provider = providerReturning({ rationale: 'a plan', commands: [] });

    const outline = await outlineAiPlan({
      kernel: kernelOf(),
      provider,
      request: 'a clinic page',
      skillRegistry: registry,
    });

    expect(outline.skillActivations?.map(({ id }) => id)).toContain(AI_PLAN_MODE_SKILL_ID);
  });

  it('keeps the host’s own pinned skills, and adds Plan’s to them', async () => {
    const provider = providerReturning({ rationale: 'a plan', commands: [] });

    const outline = await outlineAiPlan({
      kernel: kernelOf(),
      provider,
      request: 'a clinic page',
      skillRegistry: registry,
      selectedSkillIds: ['craftkit.arabic-rtl'],
    });

    const ids = outline.skillActivations?.map(({ id }) => id) ?? [];
    expect(ids).toContain('craftkit.arabic-rtl');
    expect(ids).toContain(AI_PLAN_MODE_SKILL_ID);
  });

  it('shows the model NO command vocabulary — the strongest way to say “do not edit”', async () => {
    const provider = providerReturning({ rationale: 'a plan', commands: [] });

    await outlineAiPlan({
      kernel: kernelOf(),
      provider,
      request: 'a clinic page',
      skillRegistry: registry,
    });

    const context = provider.seen[0];
    expect(context?.commands).toEqual([]);
  });

  it('asks for an output with NO commands, instead of demanding at least one', async () => {
    /*
      The build contract requires `commands` with `minItems: 1`. Shipping that
      with a "do not propose edits" instruction would contradict the instruction
      in the part of the request a model is most likely to obey.
    */
    const provider = providerReturning({ rationale: 'a plan', commands: [] });

    await outlineAiPlan({
      kernel: kernelOf(),
      provider,
      request: 'a clinic page',
      skillRegistry: registry,
    });

    const contract = provider.seen[0]?.outputContract;
    expect(contract).toBeDefined();
    const commands = (
      contract?.schema as {
        properties: { commands: { maxItems?: number; minItems?: number } };
      }
    ).properties.commands;
    expect(commands.maxItems).toBe(0);
    expect(commands.minItems).toBeUndefined();
  });

  it('DROPS commands a provider returned anyway, and says how many', async () => {
    /*
      A model that ignores the instruction should cost the person a paragraph,
      not their turn — and never a write. Reported rather than swallowed,
      because "why did nothing happen" deserves the real answer.
    */
    const kernel = kernelOf();
    const provider = providerReturning({
      rationale: 'a plan, with edits nobody asked for',
      commands: [
        { command: 'insertNode', args: { type: 'hero', parentId: 'root' } },
        { command: 'setProp', args: { id: 'root', key: 'x', value: 1 } },
      ],
    });

    const outline = await outlineAiPlan({
      kernel,
      provider,
      request: 'a clinic page',
      skillRegistry: registry,
    });

    expect(outline.droppedCommands).toBe(2);
    expect(kernel.getDocument().nodes['root']?.slots).toBeUndefined();
    expect(kernel.transactions()).toEqual([]);
  });

  it('treats a blank followUp as none, rather than offering an empty chip', async () => {
    const provider = providerReturning({ rationale: 'a plan', commands: [], followUp: '   ' });

    const outline = await outlineAiPlan({
      kernel: kernelOf(),
      provider,
      request: 'a clinic page',
      skillRegistry: registry,
    });

    expect(outline.followUp).toBeUndefined();
  });

  it('returns the follow-up TRIMMED, because that string becomes a button', () => {
    /*
      The first version tested `.trim()` for emptiness and returned the padded
      original. That string is a chip's label, its accessible name, and the text
      sent when it is pressed — three places where the whitespace shows.
    */
    return expect(
      outlineAiPlan({
        kernel: kernelOf(),
        provider: providerReturning({
          rationale: 'a plan',
          commands: [],
          followUp: '  ابدأ البناء  ',
        }),
        request: 'a clinic page',
        skillRegistry: registry,
      }).then(({ followUp }) => followUp),
    ).resolves.toBe('ابدأ البناء');
  });

  it('aborts before asking, when the caller already cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const propose = vi.fn();

    await expect(
      outlineAiPlan({
        kernel: kernelOf(),
        provider: { propose },
        request: 'a clinic page',
        skillRegistry: registry,
        signal: controller.signal,
      }),
    ).rejects.toThrow();
    expect(propose).not.toHaveBeenCalled();
  });

  it('refuses a blank plan rather than rendering an empty card', async () => {
    /*
      `AiOutline.rationale` promises "Never empty", and the check that enforces
      it on the ordinary route lives in `validateAiPlan` — a door the outline
      deliberately never reaches. Without this, a malformed server produced a
      blank card, which reads as "the assistant answered and said nothing"
      rather than as the failure it is.
    */
    await expect(
      outlineAiPlan({
        kernel: kernelOf(),
        provider: providerReturning({ rationale: '   ', commands: [] }),
        request: 'a clinic page',
        skillRegistry: registry,
      }),
    ).rejects.toThrow(/empty plan/i);
  });

  it('still guards the abort AFTER the provider answers, not only before', async () => {
    /*
      A run cancelled while the model was mid-sentence must not settle a turn.
      The post-provider check is the one that catches it, and it survived a
      mutation until this test existed.
    */
    const controller = new AbortController();
    const provider: AiPlanProvider = {
      propose: () => {
        controller.abort();
        return Promise.resolve({ rationale: 'A plan.', commands: [] });
      },
    };

    await expect(
      outlineAiPlan({
        kernel: kernelOf(),
        provider,
        request: 'a clinic page',
        skillRegistry: registry,
        signal: controller.signal,
      }),
    ).rejects.toThrow();
  });

  it('does not name Plan’s skill to a registry that does not have it', async () => {
    /*
      `createAiSkillRegistry` defaults to an EMPTY catalog — the built-ins are
      opt-in — and the panel publishes `skillRegistry` as a prop. Naming the
      skill anyway made resolution throw `unknown-explicit-skill`, so a host
      with its own registry got a refusal card carrying a resolution error
      instead of a plan, every single time.

      The outline still works for that host: its guarantees come from an empty
      command vocabulary and from never reaching the door, not from the
      instructions.
    */
    const hostOnly = createAiSkillRegistry([
      {
        schemaVersion: 1,
        id: 'host.only',
        name: 'Host skill',
        description: 'The host’s own.',
        version: '1.0.0',
        instructions: 'Be brief.',
        activation: { mode: 'explicit' },
      },
    ]);

    const outline = await outlineAiPlan({
      kernel: kernelOf(),
      provider: providerReturning({ rationale: 'a plan', commands: [] }),
      request: 'a clinic page',
      skillRegistry: hostOnly,
    });

    expect(outline.rationale).toBe('a plan');
    expect(outline.skillActivations?.map(({ id }) => id) ?? []).not.toContain(
      AI_PLAN_MODE_SKILL_ID,
    );
  });

  it('works without a skill registry at all — a host may have its own', async () => {
    const provider = providerReturning({ rationale: 'a plan', commands: [] });

    const outline = await outlineAiPlan({
      kernel: kernelOf(),
      provider,
      request: 'a clinic page',
    });

    expect(outline.rationale).toBe('a plan');
    expect(outline.skillActivations).toBeUndefined();
  });
});
