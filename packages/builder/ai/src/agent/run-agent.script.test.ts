import { describe, expect, it } from 'vitest';

import { fixedClock, seededIds } from '@craftkit/builder-core/testing';

import type { ScriptRunReport } from '../script/expand-scripts';
import { createInlineScriptRunner } from '../script/runner-inline';
import { scriptPlan, twoPageSite } from '../script/script.fixtures';
import { styleKernel } from '../style-tools/style-tools.fixtures';
import type { AiPlan, AiPlanProvider } from '../types';
import { runAiAgent } from './run-agent';
import type { AiAgentScriptSite } from './types';

/*
  agent-script (DESIGN §A.9, §A.10, script-wiring) in the bounded runner:
  - a direct script («خلي كل الأزرار مدورة») lands with NO provider call, as
    one labelled transaction that one Undo reverts;
  - a request no direct script reads reaches the provider as before;
  - a script that writes other pages lands as one site transaction in Auto,
    and is refused in words in Ask (a proposal rehearses one page, F3).
*/

const RENAME =
  "ck.find({page:'*',kind:'heading',text:'Brew Co'}).forEach(function(h){ck.set(h,{text:h.text.replace('Brew Co','Bean Co')})})";

const ports = (seed: string) => ({ clock: fixedClock(2), ids: seededIds(seed) });

function counting(answer?: AiPlan): { provider: AiPlanProvider; calls: () => number } {
  let calls = 0;
  return {
    provider: {
      propose: () => {
        calls += 1;
        return answer === undefined
          ? Promise.reject(new Error('A direct script must not ask the provider.'))
          : Promise.resolve(answer);
      },
    },
    calls: () => calls,
  };
}

function treeOf(kernel: ReturnType<typeof styleKernel>, id: string): string {
  return JSON.stringify(kernel.getDocument().nodes[id]?.props['tree'] ?? null);
}

function siteFixture() {
  const fixture = twoPageSite();
  const site: AiAgentScriptSite = {
    ...fixture.scriptSite,
    dispatchGroup: (steps, options) => fixture.site.dispatchGroup(steps, options),
  };
  const region = (pageId: string): string => {
    const document = fixture.site.page(pageId).getDocument();
    const [regionId] = document.nodes[document.rootId]?.slots?.['default'] ?? [];
    return JSON.stringify(regionId === undefined ? null : document.nodes[regionId]?.props['tree']);
  };
  return { ...fixture, site, kernel: fixture.site, lens: fixture.site.page(fixture.site.currentPage()), region };
}

describe('runAiAgent — a zero-token direct script', () => {
  it('«خلي كل الأزرار مدورة»: no provider call, one transaction, and Undo restores the page', async () => {
    const kernel = styleKernel({ locale: 'ar' });
    const before = JSON.stringify(kernel.getDocument());
    const reports: ScriptRunReport[] = [];
    const { provider, calls } = counting();

    const result = await runAiAgent({
      runId: 'script-round',
      clock: fixedClock(1),
      kernel,
      provider,
      request: 'خلي كل الأزرار مدورة',
      apply: 'auto',
      validationPorts: ports('script-round'),
      // No scriptRunner: the lazily loaded default runs it (in-thread under Node).
      onScriptRun: (report) => {
        reports.push(report);
      },
    });

    expect(calls()).toBe(0);
    expect(result).toMatchObject({ status: 'applied', source: 'direct', tokens: 0 });
    expect(reports).toHaveLength(1);
    expect(kernel.transactions()).toHaveLength(1);
    expect(treeOf(kernel, 'r-hero')).toContain('rounded-full');
    expect(result.plan.commands.every(({ command }) => command !== 'tool')).toBe(true);

    kernel.undo();
    expect(JSON.stringify(kernel.getDocument())).toBe(before);
  });

  it('a request no direct script reads falls through to the provider', async () => {
    const kernel = styleKernel();
    const reports: ScriptRunReport[] = [];
    const answer: AiPlan = {
      rationale: 'Retitle the page',
      commands: [{ command: 'setProp', args: { id: 'root', key: 'title', value: 'Brew & Co' } }],
    };
    const { provider, calls } = counting(answer);

    const result = await runAiAgent({
      runId: 'script-fallthrough',
      clock: fixedClock(1),
      kernel,
      provider,
      request: 'Add a testimonials section with three short quotes from regulars',
      apply: 'never',
      validationPorts: ports('script-fallthrough'),
      scriptRunner: createInlineScriptRunner(),
      onScriptRun: (report) => {
        reports.push(report);
      },
    });

    expect(calls()).toBe(1);
    expect(result).toMatchObject({ status: 'proposed', source: 'model' });
    expect(reports).toHaveLength(0);
    expect(kernel.transactions()).toHaveLength(0);
  });
});

describe('runAiAgent — a script that writes other pages', () => {
  it('Ask: proposes nothing, says how many pages in the request’s language, and offers the request again', async () => {
    const { site, kernel, lens, region } = siteFixture();
    const home = kernel.currentPage();
    const request = 'rename Brew Co to Bean Co on every page';
    const { provider, calls } = counting(scriptPlan(RENAME));

    const result = await runAiAgent({
      runId: 'script-cross-ask',
      clock: fixedClock(1),
      kernel: lens,
      provider,
      request,
      apply: 'never',
      directEdits: false,
      validationPorts: ports('script-cross-ask'),
      site,
      scriptRunner: createInlineScriptRunner(),
    });

    expect(calls()).toBe(1);
    expect(result.status).toBe('proposed');
    expect(result.plan.commands).toHaveLength(0);
    expect(result.proposal.plan.commands).toHaveLength(0);
    expect(result.plan.rationale).toContain('2 pages');
    expect(result.plan.rationale).toContain('Auto');
    expect(result.plan.followUp).toBe(request);
    expect(kernel.transactions()).toHaveLength(0);
    expect(region(home)).toContain('Brew Co');
    expect(region('about')).toContain('About Brew Co');
  });

  it('Ask in Arabic: the refusal is Arabic', async () => {
    const { site, lens } = siteFixture();
    const { provider } = counting(scriptPlan(RENAME));
    const result = await runAiAgent({
      runId: 'script-cross-ask-ar',
      clock: fixedClock(1),
      kernel: lens,
      provider,
      request: 'غيّر Brew Co إلى Bean Co في كل الصفحات',
      apply: 'never',
      directEdits: false,
      validationPorts: ports('script-cross-ask-ar'),
      site,
      scriptRunner: createInlineScriptRunner(),
    });
    expect(result.plan.commands).toHaveLength(0);
    expect(result.plan.rationale).toContain('صفحتين');
  });

  it('Auto: both pages land as ONE site transaction, and one Undo reverts both', async () => {
    const { site, kernel, lens, region } = siteFixture();
    const home = kernel.currentPage();
    const { provider } = counting(scriptPlan(RENAME));

    const result = await runAiAgent({
      runId: 'script-cross-auto',
      clock: fixedClock(1),
      kernel: lens,
      provider,
      request: 'rename Brew Co to Bean Co on every page',
      apply: 'auto',
      directEdits: false,
      validationPorts: ports('script-cross-auto'),
      site,
      scriptRunner: createInlineScriptRunner(),
    });

    expect(result.status).toBe('applied');
    expect(result.applied?.transactions).toHaveLength(1);
    expect(kernel.transactions()).toHaveLength(1);
    expect(region(home)).toContain('Bean Co');
    expect(region('about')).toContain('About Bean Co');

    expect(kernel.undo()).toBe(true);
    expect(region(home)).toContain('Brew Co');
    expect(region('about')).toContain('About Brew Co');
  });
});
