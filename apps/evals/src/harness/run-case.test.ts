import { describe, expect, it } from 'vitest';

import { findEvalCase, loadCorpus } from '../corpus/load';
import { gradeCommandPolicy, gradeNodeReferences, gradePlanValidates } from '../graders';

import type { AiPlanProvider } from './builder';
import { createEvalKernel, STARTER_FEATURES_ID, STARTER_HERO_ID } from './kernel';
import { createEvalProvider } from './provider';
import { runEvalCase } from './run-case';

const corpus = loadCorpus();
const offline = { provider: createEvalProvider({ mode: 'offline' }), mode: 'offline' as const };

describe('createEvalKernel', () => {
  it('gives the empty fixture a page root and nothing else', () => {
    const document = createEvalKernel('empty').getDocument();
    expect(Object.keys(document.nodes)).toEqual(['root']);
    expect(document.nodes['root']?.type).toBe('page');
  });

  it('gives the starter fixture the two nodes the corpus names by id', () => {
    const document = createEvalKernel('starter').getDocument();
    expect(document.nodes[STARTER_HERO_ID]?.type).toBe('hero');
    expect(document.nodes[STARTER_FEATURES_ID]?.type).toBe('features');
  });

  it('carries the document direction, so an RTL case is really RTL', () => {
    expect(createEvalKernel('empty', 'rtl').getDocument().dir).toBe('rtl');
  });

  it('is deterministic: the same fixture produces the same ids every time', () => {
    expect(Object.keys(createEvalKernel('starter').getDocument().nodes)).toEqual(
      Object.keys(createEvalKernel('starter').getDocument().nodes),
    );
  });
});

describe('runEvalCase records how hard the run worked', () => {
  /*
    These three metrics are what the plan's two headline gates are computed
    from — "success without repair" and "success after repair" — and before
    them the harness recorded only the outcome, so a run that got it right
    first time and a run that needed a correction were the same number.

    A scripted provider is the only way to put a run in each state on purpose:
    the offline provider always succeeds on the first attempt, which is exactly
    why an offline-only test would prove nothing.
  */
  const kernelCase = findEvalCase('06-named-block-faq', corpus);

  it('reports one attempt and no repair when the answer passes first time', async () => {
    const output = await runEvalCase(kernelCase, offline);

    expect(output.metrics.attempts).toBe(1);
    expect(output.metrics.repaired).toBe(false);
    expect(output.metrics.salvaged).toBeNull();
  });

  it('reports two attempts and a repair when the first answer was refused', async () => {
    let asked = 0;
    const provider: AiPlanProvider = {
      propose: () => {
        asked += 1;
        // A plan naming a node the document does not have: rejected by the door.
        return Promise.resolve({
          rationale: 'Edit something that is not there.',
          commands: [{ command: 'setProp', args: { id: 'no-such-node', key: 'heading', value: 'x' } }],
        });
      },
      repair: () =>
        Promise.resolve({
          rationale: 'Corrected.',
          commands: [{ command: 'setProp', args: { id: STARTER_HERO_ID, key: 'heading', value: 'Fixed' } }],
        }),
    };

    const output = await runEvalCase(kernelCase, { provider, mode: 'offline' });

    expect(asked).toBe(1);
    expect(output.outcome).toBe('plan');
    expect(output.metrics.attempts).toBe(2);
    expect(output.metrics.repaired).toBe(true);
  });

  it('reports what a salvage kept and dropped, apart from the outcome', async () => {
    /*
      The same mistake twice. The run keeps the steps the door accepts and
      names the ones it dropped — and that is NOT a clean success, which is
      why it is reported beside the outcome rather than folded into it.
    */
    const stubborn = {
      rationale: 'Two good edits around one impossible one.',
      commands: [
        { command: 'setProp', args: { id: STARTER_HERO_ID, key: 'heading', value: 'One' } },
        { command: 'setProp', args: { id: 'no-such-node', key: 'heading', value: 'Doomed' } },
        { command: 'setProp', args: { id: STARTER_FEATURES_ID, key: 'heading', value: 'Two' } },
      ],
    };
    const provider: AiPlanProvider = {
      propose: () => Promise.resolve(stubborn),
      repair: () => Promise.resolve(stubborn),
    };

    const output = await runEvalCase(kernelCase, { provider, mode: 'offline' });

    expect(output.metrics.salvaged).toEqual({ kept: 2, dropped: 1 });
    expect(output.metrics.attempts).toBe(2);
  });
});

