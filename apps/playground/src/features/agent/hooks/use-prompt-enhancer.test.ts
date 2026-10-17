/**
 * ✨ Improve's state (owner request; view-types `EnhancementView`):
 * - unavailable when the provider cannot rewrite requests (the action is hidden);
 * - enhancing → enhanced, with the person's own words kept for Restore;
 * - any edit after an Improve returns to idle, and Restore is gone;
 * - a failure is `failed` with its class, and the text is never touched;
 * - the engine's own `enhanceRequest` / `canEnhance` are adapted, and a provider that can
 *   only tidy (a server without the enhance route) turns Improve off after one try.
 */
import {
  AiProviderError,
  createLocalAiPlanProvider,
  type AiPlanProvider,
  type AiPromptEnhanceInput,
  type AiPromptEnhancement,
} from '@craftkit/builder';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { EnhanceInput } from '../model/enhance';
import { scriptedEnhancer } from '../testing/scripted-engine';
import { engineEnhancer, usePromptEnhancer } from './use-prompt-enhancer';

const provider: AiPlanProvider = createLocalAiPlanProvider();
const INPUT: EnhanceInput = { text: 'dental page amman', locale: 'en' };
const REWRITE = 'Build a one-page site for a dental clinic in Amman.';

describe('usePromptEnhancer', () => {
  it('is unavailable, and hides Improve, when nothing can enhance for this provider', () => {
    // The offline provider has no `enhancePrompt`: the engine's `canEnhance` says no.
    const { result } = renderHook(() => usePromptEnhancer({ provider, enhancer: undefined }));
    expect(result.current.available).toBe(false);
    expect(result.current.view).toEqual({ status: 'unavailable' });
    const off = renderHook(() => usePromptEnhancer({ provider, enhancer: null }));
    expect(off.result.current.view.status).toBe('unavailable');
  });

  it('rewrites, keeps the person’s words for Restore, and forgets them once they type', async () => {
    const enhancer = scriptedEnhancer(() => ({
      enhanced: REWRITE,
      understood: 'A dental clinic page in Amman',
      changes: ['Named what the page shows'],
    }));
    const { result } = renderHook(() => usePromptEnhancer({ provider, enhancer }));
    expect(result.current.view).toEqual({ status: 'idle' });

    let rewritten: string | null = null;
    let pending: Promise<string | null> = Promise.resolve(null);
    act(() => {
      pending = result.current.improve(INPUT);
    });
    expect(result.current.view.status).toBe('enhancing');
    await act(async () => {
      rewritten = await pending;
    });
    expect(rewritten).toBe(REWRITE);
    expect(result.current.view).toEqual({
      status: 'enhanced',
      understood: 'A dental clinic page in Amman',
      changes: ['Named what the page shows'],
      canRestore: true,
    });

    // Still the rewrite, word for word: nothing to forget.
    act(() => {
      result.current.edited(REWRITE);
    });
    expect(result.current.view.status).toBe('enhanced');

    let restored: string | null = null;
    act(() => {
      restored = result.current.restore();
    });
    expect(restored).toBe('dental page amman');
    expect(result.current.view).toEqual({ status: 'idle' });

    await act(async () => {
      await result.current.improve(INPUT);
    });
    act(() => {
      result.current.edited(`${REWRITE} With prices.`);
    });
    expect(result.current.view).toEqual({ status: 'idle' });
    act(() => {
      restored = result.current.restore();
    });
    expect(restored).toBeNull();
  });

  it('fails without touching the text, and the note goes once the person types', async () => {
    const enhancer = scriptedEnhancer(() => new Error('The assistant server could not be reached.'));
    const { result } = renderHook(() => usePromptEnhancer({ provider, enhancer }));
    let rewritten: string | null = 'unchanged';
    await act(async () => {
      rewritten = await result.current.improve(INPUT);
    });
    expect(rewritten).toBeNull();
    expect(result.current.view).toEqual({ status: 'failed', reason: 'unreachable' });
    act(() => {
      result.current.edited('dental page amman, again');
    });
    expect(result.current.view).toEqual({ status: 'idle' });
  });

  it('reads an empty rewrite as a failure, never as an empty draft', async () => {
    const enhancer = scriptedEnhancer(() => ({ enhanced: '   ' }));
    const { result } = renderHook(() => usePromptEnhancer({ provider, enhancer }));
    let rewritten: string | null = 'unchanged';
    await act(async () => {
      rewritten = await result.current.improve(INPUT);
    });
    expect(rewritten).toBeNull();
    expect(result.current.view.status).toBe('failed');
  });

  it('shows the check as enhancing while a sent request is read, then idle again', async () => {
    const enhancer = scriptedEnhancer(() => ({ questions: [{ id: 'q', text: 'Which?', choices: ['A'] }] }));
    const { result } = renderHook(() => usePromptEnhancer({ provider, enhancer }));
    let questions = 0;
    let pending: Promise<{ readonly questions: readonly unknown[] }> = Promise.resolve({ questions: [] });
    act(() => {
      pending = result.current.ask(INPUT, { busy: true });
    });
    expect(result.current.view.status).toBe('enhancing');
    await act(async () => {
      questions = (await pending).questions.length;
    });
    expect(questions).toBe(1);
    await waitFor(() => {
      expect(result.current.view.status).toBe('idle');
    });
  });
});

