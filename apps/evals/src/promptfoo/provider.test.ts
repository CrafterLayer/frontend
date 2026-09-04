import { describe, expect, it } from 'vitest';

import { parseRunOutput } from './assert';
import CraftkitPlanProvider from './provider';

describe('the promptfoo provider', () => {
  it('names itself by mode, so two runs are distinguishable in a report', () => {
    expect(new CraftkitPlanProvider({ config: { mode: 'offline' } }).id()).toBe(
      'craftkit:plan:offline',
    );
    expect(new CraftkitPlanProvider({ id: 'custom' }).id()).toBe('custom');
  });

  it('runs the corpus case named by the caseId var and answers with the run record', async () => {
    const provider = new CraftkitPlanProvider({ config: { mode: 'offline' } });
    const response = await provider.callApi('ignored', {
      vars: { caseId: '06-named-block-faq' },
    });
    expect(response.error).toBeUndefined();
    const output = parseRunOutput(response.output ?? '');
    expect(output.caseId).toBe('06-named-block-faq');
    expect(output.outcome).toBe('plan');
    expect(response.tokenUsage?.prompt).toBe(output.metrics.contextTokens);
  });

  it('runs the request from the CASE, never the rendered prompt', async () => {
    /*
      Three corpus requests are prompt injections. If the provider ever started
      trusting the string promptfoo hands it, a template engine would sit
      between the attack and the assistant and the eval would stop measuring
      the attack it was written for.
    */
    const provider = new CraftkitPlanProvider({ config: { mode: 'offline' } });
    const response = await provider.callApi('a completely different request', {
      vars: { caseId: '16-stats-band' },
    });
    const output = parseRunOutput(response.output ?? '');
    expect(output.request).toContain('four numbers');
  });

  it('reports a refusal as a normal answer rather than as a provider error', async () => {
    const provider = new CraftkitPlanProvider({ config: { mode: 'offline' } });
    const response = await provider.callApi('', { vars: { caseId: '12-empty-request' } });
    expect(response.error).toBeUndefined();
    expect(parseRunOutput(response.output ?? '').outcome).toBe('refusal');
  });

  it('explains itself when the test forgot the caseId var', async () => {
    const provider = new CraftkitPlanProvider({ config: { mode: 'offline' } });
    const response = await provider.callApi('anything', { vars: {} });
    expect(response.error).toContain('caseId');
  });

  it('explains itself when the caseId names no corpus file', async () => {
    const provider = new CraftkitPlanProvider({ config: { mode: 'offline' } });
    const response = await provider.callApi('anything', { vars: { caseId: 'no-such-case' } });
    expect(response.error).toContain('no-such-case');
  });
});
