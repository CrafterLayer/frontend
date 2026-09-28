/**
 * The conversations and their storage (SPEC §7.4 `hooks/use-agent-sessions.ts`, §4.18).
 *
 * - Storage is `pg-agent-sessions-v2` (`SESSIONS_KEY`). The first load reads it; with no
 *   readable v2 copy it migrates `pg-assistant-sessions-v1` once (`loadAgentState` writes
 *   the migrated copy under v2 so the migration never runs twice) and NEVER writes v1:
 *   the v1 panel stays reachable behind `VITE_AGENT_PANEL=v1` and must find its data as it
 *   left it (FR-053).
 * - Every change is written back as it happens. What cannot survive a reload is left out
 *   of the write, not merely ignored on the read: a proposal's authority (`AiValidatedProposal`
 *   is module-authenticated, and a JSON copy of it is only bytes) and an Ask plan's held
 *   build progress. `reviveTurn` would drop both anyway; not writing them keeps the store
 *   small and keeps authority out of `localStorage` altogether.
 * - Blocked or full storage never throws out of here: the conversation keeps working and
 *   forgets on reload.
 *
 * The store is an external store (`model/tiny-store.ts`), not React state, because runs
 * are long async flows that write their turns minutes after they started, into the
 * conversation they started in, and must read the turn they are about to change NOW.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { loadAgentState, type AgentStorage } from '../model/migrate-sessions';
import { modeOrDefault } from '../model/modes';
import { createStore, type Store } from '../model/tiny-store';
import {
  highestIdSuffix,
  SESSIONS_KEY,
  sessionSummaries,
  titleOf,
  type PersistedAgentState,
  type Session,
  type Turn,
} from '../model/turns';
import type { AssistantMode, SessionSummary } from '../model/view-types';

export interface SessionsState {
  readonly sessions: readonly Session[];
  readonly activeId: string;
  readonly mode: AssistantMode;
  /** The person chose `mode` (a chosen mode outlives the host's default). */
  readonly modeChosen: boolean;
}

export interface UseAgentSessionsOptions {
  /**
   * Where conversations are kept. `undefined`: `window.localStorage` when there is one.
   * `null`: nowhere, the conversation lives in memory only (a story, a test).
   */
  readonly storage?: AgentStorage | null | undefined;
  /** The mode a person starts in until they choose one (SPEC §7.4: default `auto`). */
  readonly defaultMode?: AssistantMode | undefined;
  /** Epoch ms for `updatedAt`; injected so tests are deterministic. */
  readonly now?: (() => number) | undefined;
}

export interface AgentSessions {
  readonly state: SessionsState;
  /** The store itself, for flows that must read the conversation as it is now. */
  readonly store: Store<SessionsState>;
  readonly active: Session;
  readonly summaries: readonly SessionSummary[];
  /** Where the conversations came from on this mount. */
  readonly source: 'v2' | 'v1' | 'none';
  /** A fresh id (`turn-N`, `run-N`, `session-N`) that continues after every saved id. */
  readonly nextId: (prefix: string) => string;
  /** Change one conversation's turns; its title and `updatedAt` follow. */
  readonly updateTurns: (
    sessionId: string,
    change: (turns: readonly Turn[]) => readonly Turn[],
  ) => void;
  /** Open a new conversation (or stay in the current one when it is still empty). */
  readonly newConversation: () => string;
  readonly openConversation: (id: string) => void;
  /** Delete one; the current one's successor is the next row, or a new empty conversation. */
  readonly deleteConversation: (id: string) => void;
  /** The person chose a mode: it outlives the host default from now on. */
  readonly chooseMode: (mode: AssistantMode) => void;
}

function browserStorage(): AgentStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    // A sandboxed frame can throw on the property read itself.
    return undefined;
  }
}

function emptySession(id: string): Session {
  return { id, title: '', turns: [], updatedAt: null };
}

function initialState(
  loaded: PersistedAgentState | null,
  defaultMode: AssistantMode,
): SessionsState {
  if (loaded === null) {
    return {
      sessions: [emptySession('session-1')],
      activeId: 'session-1',
      mode: defaultMode,
      modeChosen: false,
    };
  }
  const chosen = loaded.modeChosen === true;
  return {
    sessions: loaded.sessions,
    activeId: loaded.activeId,
    mode: chosen ? modeOrDefault(loaded.mode, defaultMode) : defaultMode,
    modeChosen: chosen,
  };
}

/** A turn as it is written: nothing that is runtime authority, nothing a reload drops. */
function persistable(turn: Turn): Turn {
  if (turn.kind === 'proposal' && turn.proposal !== undefined) {
    const { proposal: _proposal, ...rest } = turn;
    void _proposal;
    return rest;
  }
  if (turn.kind === 'page-plan' && turn.heldBuild !== undefined) {
    const { heldBuild: _held, ...rest } = turn;
    void _held;
    return rest;
  }
  return turn;
}

