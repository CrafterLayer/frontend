/**
 * Conversations and their storage (SPEC §7.4 `hooks/use-agent-sessions.ts`):
 * - v2 round-trip: what one mount writes, the next mount reads back;
 * - v1 migration: a first load with only `pg-assistant-sessions-v1` migrates it ONCE,
 *   writes it under `pg-agent-sessions-v2`, and never writes the v1 key;
 * - runtime authority (a proposal's `AiValidatedProposal`) never reaches storage;
 * - a chosen mode outlives the host default; New reuses an empty conversation; Delete
 *   hands the current place to the next row, or to a new empty conversation.
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import fixtures from '../testing/v1-sessions.json';
import { SESSIONS_KEY, type Turn } from '../model/turns';
import { V1_SESSIONS_KEY } from '../model/migrate-sessions';
import { memoryStorage } from '../testing/scripted-engine';
import { useAgentSessions, type UseAgentSessionsOptions } from './use-agent-sessions';

const NOW = Date.UTC(2026, 8, 28, 9, 0, 0);

function mount(options: UseAgentSessionsOptions) {
  return renderHook(() => useAgentSessions({ now: () => NOW, ...options }));
}

const you = (id: string, text: string): Turn => ({ id, kind: 'user', text, context: [{ kind: 'page' }] });

describe('useAgentSessions', () => {
  it('starts one empty conversation in the host default mode when nothing is stored', () => {
    const storage = memoryStorage();
    const { result } = mount({ storage, defaultMode: 'ask' });
    expect(result.current.source).toBe('none');
    expect(result.current.state.sessions).toEqual([
      { id: 'session-1', title: '', turns: [], updatedAt: null },
    ]);
    expect(result.current.state.mode).toBe('ask');
    expect(result.current.summaries).toEqual([
      { id: 'session-1', title: '', updatedAt: null, current: true },
    ]);
  });

  it('round-trips the conversation through the v2 key, titled by its first request', () => {
    const storage = memoryStorage();
    const first = mount({ storage });
    act(() => {
      first.result.current.updateTurns('session-1', (turns) => [
        ...turns,
        you('turn-2', 'A dental clinic page'),
      ]);
    });
    act(() => {
      first.result.current.chooseMode('plan');
    });
    first.unmount();

    const saved = JSON.parse(storage.data.get(SESSIONS_KEY) ?? '{}') as { version?: number };
    expect(saved.version).toBe(2);

    const second = mount({ storage, defaultMode: 'auto' });
    expect(second.result.current.source).toBe('v2');
    expect(second.result.current.active.title).toBe('A dental clinic page');
    expect(second.result.current.active.updatedAt).toBe(NOW);
    expect(second.result.current.active.turns).toEqual([you('turn-2', 'A dental clinic page')]);
    // A chosen mode outlives the host default.
    expect(second.result.current.state.mode).toBe('plan');
    // Ids continue after every saved one: a new turn never repeats a saved key.
    expect(second.result.current.nextId('turn')).toBe('turn-3');
  });

  it('migrates v1 storage once, writes only v2, and leaves v1 exactly as it was', () => {
    const v1 = JSON.stringify(fixtures.everyKind);
    const storage = memoryStorage({ [V1_SESSIONS_KEY]: v1 });

    const first = mount({ storage });
    expect(first.result.current.source).toBe('v1');
    expect(first.result.current.state.sessions.length).toBeGreaterThan(0);
    first.unmount();

    expect(storage.writes.every(([key]) => key === SESSIONS_KEY)).toBe(true);
    expect(storage.data.get(V1_SESSIONS_KEY)).toBe(v1);

    // The next load reads v2: the migration never runs twice.
    const second = mount({ storage });
    expect(second.result.current.source).toBe('v2');
    expect(second.result.current.state.sessions.map((session) => session.id)).toEqual(
      first.result.current.state.sessions.map((session) => session.id),
    );
  });

  it('never writes a proposal’s authority or an Ask plan’s held build to storage', () => {
    const storage = memoryStorage();
    const { result } = mount({ storage });
    const authority = { plan: { rationale: 'x', commands: [] }, secret: 'authority' };
    act(() => {
      result.current.updateTurns('session-1', () => [
        you('turn-2', 'rename the heading'),
        {
          id: 'turn-3',
          kind: 'proposal',
          status: 'ready',
          changes: [],
          proposal: authority as never,
        },
      ]);
    });
    const saved = storage.data.get(SESSIONS_KEY) ?? '';
    expect(saved).toContain('"kind":"proposal"');
    expect(saved).not.toContain('authority');
    // In memory, the live proposal is still there: only storage leaves it out.
    const live = result.current.active.turns[1];
    expect(live?.kind === 'proposal' ? live.proposal : undefined).toBe(authority);
  });

  it('opens a new conversation only when the current one has turns', () => {
    const { result } = mount({ storage: null });
    act(() => {
      result.current.newConversation();
    });
    expect(result.current.state.sessions).toHaveLength(1);
    act(() => {
      result.current.updateTurns('session-1', () => [you('turn-2', 'first')]);
    });
    let id = '';
    act(() => {
      id = result.current.newConversation();
    });
    expect(result.current.state.sessions).toHaveLength(2);
    expect(result.current.state.activeId).toBe(id);
    act(() => {
      result.current.openConversation('session-1');
    });
    expect(result.current.active.title).toBe('first');
  });

  it('hands the current place to the next row on Delete, and never leaves none', () => {
    const { result } = mount({ storage: null });
    act(() => {
      result.current.updateTurns('session-1', () => [you('turn-2', 'first')]);
    });
    let second = '';
    act(() => {
      second = result.current.newConversation();
    });
    act(() => {
      result.current.updateTurns(second, () => [you('turn-9', 'second')]);
    });
    act(() => {
      result.current.openConversation('session-1');
    });
    act(() => {
      result.current.deleteConversation('session-1');
    });
    expect(result.current.state.activeId).toBe(second);
    act(() => {
      result.current.deleteConversation(second);
    });
    expect(result.current.state.sessions).toHaveLength(1);
    expect(result.current.active.turns).toEqual([]);
  });

  it('keeps working when storage is blocked: it only forgets on reload', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const { result } = mount({ storage: blocked });
    act(() => {
      result.current.updateTurns('session-1', () => [you('turn-2', 'still here')]);
    });
    expect(result.current.active.title).toBe('still here');
  });
});
