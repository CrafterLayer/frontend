import { describe, expect, it } from 'vitest';

import type { AssembledAiContext, PagePlanCandidate } from '../types';
import { createScriptedAiPlanProvider } from './scripted-provider';

/*
  The page-plan owners (planAiPage, runAiBuild with T1) test against a scripted
  provider; the hook has to exist before they start, and must not change the
  helper for the tests that already use it.
*/

const plan = { rationale: 'Scripted.', commands: [] } as const;
const context = {} as AssembledAiContext;

describe('scripted provider — the page-plan hook', () => {
  it('offers no proposePagePlan unless one is scripted, so old callers see the old port', () => {
    expect('proposePagePlan' in createScriptedAiPlanProvider(plan)).toBe(false);
  });

  it('answers the scripted candidate verbatim', async () => {
    const candidate: PagePlanCandidate = { title: 'x' };
    const provider = createScriptedAiPlanProvider(plan, {
      pagePlan: candidate,
      rationale: 'Warm.',
    });
    await expect(provider.propose('anything', context)).resolves.toBe(plan);
    await expect(provider.proposePagePlan?.('page', context)).resolves.toEqual({
      pagePlan: candidate,
      rationale: 'Warm.',
    });
  });

  it('lets a script answer the repair round differently from the first call', async () => {
    const seen: (string | undefined)[] = [];
    const provider = createScriptedAiPlanProvider(plan, {
      pagePlan: (request, attempt) => {
        seen.push(attempt?.issues[0]?.path);
        return attempt === undefined ? { title: 'first' } : { title: `fixed ${request}` };
      },
    });
    await provider.proposePagePlan?.('page', context);
    const repaired = await provider.proposePagePlan?.('page', context, {
      attempt: {
        pagePlan: { title: 'first' },
        issues: [{ path: 'tokens', message: 'Write tokens…' }],
      },
    });
    expect(repaired?.pagePlan).toEqual({ title: 'fixed page' });
    expect(seen).toEqual([undefined, 'tokens']);
  });
});
