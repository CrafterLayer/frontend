/**
 * The fake controller the component owners build stories and tests on: every scenario is
 * a coherent view in both locales, the static controller records every call and changes
 * nothing, and the live one moves the state the way the real controller does for what a
 * story can show on its own.
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { isAwaitingDecision, TURN_KINDS } from '../model/view-types';
import {
  FAKE_NOW,
  FAKE_SCENARIOS,
  createFakeController,
  fakeViewState,
  useFakeController,
} from './fake-controller';

describe('fakeViewState', () => {
  it.each(['ar', 'en'] as const)('builds every scenario in %s', (locale) => {
    for (const scenario of FAKE_SCENARIOS) {
      const state = fakeViewState(scenario, locale);
      expect(state.locale).toBe(locale);
      // The RunBar exists only while a run is live, and its clock is measured to `now`.
      if (state.run !== null) expect(state.run.startedAt).toBeLessThanOrEqual(FAKE_NOW);
      // Suggestions hide while running, while the box has text and while a decision waits.
      if (state.run !== null || state.draft.trim() !== '' || state.turns.some(isAwaitingDecision)) {
        expect(state.suggestions).toEqual([]);
      }
    }
  });

  it('draws every v2 turn kind somewhere', () => {
    const kinds = new Set(
      FAKE_SCENARIOS.flatMap((scenario) => fakeViewState(scenario, 'en').turns.map((turn) => turn.kind)),
    );
    expect([...kinds].sort()).toEqual([...TURN_KINDS].sort());
  });

  it('keeps ink honest: a count is landed rows only', () => {
    for (const scenario of FAKE_SCENARIOS) {
      for (const turn of fakeViewState(scenario, 'en').turns) {
        if (turn.kind !== 'build') continue;
        expect(turn.view.landed).toBe(turn.view.rows.filter((row) => row.state === 'landed').length);
      }
    }
  });

  it('measures a live RunBar to the time it is given', () => {
    const now = FAKE_NOW + 60_000;
    expect(fakeViewState('building', 'ar', { now }).run?.startedAt).toBe(now - 72_000);
  });
});

describe('createFakeController', () => {
  it('records every call and changes nothing', () => {
    const state = fakeViewState('builtPartial', 'en');
    const controller = createFakeController(state);
    controller.retrySections('turn-2', ['section-5']);
    controller.reveal('section-5');
    expect(controller.calls).toEqual([
      { action: 'retrySections', args: ['turn-2', ['section-5']] },
      { action: 'reveal', args: ['section-5'] },
    ]);
    expect(controller.state).toBe(state);
  });
});

describe('useFakeController', () => {
  it('types, improves and restores like the real controller', async () => {
    const { result } = renderHook(() => useFakeController('empty', { locale: 'en', enhanceDelayMs: 0 }));
    act(() => {
      result.current.setDraft('dental page');
    });
    expect(result.current.state.send).toBe('idle-ready');
    act(() => {
      result.current.enhanceDraft();
    });
    expect(result.current.state.enhancement.status).toBe('enhancing');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    expect(result.current.state.enhancement.status).toBe('enhanced');
    act(() => {
      result.current.restoreDraft();
    });
    expect(result.current.state.draft).toBe('dental page');
  });

  it('answers the clarifying questions, then rewrites', () => {
    const { result } = renderHook(() => useFakeController('clarifyAsking', { locale: 'ar' }));
    const questions = result.current.state.clarify?.questions ?? [];
    for (const question of questions) {
      act(() => {
        result.current.answerClarify(question.id, question.choices[0] ?? '');
      });
    }
    expect(result.current.state.clarify?.status).toBe('rewriting');
  });

  it('applies a proposal into an edit record, and discards a plan into an ending', () => {
    const proposal = renderHook(() => useFakeController('proposal', { locale: 'en' }));
    act(() => {
      proposal.result.current.apply('turn-2');
    });
    expect(proposal.result.current.state.turns.at(-1)?.kind).toBe('edit');

    const plan = renderHook(() => useFakeController('planReady', { locale: 'en' }));
    act(() => {
      plan.result.current.discard('turn-2');
    });
    expect(plan.result.current.state.turns.at(-1)).toEqual({
      kind: 'end',
      view: { turnId: 'turn-2', key: 'planDiscarded' },
    });
  });
});
