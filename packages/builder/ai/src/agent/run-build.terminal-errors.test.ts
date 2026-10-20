import { describe, expect, it, vi } from 'vitest';

import { AiProviderError } from '../provider/errors';
import { parseTreeMarkup } from '../plan/tree-markup';
import type { AiPlan, AiPlanProvider } from '../types';
import { incidentOptions } from './run-agent.incident-fixtures';
import { runAiBuild } from './run-build';

function buildOptions(...args: Parameters<typeof incidentOptions>) {
  const { onEvent: _onEvent, ...options } = incidentOptions(...args);
  void _onEvent;
  return options;
}

const refusal = () =>
  new AiProviderError('Provider credentials were refused.', {
    code: 'http-status',
    status: 500,
    retryable: false,
  });
const scaffold: AiPlan = {
  rationale: 'Two sections.',
  commands: ['First', 'Second'].map((label) => ({
    command: 'insertNode',
    args: {
      type: 'customCode',
      parentId: 'root',
      props: { label, tree: parseTreeMarkup(`<section><h2>${label}</h2></section>`) },
    },
  })),
};

describe('terminal provider failures do not spend another build call', () => {
  it('does not fall back from refused page planning to scaffolding', async () => {
    const propose = vi.fn<AiPlanProvider['propose']>();
    const proposePagePlan = vi
      .fn<NonNullable<AiPlanProvider['proposePagePlan']>>()
      .mockRejectedValue(refusal());
    const options = buildOptions({
      request: 'Build a page',
      provider: { propose, proposePagePlan },
    });
    await expect(runAiBuild(options)).rejects.toMatchObject({
      failure: { source: 'provider', retryable: false, status: 500 },
    });
    expect(proposePagePlan).toHaveBeenCalledTimes(1);
    expect(propose).not.toHaveBeenCalled();
    expect(options.kernel.transactions()).toHaveLength(0);
  });

  it('does not fall back from a refused scaffold to another full-page call', async () => {
    const error = refusal();
    const propose = vi.fn<AiPlanProvider['propose']>().mockRejectedValue(error);
    const options = buildOptions({ request: 'Build a page', provider: { propose } });
    await expect(runAiBuild(options)).rejects.toBe(error);
    expect(propose).toHaveBeenCalledTimes(1);
  });

  it('keeps completed sections and does not retry a terminal writer failure', async () => {
    const calls: string[] = [];
    const provider: AiPlanProvider = {
      propose(_request, context) {
        const id = context.selection.ids[0];
        if (id === undefined) return Promise.resolve(scaffold);
        calls.push(id);
        if (calls.length === 1) return Promise.reject(refusal());
        return Promise.resolve({
          rationale: 'Written.',
          commands: [
            {
              command: 'setProp',
              args: {
                id,
                key: 'tree',
                value: parseTreeMarkup('<section><h2>Kept work</h2></section>'),
              },
            },
          ],
        });
      },
    };
    const options = buildOptions({ request: 'Build a page', provider });
    const result = await runAiBuild(options);
    expect(calls).toHaveLength(2);
    expect(result.tasks[0]).toMatchObject({ status: 'skipped', attempts: 1 });
    expect(result.tasks[1]?.status).toBe('applied');
    expect(JSON.stringify(options.kernel.getDocument())).toContain('Kept work');
  });
});
