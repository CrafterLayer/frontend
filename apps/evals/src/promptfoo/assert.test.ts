import { describe, expect, it } from 'vitest';

import { evalCase, runOutput } from '../graders/test-support';

import { assertionsFor, parseRunOutput, rubricEnabled } from './assert';
import type { PromptfooGradingResult } from './contract';
import { evalTestCases } from './tests';

function call(
  assertion: { value: string | ((output: string, context: unknown) => PromptfooGradingResult) },
  output: string,
): PromptfooGradingResult {
  if (typeof assertion.value !== 'function') throw new Error('expected a function assertion');
  return assertion.value(output, {});
}

describe('parseRunOutput', () => {
  it('round-trips the runner’s output', () => {
    expect(parseRunOutput(JSON.stringify(runOutput())).caseId).toBe('test-case');
  });

  it('says the provider did not return JSON rather than throwing a syntax error', () => {
    expect(() => parseRunOutput('<html>500</html>')).toThrow(/did not return JSON/u);
  });

  it('names the missing field when the harness returns the wrong shape', () => {
    expect(() => parseRunOutput(JSON.stringify({ caseId: 'x', outcome: 'plan' }))).toThrow(
      /missing "metrics"/u,
    );
  });
});

describe('assertionsFor', () => {
  it('wires six deterministic graders plus the weightless coverage metric', () => {
    const assertions = assertionsFor(evalCase(), { rubric: false });
    expect(assertions.map((assertion) => assertion.metric)).toEqual([
      'valid',
      'command-policy',
      'node-references',
      'design-tokens',
      'expectations',
      'cost',
      'coverage',
    ]);
    expect(assertions.every((assertion) => assertion.type === 'javascript')).toBe(true);
  });

  it('adds exactly one model-judged assertion when the rubric is switched on', () => {
    const assertions = assertionsFor(evalCase(), { rubric: true });
    const rubrics = assertions.filter((assertion) => assertion.type === 'llm-rubric');
    expect(rubrics).toHaveLength(1);
    expect(rubrics[0]?.weight).toBe(0);
    expect(String(rubrics[0]?.value)).toContain('Does it read like a real FAQ?');
  });

  it('leaves the rubric off by default, so the suite needs no key', () => {
    expect(rubricEnabled({})).toBe(false);
    expect(rubricEnabled({ CRAFTKIT_EVAL_RUBRIC: '1' })).toBe(true);
    expect(assertionsFor(evalCase(), {}).some((assertion) => assertion.type === 'llm-rubric')).toBe(
      rubricEnabled(),
    );
  });

  it('returns promptfoo grading results a bad plan actually fails', () => {
    const assertions = assertionsFor(evalCase(), { rubric: false });
    const bad = JSON.stringify(
      runOutput({
        plan: {
          rationale: 'Ignoring the catalog.',
          commands: [{ command: 'applyPatches', args: { patches: [] } }],
        },
      }),
    );
    const policy = assertions.find((assertion) => assertion.metric === 'command-policy');
    if (policy === undefined) throw new Error('the command-policy assertion is missing');
    expect(call(policy, bad).pass).toBe(false);
  });

  it('returns a passing grading result for a good plan', () => {
    const assertions = assertionsFor(evalCase(), { rubric: false });
    const good = JSON.stringify(runOutput());
    for (const assertion of assertions) {
      const result = call(assertion, good);
      expect(result.pass, `${assertion.metric ?? '?'} failed: ${result.reason}`).toBe(true);
    }
  });
});

describe('evalTestCases', () => {
  it('produces one promptfoo test per corpus case, carrying the id the provider needs', () => {
    const tests = evalTestCases();
    expect(tests.length).toBeGreaterThanOrEqual(20);
    expect(tests.every((test) => test.vars['caseId'] !== undefined)).toBe(true);
    expect(tests.every((test) => test.assert.length >= 7)).toBe(true);
  });
});
