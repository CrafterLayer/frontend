import { describe, expect, it, vi } from 'vitest';

import * as root from '../index';
import { AiProviderError } from '../provider/errors';
import { AiTaskUnsupportedError, createRemoteAiPlanProvider } from '../provider/remote-provider';
import { createScriptedAiPlanProvider } from '../testing/scripted-provider';
import type {
  AiPlan,
  AiPlanProvider,
  AiPromptEnhanceInput,
  AiPromptEnhancement,
} from '../types';
import { canEnhance, enhanceRequest } from './enhance-request';

/*
  The ✨ Improve action's engine (owner request, 2026-09-28): a model rewrite
  when the provider can make one, the deterministic tidy when it cannot — and
  never a silent wrong answer in between.
*/

const plan: AiPlan = { rationale: 'Scripted.', commands: [] };

function draft(overrides: Partial<AiPromptEnhanceInput> = {}): AiPromptEnhanceInput {
  return {
    text: 'هل يمكنك تربط ال صفحه هاي داخل عليها',
    locale: 'ar',
    intent: { kind: 'edit', confidence: 0.4 },
    page: { empty: false, sections: ['Hero', 'Menu'] },
    selection: null,
    answers: [],
    ...overrides,
  };
}

const REWRITE: AiPromptEnhancement = {
  enhanced: 'اربط زر قسم البطل بقسم القائمة في الصفحة نفسها.',
  understood: 'ربط الزر بقسم في الصفحة.',
  changes: ['صححت «ال صفحه» إلى «الصفحة»'],
  questions: [],
  language: 'ar',
};

function enhancing(answer: () => Promise<AiPromptEnhancement>) {
  const enhancePrompt = vi.fn<NonNullable<AiPlanProvider['enhancePrompt']>>(answer);
  const provider: AiPlanProvider = { propose: () => Promise.resolve(plan), enhancePrompt };
  return { provider, enhancePrompt };
}

describe('canEnhance', () => {
  it('is true only for a provider that can rewrite with a model', () => {
    expect(canEnhance(undefined)).toBe(false);
    expect(canEnhance(createScriptedAiPlanProvider(plan))).toBe(false);
    expect(canEnhance(createScriptedAiPlanProvider(plan, { enhance: REWRITE }))).toBe(true);
    expect(canEnhance(createRemoteAiPlanProvider({ endpoint: 'https://a.example.test/plan' }))).toBe(
      true,
    );
  });
});

