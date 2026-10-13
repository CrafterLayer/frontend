import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { Turn } from './AssistantPanel.turns';
import { useAssistantSessions } from './use-assistant-sessions';

const KEY = 'use-assistant-sessions.test';

afterEach(() => {
  window.localStorage.removeItem(KEY);
});

const reply = (id: string): Turn => ({ id, from: 'assistant', kind: 'discarded' });

describe('useAssistantSessions', () => {
  it('starts with one empty "New chat" in the host default mode', () => {
    const { result } = renderHook(() => useAssistantSessions(undefined, 'auto'));
    expect(result.current.sessions).toEqual([{ id: 'session-1', title: 'New chat', turns: [] }]);
    expect(result.current.activeId).toBe('session-1');
    expect(result.current.panelMode).toBe('auto');
    expect(result.current.turns).toEqual([]);
  });

  it('opens a turn in ONE update: the first request names the conversation', () => {
    const { result } = renderHook(() => useAssistantSessions(undefined, 'ask'));
    act(() => {
      result.current.openTurn('add a pricing section please, today', 'turn-1', reply('turn-2'));
    });
    expect(result.current.active?.title).toBe('add a pricing section please, to');
    expect(result.current.turns.map((turn) => turn.id)).toEqual(['turn-1', 'turn-2']);
    act(() => {
      result.current.openTurn('and a hero', 'turn-3', reply('turn-4'));
    });
    expect(result.current.active?.title).toBe('add a pricing section please, to');
  });

  it('patches only the ACTIVE conversation', () => {
    const { result } = renderHook(() => useAssistantSessions(undefined, 'ask'));
    act(() => {
      result.current.setSessions((previous) => [
        ...previous,
        { id: 'session-2', title: 'Other', turns: [reply('other-1')] },
      ]);
    });
    act(() => {
      result.current.patchTurns(() => [reply('patched')]);
    });
    expect(result.current.sessions.find((session) => session.id === 'session-2')?.turns).toEqual([
      reply('other-1'),
    ]);
    expect(result.current.turns).toEqual([reply('patched')]);
  });

  it('persists under persistKey and revives conversations, the active one and a CHOSEN mode', () => {
    const first = renderHook(() => useAssistantSessions(KEY, 'ask'));
    let asked = '';
    act(() => {
      asked = first.result.current.nextId('turn');
      first.result.current.openTurn('hello', asked, reply('turn-x'));
      first.result.current.chooseMode('plan');
    });
    first.unmount();

    const revived = renderHook(() => useAssistantSessions(KEY, 'auto'));
    expect(revived.result.current.panelMode).toBe('plan');
    expect(revived.result.current.active?.title).toBe('hello');
    expect(revived.result.current.turns.map((turn) => turn.id)).toEqual([asked, 'turn-x']);
    // Ids continue after the revived ones: a new turn never repeats a saved key.
    const next = revived.result.current.nextId('turn');
    expect(next).not.toBe(asked);
    expect(Number(next.split('-')[1])).toBeGreaterThan(Number(asked.split('-')[1]));
  });

  it('a mode that was never CHOSEN reads as the host default after a reload', () => {
    const first = renderHook(() => useAssistantSessions(KEY, 'plan'));
    first.unmount();
    const revived = renderHook(() => useAssistantSessions(KEY, 'auto'));
    expect(revived.result.current.panelMode).toBe('auto');
  });
});
