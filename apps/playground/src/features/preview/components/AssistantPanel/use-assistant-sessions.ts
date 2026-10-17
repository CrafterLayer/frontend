import { useCallback, useEffect, useRef, useState } from 'react';

import type { AssistantMode } from './AssistantPanel.modes';
import { highestIdSuffix, reviveSessions, type Session, type Turn } from './AssistantPanel.turns';

const EMPTY_TURNS: readonly Turn[] = [];

/**
 * The conversations this panel holds: every session and its turns, the active
 * one, the mode the person chose, and ids that never repeat a saved key. With
 * a `persistKey` every settled change is written back and revived on mount;
 * without one the panel stays fully in memory.
 */
export function useAssistantSessions(persistKey: string | undefined, defaultMode: AssistantMode) {
  const [sessions, setSessions] = useState<readonly Session[]>(
    () =>
      reviveSessions(persistKey)?.sessions ?? [{ id: 'session-1', title: 'New chat', turns: [] }],
  );
  /*
    Ids continue from where the revived conversation stopped. A counter that
    restarted at 1 on every load handed a new turn the id of a saved one, and
    React then saw two children with the same key — a duplicated or dropped
    bubble, depending on the day.
  */
  const [idSeed] = useState(() => highestIdSuffix(sessions));
  const counter = useRef(idSeed);
  const nextId = useCallback((prefix: string) => {
    counter.current += 1;
    return `${prefix}-${String(counter.current)}`;
  }, []);
  const [activeId, setActiveId] = useState(
    () => reviveSessions(persistKey)?.activeId ?? 'session-1',
  );
  const [modeChosen, setModeChosen] = useState(
    () => reviveSessions(persistKey)?.modeChosen === true,
  );
  const [panelMode, setMode] = useState<AssistantMode>(() => {
    const revived = reviveSessions(persistKey);
    const saved = revived?.mode;
    /*
      Only a mode the person chose outlives the host default. Anything else —
      a default saved like a choice, an older saved Ask, a hand-edited store —
      reads as the host default. (An older Plan or Auto was a choice; the
      revival marks it so.)
    */
    if (revived?.modeChosen !== true) return defaultMode;
    return saved === 'auto' || saved === 'plan' || saved === 'ask' ? saved : defaultMode;
  });
  const chooseMode = useCallback((mode: AssistantMode) => {
    setModeChosen(true);
    setMode(mode);
  }, []);

  // Every settled change is written back; a blocked store fails silently — the
  // conversation still works, it just forgets on reload.
  useEffect(() => {
    if (persistKey === undefined) {
      return;
    }
    try {
      window.localStorage.setItem(
        persistKey,
        JSON.stringify({ sessions, activeId, mode: panelMode, modeChosen }),
      );
    } catch {
      // Storage full or blocked: in-memory behaviour continues unchanged.
    }
  }, [activeId, modeChosen, panelMode, persistKey, sessions]);

  const active = sessions.find((session) => session.id === activeId) ?? sessions[0];
  const turns = active?.turns ?? EMPTY_TURNS;

  const patchTurns = useCallback(
    (change: (previous: readonly Turn[]) => readonly Turn[]) => {
      setSessions((previous) =>
        previous.map((session) =>
          session.id === activeId ? { ...session, turns: change(session.turns) } : session,
        ),
      );
    },
    [activeId],
  );

  /**
   * Open a request: the person's words and the assistant's first bubble, in
   * ONE update. Done as two, the rename ran after the turns were already in
   * and its `turns.length === 0` test was never true again — every
   * conversation stayed called "New chat".
   */
  const openTurn = useCallback(
    (trimmed: string, youId: string, reply: Turn) => {
      setSessions((previous) =>
        previous.map((session) =>
          session.id === activeId
            ? {
                ...session,
                // The first thing asked names the conversation, as a chat should.
                title: session.turns.length === 0 ? trimmed.slice(0, 32) : session.title,
                turns: [...session.turns, { id: youId, from: 'you', text: trimmed }, reply],
              }
            : session,
        ),
      );
    },
    [activeId],
  );

  return {
    sessions,
    setSessions,
    nextId,
    activeId,
    setActiveId,
    panelMode,
    setMode,
    chooseMode,
    active,
    turns,
    patchTurns,
    openTurn,
  };
}
