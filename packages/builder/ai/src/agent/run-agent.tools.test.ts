import { describe, expect, it } from 'vitest';

import { fixedClock, seededIds } from '@craftkit/builder-core/testing';

import { fixtureKernel } from '../tools/agent/agent-tools.fixtures';
import type { AiPlanProvider } from '../types';
import { runAiAgent } from './run-agent';

/*
  agent-tools (2026-09-30): «غيّر اللون إلى الأخضر» is a whole request the
  lexicon reads, so it lands with NO provider call — one labelled
  transaction through the door, source 'direct', 0 tokens.
*/

let calls = 0;
const neverCalled: AiPlanProvider = {
  propose: () => {
    calls += 1;
    return Promise.reject(new Error('A direct tool must not ask the provider.'));
  },
};

function pageCss(kernel: ReturnType<typeof fixtureKernel>): string {
  const document = kernel.getDocument();
  const css = document.nodes[document.rootId]?.props['pageCss'];
  return typeof css === 'string' ? css : '';
}

describe('runAiAgent — zero-token tools', () => {
  it('Auto: recolours the page with zero provider calls', async () => {
    calls = 0;
    const kernel = fixtureKernel({ locale: 'ar' });
    const before = pageCss(kernel);
    const result = await runAiAgent({
      runId: 'tool-colour',
      clock: fixedClock(1),
      kernel,
      provider: neverCalled,
      request: 'غيّر اللون إلى الأخضر',
      apply: 'auto',
      validationPorts: { clock: fixedClock(2), ids: seededIds('tools-run') },
    });
    expect(calls).toBe(0);
    expect(result).toMatchObject({ status: 'applied', source: 'direct', tokens: 0 });
    expect(pageCss(kernel)).not.toBe(before);
    expect(pageCss(kernel)).toContain('--ck-accent:#047857');
    expect(kernel.transactions()).toHaveLength(1);
  });

  it('Ask: proposes the tool plan and writes nothing', async () => {
    calls = 0;
    const kernel = fixtureKernel();
    const before = pageCss(kernel);
    const result = await runAiAgent({
      runId: 'tool-colour-ask',
      clock: fixedClock(1),
      kernel,
      provider: neverCalled,
      request: 'change the colour to red',
      apply: 'never',
      validationPorts: { clock: fixedClock(2), ids: seededIds('tools-run-ask') },
    });
    expect(calls).toBe(0);
    expect(result).toMatchObject({ status: 'proposed', source: 'direct', tokens: 0 });
    expect(pageCss(kernel)).toBe(before);
  });
});

describe('runAiAgent — a writer’s tool lanes and sample values reach generation', () => {
  /*
    run-build spreads `sampleValues` into a writer's run and the writer's
    prompt lists only the section lane; before 2026-09-30 neither reached
    `expandAgentTools`, so a writer could name any tool and an SEO tool never
    saw the facts ledger. The provider here is the writer.
  */
  function toolProvider(name: string, input: unknown) {
    const seen: string[] = [];
    const plan = { rationale: 'tool', commands: [{ command: 'tool', args: { name, input } }] };
    const provider: AiPlanProvider = {
      propose: () => Promise.resolve(plan),
      repair: (_request, _context, _plan, issues) => {
        seen.push(...issues.map((issue) => issue.message));
        return Promise.resolve(plan);
      },
    };
    return { provider, seen };
  }

  it('refuses a tool outside toolLanes, naming only the lane’s tools', async () => {
    const { provider, seen } = toolProvider('theme.apply', { accent: 'emerald-700' });
    await runAiAgent({
      runId: 'lanes',
      clock: fixedClock(1),
      kernel: fixtureKernel(),
      provider,
      request: 'write the section',
      apply: 'never',
      directEdits: false,
      toolLanes: ['section'],
      validationPorts: { clock: fixedClock(2), ids: seededIds('lanes') },
    }).catch(() => undefined);
    expect(seen.some((message) => message.includes('unknown tool "theme.apply"'))).toBe(true);
    expect(seen.join(' ')).toContain('kit.section');
  });

  it('keeps a sample value out of seo.business when sampleValues are given', async () => {
    const phone = '+962 7 9000 0000';
    const { provider, seen } = toolProvider('seo.business', { type: 'Restaurant', name: 'بُن', telephone: phone });
    await runAiAgent({
      runId: 'samples',
      clock: fixedClock(1),
      kernel: fixtureKernel({ locale: 'ar' }),
      provider,
      request: 'set the business',
      apply: 'never',
      directEdits: false,
      sampleValues: [phone],
      validationPorts: { clock: fixedClock(2), ids: seededIds('samples') },
    }).catch(() => undefined);
    expect(seen.some((message) => /sample/iu.test(message))).toBe(true);
  });
});