describe('enhanceRequest', () => {
  it('tidies when there is no provider to ask: no understanding claimed, nothing asked', async () => {
    await expect(enhanceRequest(draft())).resolves.toEqual({
      enhanced: 'هل يمكنك تربط الصفحة هاي داخل عليها',
      understood: '',
      changes: ['وصل «ال» بالكلمة التي بعدها', 'تصحيح نهايات الكلمات (ة بدل ه)'],
      questions: [],
      language: 'ar',
      source: 'tidy',
    });
  });

  it('writes the tidy notes in the UI locale, and the language from the draft itself', async () => {
    const result = await enhanceRequest(draft({ locale: 'en' }), {
      provider: createScriptedAiPlanProvider(plan),
    });
    expect(result.changes).toEqual([
      'Joined the Arabic article «ال» to its word',
      'Fixed word endings (ة for ه)',
    ]);
    expect(result.language).toBe('ar');
  });

  it('keeps every answer in a tidy — appended one per line — rather than losing it', async () => {
    const result = await enhanceRequest(
      draft({
        text: 'اعمل صفحه',
        answers: [
          { question: 'ما نوع النشاط؟', answer: ' مقهى ' },
          { question: 'أين؟', answer: '  ' },
        ],
      }),
    );
    expect(result.enhanced).toBe('اعمل صفحة\nما نوع النشاط؟ مقهى');
    expect(result.changes).toContain('إضافة إجاباتك إلى الطلب');
  });

  it('asks the model when the provider can rewrite, and marks the answer as the model’s', async () => {
    const { provider, enhancePrompt } = enhancing(() => Promise.resolve(REWRITE));
    const signal = new AbortController().signal;

    await expect(enhanceRequest(draft(), { provider, signal })).resolves.toEqual({
      ...REWRITE,
      source: 'model',
    });
    expect(enhancePrompt).toHaveBeenCalledExactlyOnceWith(draft(), { signal });
  });

  it('holds a provider’s answer to the contract’s limits', async () => {
    const { provider } = enhancing(() =>
      Promise.resolve({
        ...REWRITE,
        changes: ['1', '2', '3', '4', '5', '6', '7'],
        questions: [
          { id: 'a', text: 'One?', choices: ['x', 'y'] },
          { id: 'b', text: 'Two?', choices: ['x', 'y'] },
          { id: 'c', text: 'Three?', choices: ['x', 'y'] },
          { id: 'd', text: 'Four?', choices: ['x', 'y'] },
        ],
      }),
    );
    const result = await enhanceRequest(draft(), { provider });
    expect(result.changes).toHaveLength(5);
    expect(result.questions.map(({ id }) => id)).toEqual(['a', 'b', 'c']);
  });

  it('sends nothing for an empty draft', async () => {
    const { provider, enhancePrompt } = enhancing(() => Promise.resolve(REWRITE));
    await expect(enhanceRequest(draft({ text: '   ' }), { provider })).resolves.toMatchObject({
      enhanced: '',
      source: 'tidy',
    });
    expect(enhancePrompt).not.toHaveBeenCalled();
  });

  it.each([
    ['a 404 (a server without the route)', 404],
    ['a 405', 405],
    ['a 501', 501],
  ])('tidies instead after %s', async (_label, status) => {
    const { provider } = enhancing(() =>
      Promise.reject(
        new AiProviderError(`The assistant server answered with status ${String(status)}.`, {
          code: 'http-status',
          retryable: false,
          status,
        }),
      ),
    );
    await expect(enhanceRequest(draft(), { provider })).resolves.toMatchObject({ source: 'tidy' });
  });

  it('tidies instead when the server predates the enhancer, or the model wrote no rewrite', async () => {
    const old = enhancing(() =>
      Promise.reject(new AiTaskUnsupportedError('prompt-enhance', 'does not rewrite requests')),
    );
    await expect(enhanceRequest(draft(), { provider: old.provider })).resolves.toMatchObject({
      source: 'tidy',
    });

    const empty = enhancing(() => Promise.resolve({ ...REWRITE, enhanced: '  ' }));
    await expect(enhanceRequest(draft(), { provider: empty.provider })).resolves.toMatchObject({
      source: 'tidy',
    });
  });

  it('fails loudly on any other failure, so the panel can say the rewrite did not happen', async () => {
    const outage = new AiProviderError('The assistant server answered with status 503.', {
      code: 'http-status',
      retryable: true,
      status: 503,
    });
    const { provider } = enhancing(() => Promise.reject(outage));
    await expect(enhanceRequest(draft(), { provider })).rejects.toBe(outage);

    const slow = enhancing(() =>
      Promise.reject(new AiProviderError('timed out', { code: 'timeout', retryable: true })),
    );
    await expect(enhanceRequest(draft(), { provider: slow.provider })).rejects.toMatchObject({
      code: 'timeout',
    });
  });

  it('rejects with the AbortError when stopped — before asking, and after a late answer', async () => {
    const { provider, enhancePrompt } = enhancing(() => Promise.resolve(REWRITE));
    await expect(
      enhanceRequest(draft(), { provider, signal: AbortSignal.abort() }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(enhancePrompt).not.toHaveBeenCalled();

    const controller = new AbortController();
    const late = enhancing(() => {
      controller.abort();
      return Promise.resolve(REWRITE);
    });
    await expect(
      enhanceRequest(draft(), { provider: late.provider, signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('works end to end over the remote wire: a rewrite from the route, a tidy from an old server', async () => {
    const answering = createRemoteAiPlanProvider({
      endpoint: 'https://assistant.example.test/plan',
      fetch: () =>
        Promise.resolve(
          new Response(JSON.stringify({ version: 1, ...REWRITE }), {
            headers: { 'content-type': 'application/json' },
          }),
        ),
    });
    await expect(enhanceRequest(draft(), { provider: answering })).resolves.toEqual({
      ...REWRITE,
      source: 'model',
    });

    const old = createRemoteAiPlanProvider({
      endpoint: 'https://assistant.example.test/plan',
      fetch: () =>
        Promise.resolve(
          new Response(JSON.stringify({ error: 'Endpoint not found.' }), { status: 404 }),
        ),
    });
    await expect(enhanceRequest(draft(), { provider: old })).resolves.toMatchObject({
      enhanced: 'هل يمكنك تربط الصفحة هاي داخل عليها',
      source: 'tidy',
    });
  });

  it('is exported from the package root, with canEnhance and the tidy', () => {
    expect(root.enhanceRequest).toBe(enhanceRequest);
    expect(root.canEnhance).toBe(canEnhance);
    expect(root.tidyRequestText('ال صفحه')).toBe('الصفحة');
  });
});
