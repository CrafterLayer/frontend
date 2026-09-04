import { describe, expect, it } from 'vitest';

import { findEvalCase, loadCorpus } from '../corpus/load';
import { gradeCommandPolicy, gradeNodeReferences, gradePlanValidates } from '../graders';

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
