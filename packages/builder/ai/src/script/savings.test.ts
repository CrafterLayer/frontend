import { afterAll, describe, expect, it } from 'vitest';

import { expandAgentTools } from '../tools/agent/expand';
import type { AgentToolStep } from '../tools/agent/types';
import { coalesceScriptSteps } from './coalesce';
import { expandScriptSteps } from './expand-scripts';
import { createInlineScriptRunner } from './runner-inline';
import { buttonsKernel, menuKernel, menuToolSteps, MENU_SCRIPT, policyOf, scriptPlan } from './script.fixtures';

/*
  agent-script DESIGN §A.12 acceptance, with JSON length as the token proxy:
  the plan a model writes as ONE script is at most half the plan it writes as
  plain steps for the same change — and both land the same page.
*/

const runner = createInlineScriptRunner();
afterAll(() => {
  runner.dispose();
});

const size = (plan: unknown): number => JSON.stringify(plan).length;

const ROUND = "ck.style(ck.find({kind:'button'}),{borderRadius:'full'})";

describe('script savings', () => {
  it('14 buttons over 3 regions: the script plan is ≤ 50% of the plain-steps plan and of the kernel steps', async () => {
    const kernel = buttonsKernel();
    const script = scriptPlan(ROUND);
    const expansion = await expandScriptSteps(script, kernel, { runner, policy: policyOf(kernel) });
    expect(expansion.issues).toEqual([]);
    // What a model writes today: one element.style step per button.
    const paths: readonly (readonly [string, readonly number[]])[] = [
      ...[1, 2, 3, 4, 5].map((at) => ['r-a', [0, at]] as const),
      ...[0, 1, 2, 3, 4].map((at) => ['r-b', [0, 1, at]] as const),
      ...[1, 2, 3, 4].map((at) => ['r-c', [0, at]] as const),
    ];
    const plain = {
      rationale: 'script',
      commands: paths.map(([id, path]) => ({
        command: 'tool',
        args: { name: 'element.style', input: { id, path, styles: [{ property: 'borderRadius', value: 'full' }] } },
      })),
    };
    expect(size(script) / size(plain)).toBeLessThanOrEqual(0.5);
    expect(size(script) / size(expansion.plan)).toBeLessThanOrEqual(0.5);
    // The same page either way.
    const steps = (expandAgentTools(plain, kernel).plan as { commands: AgentToolStep[] }).commands;
    const folded = coalesceScriptSteps(steps, (id, key) => kernel.getDocument().nodes[id]?.props[key]);
    expect(folded.ok && folded.steps.map(({ command, args }) => ({ command, args }))).toEqual(
      (expansion.plan as { commands: AgentToolStep[] }).commands.map(({ command, args }) => ({ command, args })),
    );
  });

  it('12 dishes priced 2–8: the script plan is ≤ 50% of the plain-steps plan, same items', async () => {
    const kernel = menuKernel();
    const script = scriptPlan(MENU_SCRIPT);
    const expansion = await expandScriptSteps(script, kernel, { runner, policy: policyOf(kernel) });
    expect(expansion.issues).toEqual([]);
    const plain = { rationale: 'script', commands: menuToolSteps() };
    expect(size(script) / size(plain)).toBeLessThanOrEqual(0.5);
    const steps = (expandAgentTools(plain, kernel).plan as { commands: AgentToolStep[] }).commands;
    const lastItems = [...steps].reverse().find(({ args }) => args['key'] === 'items')?.args['value'];
    const scripted = (expansion.plan as { commands: AgentToolStep[] }).commands;
    expect(scripted).toHaveLength(1);
    expect(scripted[0]?.args['value']).toEqual(lastItems);
    expect((lastItems as unknown[]).length).toBe(12);
  });
});