describe('runEvalCase, offline', () => {
  it('produces a plan for an answerable request and never applies it', async () => {
    const evalCase = findEvalCase('06-named-block-faq', corpus);
    const output = await runEvalCase(evalCase, offline);
    expect(output.outcome).toBe('plan');
    expect(output.plan?.commands.length).toBeGreaterThan(0);
    // The document reported is the STARTING one: `apply: 'never'` is the contract.
    expect(output.document.nodeIds).toEqual(['root', STARTER_HERO_ID, STARTER_FEATURES_ID]);
  });

  it('reports a refusal as a refusal rather than as a crash', async () => {
    const output = await runEvalCase(findEvalCase('12-empty-request', corpus), offline);
    expect(output.outcome).toBe('refusal');
    expect(output.plan).toBeNull();
    expect(output.failure?.code).toBe('refusal');
  });

  it('carries the run’s own effective command allowlist out with the plan', async () => {
    const output = await runEvalCase(findEvalCase('06-named-block-faq', corpus), offline);
    expect(output.policy?.allowedCommands).toContain('insertNode');
    // Bulk patching is never granted unless a host names it explicitly.
    expect(output.policy?.allowedCommands).not.toContain('applyPatches');
  });

  it('measures context tokens and elapsed time', async () => {
    const output = await runEvalCase(findEvalCase('02-pricing-page', corpus), {
      ...offline,
      now: (() => {
        let value = 0;
        return () => {
          value += 25;
          return value;
        };
      })(),
    });
    expect(output.metrics.contextTokens).toBeGreaterThan(0);
    /*
      Fragments are DATA contributions — what an `aiContext` provider adds to a
      prompt — and the production catalog registers schemas only, so a run
      against it legitimately assembles none. Asserting "greater than zero" here
      was true of the six-block test fixture and became a false alarm the moment
      the harness started measuring the real vocabulary. What matters is that
      the metric is reported at all, and that the token count above proves
      context assembly actually ran.
    */
    expect(Number.isInteger(output.metrics.contextFragments)).toBe(true);
    expect(output.metrics.contextFragments).toBeGreaterThanOrEqual(0);
    expect(output.metrics.elapsedMs).toBe(25);
  });

  it('is deterministic: the same case twice produces the same plan', async () => {
    const evalCase = findEvalCase('16-stats-band', corpus);
    const first = await runEvalCase(evalCase, offline);
    const second = await runEvalCase(evalCase, offline);
    expect(JSON.stringify(second.plan)).toBe(JSON.stringify(first.plan));
  });

  it('produces output the deterministic graders can judge for every corpus case', async () => {
    /*
      The end-to-end proof that the harness and the graders fit together. It
      does NOT assert that the local provider is any good — it is a keyword
      matcher and it is not — only that every case runs, every answer is
      structurally judgeable, and any plan it does produce passes the real
      validator, the allowlist and the reference check. A regression in the
      RUNNER shows up here; a regression in the MODEL shows up in the promptfoo
      report.
    */
    for (const evalCase of corpus) {
      const output = await runEvalCase(evalCase, offline);
      expect(
        ['plan', 'refusal'],
        `${evalCase.id} crashed: ${output.failure?.message ?? ''}`,
      ).toContain(output.outcome);
      if (output.outcome !== 'plan') continue;
      expect(gradePlanValidates(output), `${evalCase.id} produced an invalid plan`).toMatchObject({
        pass: true,
      });
      expect(gradeCommandPolicy(output), `${evalCase.id} broke the allowlist`).toMatchObject({
        pass: true,
      });
      expect(gradeNodeReferences(output), `${evalCase.id} invented a node id`).toMatchObject({
        pass: true,
      });
    }
  }, 120_000);
});
