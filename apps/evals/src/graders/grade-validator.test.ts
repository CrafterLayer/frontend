import { describe, expect, it } from 'vitest';

import { gradePlanValidates } from './grade-validator';
import { planWith, runOutput } from './test-support';

describe('gradePlanValidates', () => {
  it('passes a plan the real validator accepts against a real kernel', () => {
    const result = gradePlanValidates(runOutput());
    expect(result.pass).toBe(true);
    expect(result.reason).toContain('validateAiPlan');
  });

  it('fails a plan that addresses a node the document does not have', () => {
    const result = gradePlanValidates(
      runOutput({
        plan: planWith([
          { command: 'setProp', args: { id: 'ghost-1', key: 'heading', value: 'Nope' } },
        ]),
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('validateAiPlan rejected');
  });

  it('fails a plan that inserts the document root type inside itself', () => {
    const result = gradePlanValidates(
      runOutput({
        plan: planWith([
          { command: 'insertNode', args: { type: 'page', props: {}, parentId: 'root' } },
        ]),
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('ROOT type');
  });

  it('fails a plan whose class list hard-codes a colour the theme cannot reach', () => {
    const result = gradePlanValidates(
      runOutput({
        plan: planWith([
          {
            command: 'insertNode',
            args: {
              type: 'faq',
              props: { heading: 'Questions', className: 'bg-blue-500' },
              parentId: 'root',
            },
          },
        ]),
      }),
    );
    expect(result.pass).toBe(false);
  });

  it('fails a plan whose command is not registered at all', () => {
    const result = gradePlanValidates(
      runOutput({ plan: planWith([{ command: 'launchMissiles', args: {} }]) }),
    );
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('unknown-command');
  });

  it('treats a refusal as valid — there is no plan to reject', () => {
    const result = gradePlanValidates(
      runOutput({
        outcome: 'refusal',
        plan: null,
        policy: null,
        failure: { source: 'provider', code: 'refusal', message: 'Cannot do that.', retryable: false },
      }),
    );
    expect(result.pass).toBe(true);
  });

  it('fails a run that neither planned nor refused', () => {
    const result = gradePlanValidates(
      runOutput({
        outcome: 'error',
        plan: null,
        policy: null,
        failure: { source: 'provider', code: 'network', message: 'socket hang up', retryable: true },
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('socket hang up');
  });

  it('validates against the fixture the run actually started from', () => {
    /*
      The same plan is legal on `starter` and illegal on `empty`: ev-0001 only
      exists in one of them. If this grader ever stopped reading `output.fixture`
      and hard-coded a kernel, this is the test that would notice.
    */
    const plan = planWith([
      { command: 'setProp', args: { id: 'ev-0001', key: 'heading', value: 'Ship the page' } },
    ]);
    expect(gradePlanValidates(runOutput({ fixture: 'starter', plan })).pass).toBe(true);
    expect(
      gradePlanValidates(
        runOutput({
          fixture: 'empty',
          plan,
          document: { rootId: 'root', rootType: 'page', nodeIds: ['root'] },
        }),
      ).pass,
    ).toBe(false);
  });
});
