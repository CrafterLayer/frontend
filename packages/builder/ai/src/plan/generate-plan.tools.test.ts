import { describe, expect, it } from 'vitest';

import { fixedClock, seededIds } from '@craftkit/builder-core/testing';

import { fixtureKernel } from '../tools/agent/agent-tools.fixtures';
import type { AiPlan, AiPlanProvider, AiPlanValidationIssue } from '../types';
import { generateAiPlan } from './generate-plan';
import { serializeTreeMarkup } from './tree-markup';

/*
  agent-tools (2026-09-30): a provider answer may name a TOOL step instead of
  writing markup. It is expanded before the door, so what lands is the
  ordinary setProp it stands for, and a tool the door cannot expand costs the
  one repair round like any refused step.
*/

const toolAnswer: AiPlan = {
  rationale: 'Retitle the story.',
  commands: [{ command: 'tool', args: { name: 'copy.set', input: { edits: [{ find: 'Our story', text: 'Roots' }] } } }],
};

const ports = () => ({ clock: fixedClock(20), ids: seededIds('tools-generate') });

describe('generateAiPlan — tool steps', () => {
  it('lands a scripted tool step as the setProp it stands for', async () => {
    const kernel = fixtureKernel();
    const provider: AiPlanProvider = { propose: () => Promise.resolve(toolAnswer) };
    const plan = await generateAiPlan({ kernel, provider, request: 'rename the story heading', validationPorts: ports() });
    expect(plan.commands).toHaveLength(1);
    expect(plan.commands[0]).toMatchObject({ command: 'setProp', args: { id: 'r-story', key: 'tree' } });
    expect(serializeTreeMarkup((plan.commands[0]?.args as { value: unknown }).value)).toContain('>Roots</h2>');
  });

  it('sends a tool the door cannot expand to the repair round with its reason', async () => {
    const kernel = fixtureKernel();
    const seen: (readonly AiPlanValidationIssue[])[] = [];
    const provider: AiPlanProvider = {
      propose: () =>
        Promise.resolve({
          rationale: 'Bad tool.',
          commands: [{ command: 'tool', args: { name: 'copy.set', input: { edits: [{ find: 'Nope', text: 'x' }] } } }],
        }),
      repair: (_request, _context, _plan, issues) => {
        seen.push(issues);
        return Promise.resolve(toolAnswer);
      },
    };
    const plan = await generateAiPlan({ kernel, provider, request: 'rename it', validationPorts: ports() });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.[0]?.message).toMatch(/^Step 0 \(tool copy\.set\): edit 1: text "Nope" was not found/u);
    expect(plan.commands[0]).toMatchObject({ command: 'setProp', args: { id: 'r-story', key: 'tree' } });
  });
});
