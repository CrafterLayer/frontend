import { describe, expect, it } from 'vitest';

import type { AiPromptEnhanceInput, AiPromptEnhancement, AssembledAiContext } from '../types';
import { createScriptedAiPlanProvider } from './scripted-provider';

describe('scripted AI provider test helper', () => {
  it('returns the exact scripted plan regardless of request text', async () => {
    const plan = {
      rationale: 'Scripted.',
      commands: [{ command: 'setDocMeta', args: { dir: 'rtl' } }],
    } as const;
    const context = {} as AssembledAiContext;
    const provider = createScriptedAiPlanProvider(plan);
    await expect(provider.propose('anything', context)).resolves.toBe(plan);
  });
});

describe('scripted AI provider — the enhance hook', () => {
  const plan = { rationale: 'Scripted.', commands: [] } as const;
  const draft: AiPromptEnhanceInput = {
    text: 'cafe page',
    locale: 'en',
    intent: null,
    page: { empty: true, sections: [] },
    selection: null,
    answers: [],
  };
  const rewrite: AiPromptEnhancement = {
    enhanced: 'Build a landing page for a café.',
    understood: 'A café page.',
    changes: [],
    questions: [],
    language: 'en',
  };

  it('offers no enhancePrompt unless one is scripted, like the offline provider', () => {
    expect('enhancePrompt' in createScriptedAiPlanProvider(plan)).toBe(false);
  });

  it('answers a fixed rewrite, or one computed from the draft', async () => {
    const fixed = createScriptedAiPlanProvider(plan, { enhance: rewrite });
    await expect(fixed.enhancePrompt?.(draft)).resolves.toBe(rewrite);

    // "Ask until answered": a script that asks a question only while no answer has arrived.
    const asking = createScriptedAiPlanProvider(plan, {
      enhance: (input) => ({
        ...rewrite,
        questions:
          input.answers.length === 0
            ? [{ id: 'q1', text: 'Which city?', choices: ['Amman', 'Irbid'] }]
            : [],
      }),
    });
    await expect(asking.enhancePrompt?.(draft)).resolves.toMatchObject({
      questions: [{ id: 'q1' }],
    });
    await expect(
      asking.enhancePrompt?.({ ...draft, answers: [{ question: 'Which city?', answer: 'Amman' }] }),
    ).resolves.toMatchObject({ questions: [] });
  });
});