/** A provider whose `enhancePrompt` answers from a script, recording what it was sent. */
function enhancingProvider(
  answer: (input: AiPromptEnhanceInput) => Partial<AiPromptEnhancement> | Error,
): AiPlanProvider & { readonly seen: AiPromptEnhanceInput[] } {
  const local = createLocalAiPlanProvider();
  const seen: AiPromptEnhanceInput[] = [];
  return {
    seen,
    propose: (request, context, options) => local.propose(request, context, options),
    enhancePrompt: (input) => {
      seen.push(input);
      const result = answer(input);
      return result instanceof Error ? Promise.reject(result) : Promise.resolve(result as AiPromptEnhancement);
    },
  };
}

describe('engineEnhancer', () => {
  it('sends the engine its own request shape and reads the answer defensively', async () => {
    const remote = enhancingProvider(() => ({
      enhanced: REWRITE,
      understood: 'ok',
      changes: ['a', 'a', ''],
      questions: [
        { id: 'q1', text: 'Which city?', choices: ['Amman', 'Irbid'] },
        { id: 'q1', text: 'A duplicate id', choices: ['x'] },
        { id: 'q3', text: 'No choices', choices: [] },
      ],
      language: 'en',
    }));
    const port = engineEnhancer(remote);
    expect(port).not.toBeNull();
    const result = await port?.enhance({
      ...INPUT,
      intent: 'build-page',
      confidence: 0.6,
      page: { nodeCount: 0, placeholderOnly: false, sectionLabels: [] },
      selection: ['Hero', 'Pricing'],
      answers: [{ id: 'q1', question: 'Which city?', answer: 'Amman' }],
    });
    expect(remote.seen[0]).toEqual({
      text: 'dental page amman',
      locale: 'en',
      intent: { kind: 'build-page', confidence: 0.6 },
      page: { empty: true, sections: [] },
      selection: 'Hero, Pricing',
      answers: [{ question: 'Which city?', answer: 'Amman' }],
    });
    expect(result?.source).toBe('model');
    expect(result?.changes).toEqual(['a']);
    expect(result?.questions.map((question) => question.id)).toEqual(['q1', 'q2']);
  });

  it('says no for a provider that cannot rewrite requests', () => {
    expect(engineEnhancer(provider)).toBeNull();
  });
});

describe('usePromptEnhancer over the engine', () => {
  it('turns Improve off after a tidy that changed nothing: the server cannot rewrite', async () => {
    // A server without the enhance route answers 404; the engine then only tidies.
    const noRoute = enhancingProvider(
      () => new AiProviderError('Endpoint not found.', { code: 'http-status', status: 404, retryable: false }),
    );
    const { result } = renderHook(() => usePromptEnhancer({ provider: noRoute }));
    expect(result.current.available).toBe(true);
    let rewritten: string | null = 'unchanged';
    await act(async () => {
      rewritten = await result.current.improve({ text: 'Build a page for my shop.', locale: 'en' });
    });
    expect(rewritten).toBeNull();
    expect(result.current.available).toBe(false);
    expect(result.current.view).toEqual({ status: 'unavailable' });
  });

  it('says the rewrite failed, and keeps the action, when the server itself failed', async () => {
    const down = enhancingProvider(
      () => new AiProviderError('Bad gateway.', { code: 'http-status', status: 502, retryable: true }),
    );
    const { result } = renderHook(() => usePromptEnhancer({ provider: down }));
    let rewritten: string | null = 'unchanged';
    await act(async () => {
      rewritten = await result.current.improve({ text: 'Build a page for my shop.', locale: 'en' });
    });
    expect(rewritten).toBeNull();
    // Never "the model didn't respond": the route's 502 is often a model that answered badly.
    expect(result.current.view).toEqual({ status: 'failed', reason: 'invalid' });
    expect(result.current.available).toBe(true);
  });

  it('keeps the other statuses in their own words', async () => {
    const busy = enhancingProvider(
      () => new AiProviderError('Overloaded.', { code: 'http-status', status: 503, retryable: true }),
    );
    const { result } = renderHook(() => usePromptEnhancer({ provider: busy }));
    await act(async () => {
      await result.current.improve({ text: 'Build a page for my shop.', locale: 'en' });
    });
    expect(result.current.view).toEqual({ status: 'failed', reason: 'busy' });
  });

  it('shows a tidy that fixed something, with its own notes', async () => {
    const { result } = renderHook(() =>
      usePromptEnhancer({
        provider,
        enhancer: {
          enhance: () =>
            Promise.resolve({
              enhanced: 'اربط هذه الصفحة',
              understood: '',
              changes: ['ضبط المسافات'],
              questions: [],
              source: 'tidy',
            }),
        },
      }),
    );
    let rewritten: string | null = null;
    await act(async () => {
      rewritten = await result.current.improve({ text: 'اربط  هذه الصفحه', locale: 'ar' });
    });
    expect(rewritten).toBe('اربط هذه الصفحة');
    expect(result.current.view).toEqual({
      status: 'enhanced',
      understood: '',
      changes: ['ضبط المسافات'],
      canRestore: true,
    });
    expect(result.current.available).toBe(true);
  });
});
