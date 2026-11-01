import { describe, expect, it } from 'vitest';

import { AiProviderError } from '../provider/errors';
import { parseTreeMarkup } from '../plan/tree-markup';
import type { AiPlan, AiPlanProvider } from '../types';
import { incidentOptions } from './run-agent.incident-fixtures';
import { runAiBuild } from './run-build';

/*
  The AI server dies mid-build (P6, 2026-11-01). A network failure is not
  terminal, so before this every remaining section tried twice against a dead
  server and ended `skipped` — "failed" — and the person was offered "write the
  failed sections again" for a page that was never written. After three
  sections in a row could not reach the server, the build starts nothing more:
  the rest stay not written (as after a Stop or a spent budget), so "Finish the
  rest" picks them up once the server is back.
*/

const LABELS = ['One', 'Two', 'Three', 'Four', 'Five', 'Six'] as const;

function buildOptions(...args: Parameters<typeof incidentOptions>) {
  const { onEvent: _onEvent, ...options } = incidentOptions(...args);
  void _onEvent;
  return options;
}

const scaffold: AiPlan = {
  rationale: 'Six sections.',
  commands: LABELS.map((label) => ({
    command: 'insertNode',
    args: {
      type: 'customCode',
      parentId: 'root',
      props: { label, tree: parseTreeMarkup(`<section><h2>${label}</h2></section>`) },
    },
  })),
};

const unreachable = () =>
  new AiProviderError('The assistant server could not be reached: Failed to fetch', {
    code: 'network',
    retryable: true,
  });

/** Fills answer in order of asking: `true` writes the section, `false` cannot reach the server. */
function scripted(reaches: (call: number) => boolean) {
  const calls: string[] = [];
  const provider: AiPlanProvider = {
    propose(_request, context) {
      const id = context.selection.ids[0];
      if (id === undefined) return Promise.resolve(scaffold);
      calls.push(id);
      if (!reaches(calls.length)) return Promise.reject(unreachable());
      return Promise.resolve({
        rationale: 'Written.',
        commands: [
          {
            command: 'setProp',
            args: {
              id,
              key: 'tree',
              value: parseTreeMarkup('<section><h2>Written</h2></section>'),
            },
          },
        ],
      });
    },
  };
  return { provider, calls };
}

describe('a build whose AI server cannot be reached stops starting sections (P6)', () => {
  it('leaves the rest not written after three sections in a row could not reach the server', async () => {
    const script = scripted(() => false);
    const result = await runAiBuild({
      ...buildOptions({ request: 'Build a page', provider: script.provider }),
      fillConcurrency: 1,
    });

    expect(result.tasks.map(({ status }) => status)).toEqual([
      'skipped',
      'skipped',
      'skipped',
      'not-started',
      'not-started',
      'not-started',
    ]);
    expect(result.tasks.slice(0, 3).map(({ reasonCode }) => reasonCode)).toEqual([
      'unreachable',
      'unreachable',
      'unreachable',
    ]);
    // Never begun, as after a spent budget: the same code, its own sentence.
    for (const task of result.tasks.slice(3)) {
      expect(task).toMatchObject({ reasonCode: 'budget', attempts: 0 });
      expect(task.reason).toMatch(/could not be reached/u);
    }
    // Three sections, two attempts each: nothing more was asked of a dead server.
    expect(script.calls).toHaveLength(6);
    expect(result.outcome).toBe('completed');
  });

  it('counts only failures in a row: a section written in between starts the count again', async () => {
    // Calls: 1-2 One fails, 3 Two lands, 4-9 Three, Four, Five fail, then Six is not started.
    const script = scripted((call) => call === 3);
    const result = await runAiBuild({
      ...buildOptions({ request: 'Build a page', provider: script.provider }),
      fillConcurrency: 1,
    });

    expect(result.tasks.map(({ status }) => status)).toEqual([
      'skipped',
      'applied',
      'skipped',
      'skipped',
      'skipped',
      'not-started',
    ]);
    expect(script.calls).toHaveLength(9);
  });

  it('lets the sections already writing finish when the count is reached', async () => {
    // Three writers: a section begun before the third failure still ends as its own
    // write ends (skipped, both attempts); nothing begins after it.
    const script = scripted(() => false);
    const result = await runAiBuild({
      ...buildOptions({ request: 'Build a page', provider: script.provider }),
      fillConcurrency: 3,
    });

    const skipped = result.tasks.filter(({ status }) => status === 'skipped');
    const notStarted = result.tasks.filter(({ status }) => status === 'not-started');
    expect(skipped.length).toBeGreaterThanOrEqual(3);
    expect(skipped.length).toBeLessThanOrEqual(5);
    expect(notStarted.length).toBe(LABELS.length - skipped.length);
    expect(skipped.every(({ attempts }) => attempts === 2)).toBe(true);
    expect(script.calls).toHaveLength(skipped.length * 2);
  });
});
