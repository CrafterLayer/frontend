import { describe, expect, it, vi } from 'vitest';

import { fixedClock, seededIds } from '@craftkit/builder-core/testing';

import type * as DefaultRunnerModule from '../script/default-runner';

/*
  agent-script (DESIGN §A.1, §A.7, script-wiring): a provider may answer with
  ONE `script.run` step; generation runs it before the door, so what comes
  back is an ordinary validated plan of kernel steps — one transaction, one
  Undo. The default runner is wrapped in a spy so the lazy path is provable:
  a plan without a script never reaches it.
*/
vi.mock('../script/default-runner', async (importOriginal) => {
  const actual = await importOriginal<typeof DefaultRunnerModule>();
  return { ...actual, defaultScriptRunner: vi.fn(actual.defaultScriptRunner) };
});

import { defaultScriptRunner } from '../script/default-runner';
import type { ScriptRunReport } from '../script/expand-scripts';
import { createInlineScriptRunner } from '../script/runner-inline';
import { resolveAiCommandPolicy } from '../skills';
import { styleKernel } from '../style-tools/style-tools.fixtures';
import type { AiPlan, AiPlanProvider, AiPlanValidationIssue } from '../types';
import { applyAiPlan } from './apply-plan';
import { generateAiPlan } from './generate-plan';

const ROUND_BUTTONS = "ck.style(ck.find({kind:'button'}),{borderRadius:'full'})";

function scriptPlan(code: string): AiPlan {
  return {
    rationale: 'Round every button',
    commands: [{ command: 'tool', args: { name: 'script.run', input: { code } } }],
  };
}

function ports(seed: string) {
  return { clock: fixedClock(2), ids: seededIds(seed) };
}

function treeText(kernel: ReturnType<typeof styleKernel>, id: string): string {
  return JSON.stringify(kernel.getDocument().nodes[id]?.props['tree'] ?? null);
}

describe('generateAiPlan — a script.run step', () => {
  it('comes back as validated kernel steps that land as ONE transaction, and Undo restores the page', async () => {
    const kernel = styleKernel();
    const runner = createInlineScriptRunner();
    const provider: AiPlanProvider = { propose: () => Promise.resolve(scriptPlan(ROUND_BUTTONS)) };
    const before = JSON.stringify(kernel.getDocument());

    const plan = await generateAiPlan({
      kernel,
      provider,
      request: 'round all the buttons',
      validationPorts: ports('script-generate'),
      scriptRunner: runner,
    });

    expect(plan.commands.length).toBeGreaterThan(0);
    expect(plan.commands.every(({ command }) => command !== 'tool')).toBe(true);
    expect(JSON.stringify(plan)).not.toContain('script.run');
    // Both regions with a ck-btn: header (Order) and hero (See the menu).
    const written = new Set(plan.commands.map(({ args }) => (args as { id?: unknown }).id));
    expect(written).toEqual(new Set(['r-header', 'r-hero']));

    const policy = resolveAiCommandPolicy({ registeredCommands: kernel.context.registry.commandNames() });
    applyAiPlan({ kernel, plan, policy, validationPorts: ports('script-apply') });
    expect(kernel.transactions()).toHaveLength(1);
    expect(treeText(kernel, 'r-header')).toContain('rounded-full');
    expect(treeText(kernel, 'r-hero')).toContain('rounded-full');
    expect(treeText(kernel, 'r-story')).not.toContain('rounded-full');

    kernel.undo();
    expect(JSON.stringify(kernel.getDocument())).toBe(before);
    runner.dispose();
  });

  it('sends a broken script to the repair round with its E_SYNTAX message and the ORIGINAL step', async () => {
    const kernel = styleKernel();
    const runner = createInlineScriptRunner();
    const broken = `let x: number = 1; ${ROUND_BUTTONS}`;
    const seen: { plan?: AiPlan; issues: readonly AiPlanValidationIssue[] } = { issues: [] };
    const provider: AiPlanProvider = {
      propose: () => Promise.resolve(scriptPlan(broken)),
      repair: (_request, _context, plan, issues) => {
        seen.plan = plan;
        seen.issues = issues;
        return Promise.resolve(scriptPlan(ROUND_BUTTONS));
      },
    };

    const plan = await generateAiPlan({
      kernel,
      provider,
      request: 'round all the buttons',
      validationPorts: ports('script-repair'),
      scriptRunner: runner,
    });

    const messages = seen.issues.map(({ message }) => message).join('\n');
    expect(messages).toContain('E_SYNTAX');
    expect(seen.issues.every(({ code }) => code === 'invalid-args')).toBe(true);
    expect(JSON.stringify(seen.plan)).toContain('let x: number = 1');
    expect(JSON.stringify(seen.plan)).toContain('script.run');
    // The corrected script lands as plain steps.
    expect(plan.commands.length).toBeGreaterThan(0);
    expect(JSON.stringify(plan)).not.toContain('script.run');
    runner.dispose();
  });

  it('never loads the default runner for a plan without script.run — and does for one with it', async () => {
    const spy = vi.mocked(defaultScriptRunner);
    spy.mockClear();
    const kernel = styleKernel();
    const plain: AiPlan = {
      rationale: 'Retitle the page',
      commands: [{ command: 'setProp', args: { id: 'root', key: 'title', value: 'Brew & Co' } }],
    };
    const plan = await generateAiPlan({
      kernel,
      provider: { propose: () => Promise.resolve(plain) },
      request: 'rename the page',
      validationPorts: ports('script-lazy'),
    });
    expect(plan.commands).toHaveLength(1);
    expect(spy).not.toHaveBeenCalled();

    // The same spy sees the run that needs it, so the assertion above is not vacuous.
    await generateAiPlan({
      kernel,
      provider: { propose: () => Promise.resolve(scriptPlan(ROUND_BUTTONS)) },
      request: 'round all the buttons',
      validationPorts: ports('script-lazy-2'),
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('reports every script run through onScriptRun', async () => {
    const kernel = styleKernel();
    const runner = createInlineScriptRunner();
    const reports: ScriptRunReport[] = [];
    await generateAiPlan({
      kernel,
      provider: {
        propose: () =>
          Promise.resolve(scriptPlan(`ck.note('Round every button');${ROUND_BUTTONS};return 'done'`)),
      },
      request: 'round all the buttons',
      validationPorts: ports('script-report'),
      scriptRunner: runner,
      onScriptRun: (report) => {
        reports.push(report);
      },
    });
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ step: 0, notes: ['Round every button'] });
    expect(reports[0]?.result).toContain('done');
    expect(reports[0]?.calls).toBeGreaterThanOrEqual(2);
    expect(reports[0]?.steps).toBeGreaterThanOrEqual(1);
    runner.dispose();
  });
});
