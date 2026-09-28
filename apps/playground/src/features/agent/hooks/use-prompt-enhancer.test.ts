/**
 * ✨ Improve's state (owner request; view-types `EnhancementView`):
 * - unavailable when the provider cannot rewrite requests (the action is hidden);
 * - enhancing → enhanced, with the person's own words kept for Restore;
 * - any edit after an Improve returns to idle, and Restore is gone;
 * - a failure is `failed` with its class, and the text is never touched;
 * - the engine's own `enhanceRequest` / `canEnhance` are adapted when they are exported.
 */
import { createLocalAiPlanProvider, type AiPlanProvider } from '@craftkit/builder';
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
    const { result } = renderHook(() =>
      usePromptEnhancer({ provider, enhancer: undefined, engine: {} }),
    );
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
    await act(async () => {
      const pending = result.current.improve(INPUT);
      expect(result.current.view.status).toBe('enhancing');
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
    await act(async () => {
      const pending = result.current.ask(INPUT, { busy: true });
      expect(result.current.view.status).toBe('enhancing');
      questions = (await pending).questions.length;
    });
    expect(questions).toBe(1);
    await waitFor(() => {
      expect(result.current.view.status).toBe('idle');
    });
  });
});

describe('engineEnhancer', () => {
  it('adapts the engine’s functions, and says no when canEnhance does', async () => {
    const seen: unknown[] = [];
    const engine = {
      canEnhance: () => true,
      enhanceRequest: (options: Readonly<Record<string, unknown>>) => {
        seen.push(options);
        return Promise.resolve({
          enhanced: REWRITE,
          understood: 'ok',
          changes: ['a', 'a', ''],
          questions: [
            { id: 'q1', text: 'Which city?', choices: ['Amman', 'Irbid'] },
            { id: 'q1', text: 'A duplicate id', choices: ['x'] },
            { id: 'q3', text: 'No choices', choices: [] },
          ],
        });
      },
    };
    const port = engineEnhancer(provider, engine);
    expect(port).not.toBeNull();
    const result = await port?.enhance({ ...INPUT, intent: 'build-page' });
    expect(seen[0]).toMatchObject({ provider, text: 'dental page amman', locale: 'en', intent: 'build-page' });
    expect(result?.changes).toEqual(['a']);
    expect(result?.questions.map((question) => question.id)).toEqual(['q1', 'q2']);

    expect(engineEnhancer(provider, { ...engine, canEnhance: () => false })).toBeNull();
    expect(engineEnhancer(provider, {})).toBeNull();
  });
});
