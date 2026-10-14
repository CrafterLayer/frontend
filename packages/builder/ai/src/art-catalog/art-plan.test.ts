import { describe, expect, it } from 'vitest';

import type { CustomCodeRoot } from '@craftkit/builder-schema';

import { generateAiPlan } from '../plan/generate-plan';
import { kitKernel, kitPorts } from '../section-kit/kit-testing';
import type { AiPlan, AiPlanProvider } from '../types';

/*
  The lazy load end to end (art catalog, 2026-10-14). Tool expansion is
  synchronous, so the plan's judge loads the catalog when the model's answer
  names art — nothing in this file loads it first. Vitest gives each file its
  own module graph: the catalog starts unloaded here.
*/

function answering(plan: unknown): AiPlanProvider {
  return { propose: () => Promise.resolve(plan as AiPlan) };
}

describe('generateAiPlan — an answer that names art loads the catalog before its tools expand', () => {
  it('resolves a logo row the model asked for by brand name', async () => {
    const plan = await generateAiPlan({
      kernel: kitKernel(),
      provider: answering({
        rationale: 'Add the payment methods',
        commands: [
          {
            command: 'tool',
            args: {
              name: 'kit.insert',
              input: {
                kit: 'logos-row',
                slots: {
                  title: 'We accept',
                  items: [{ name: 'Visa', image: { src: 'logo:visa' } }],
                },
              },
            },
          },
        ],
      }),
      request: 'Add the cards we accept: Visa',
      validationPorts: kitPorts(),
    });
    const insert = plan.commands.find(({ command }) => command === 'insertNode');
    const tree = (insert?.args as { props?: { tree?: CustomCodeRoot } } | undefined)?.props?.tree;
    expect(JSON.stringify(tree)).toContain('"src":"https://cdn.simpleicons.org/visa"');
    expect(JSON.stringify(tree)).toContain('"alt":"Visa logo"');
  });
});