function serialise(state: SessionsState): string {
  const saved: PersistedAgentState = {
    version: 2,
    sessions: state.sessions.map((session) => ({
      ...session,
      turns: session.turns.map(persistable),
    })),
    activeId: state.activeId,
    mode: state.mode,
    ...(state.modeChosen ? { modeChosen: true } : {}),
  };
  return JSON.stringify(saved);
}

export function useAgentSessions(options: UseAgentSessionsOptions = {}): AgentSessions {
  const defaultMode = options.defaultMode ?? 'auto';
  // Read once: a clock is a port, not a value that changes between renders.
  const [clock] = useState(() => options.now ?? Date.now);
  const [boot] = useState(() => {
    const storage = options.storage === null ? undefined : (options.storage ?? browserStorage());
    const loaded = loadAgentState(storage);
    const state = initialState(loaded.state, defaultMode);
    return {
      storage,
      source: loaded.source,
      store: createStore<SessionsState>(state),
      seed: highestIdSuffix(state.sessions),
    };
  });
  const { store, storage } = boot;
  const counter = useRef(boot.seed);

  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);

  // Written back on every change; the first write is the loaded state itself, harmless.
  useEffect(() => {
    if (storage === undefined) return;
    try {
      storage.setItem(SESSIONS_KEY, serialise(state));
    } catch {
      // Full or blocked: the conversation still works; it forgets on reload.
    }
  }, [state, storage]);

  const nextId = useCallback((prefix: string) => {
    counter.current += 1;
    return `${prefix}-${String(counter.current)}`;
  }, []);

  const updateTurns = useCallback(
    (sessionId: string, change: (turns: readonly Turn[]) => readonly Turn[]) => {
      store.setState((previous) => {
        const sessions = previous.sessions.map((session) => {
          if (session.id !== sessionId) return session;
          const turns = change(session.turns);
          if (turns === session.turns) return session;
          return {
            ...session,
            turns,
            title: session.title === '' ? titleOf(turns) : session.title,
            updatedAt: clock(),
          };
        });
        // Nothing changed: the same state, so nothing re-renders and nothing is re-saved.
        return sessions.some((session, index) => session !== previous.sessions[index])
          ? { ...previous, sessions }
          : previous;
      });
    },
    [clock, store],
  );

  const newConversation = useCallback(() => {
    const current = store.getState();
    const active = current.sessions.find((session) => session.id === current.activeId);
    // An empty conversation is reused: New twice must not pile up blank rows.
    if (active?.turns.length === 0) return active.id;
    const id = nextId('session');
    store.setState((previous) => ({
      ...previous,
      sessions: [...previous.sessions, emptySession(id)],
      activeId: id,
    }));
    return id;
  }, [nextId, store]);

  const openConversation = useCallback(
    (id: string) => {
      store.setState((previous) =>
        previous.activeId === id || !previous.sessions.some((session) => session.id === id)
          ? previous
          : { ...previous, activeId: id },
      );
    },
    [store],
  );

  const deleteConversation = useCallback(
    (id: string) => {
      const replacement = nextId('session');
      store.setState((previous) => {
        const index = previous.sessions.findIndex((session) => session.id === id);
        if (index === -1) return previous;
        const sessions = previous.sessions.filter((session) => session.id !== id);
        if (sessions.length === 0) {
          return { ...previous, sessions: [emptySession(replacement)], activeId: replacement };
        }
        if (previous.activeId !== id) return { ...previous, sessions };
        // The next row takes its place, or the previous one when it was the last.
        const next = sessions[Math.min(index, sessions.length - 1)] ?? sessions[0];
        return { ...previous, sessions, activeId: next?.id ?? replacement };
      });
    },
    [nextId, store],
  );

  const chooseMode = useCallback(
    (mode: AssistantMode) => {
      store.setState((previous) =>
        previous.mode === mode && previous.modeChosen
          ? previous
          : { ...previous, mode, modeChosen: true },
      );
    },
    [store],
  );

  const active =
    state.sessions.find((session) => session.id === state.activeId) ??
    state.sessions[0] ??
    emptySession(state.activeId);

  const summaries = useMemo(
    () => sessionSummaries(state.sessions, state.activeId),
    [state.sessions, state.activeId],
  );

  return {
    state,
    store,
    active,
    summaries,
    source: boot.source,
    nextId,
    updateTurns,
    newConversation,
    openConversation,
    deleteConversation,
    chooseMode,
  };
}
