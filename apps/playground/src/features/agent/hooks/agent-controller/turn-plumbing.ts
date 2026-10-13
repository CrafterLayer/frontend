/**
 * Turn plumbing: find, patch, insert and place a conversation's turns from inside a
 * flow, always through the sessions store (never a render's closure).
 */
import type { SentContext, Session, Turn } from '../../model/turns';
import type { PromptSkillSnapshot } from '../../model/prompt-skills';

import type { Flow } from './controller-state';

/* ── Turn plumbing ───────────────────────────────────────────────────────────── */

export function sessionOf(flow: Flow, sessionId: string): Session | undefined {
  return flow
    .env()
    .sessions.store.getState()
    .sessions.find((session) => session.id === sessionId);
}

export function locateTurn(
  flow: Flow,
  turnId: string,
): { readonly sessionId: string; readonly turn: Turn; readonly index: number } | null {
  for (const session of flow.env().sessions.store.getState().sessions) {
    const index = session.turns.findIndex((turn) => turn.id === turnId);
    const turn = session.turns[index];
    if (turn !== undefined) return { sessionId: session.id, turn, index };
  }
  return null;
}

export function patchTurn(
  flow: Flow,
  sessionId: string,
  turnId: string,
  change: (turn: Turn) => Turn,
): void {
  flow.env().sessions.updateTurns(sessionId, (turns) => {
    const next = turns.map((turn) => {
      if (turn.id !== turnId) return turn;
      const changed = change(turn);
      // A proposal becoming an edit, an answer, or an error keeps its measured receipt.
      return changed === turn || changed.telemetry !== undefined || turn.telemetry === undefined
        ? changed
        : { ...changed, telemetry: turn.telemetry };
    });
    // Unchanged stays the same array: the conversation is neither re-dated nor re-saved.
    return next.some((turn, index) => turn !== turns[index]) ? next : turns;
  });
}

/** Change a turn only while it is still of `kind` (a plan card may have become an ending). */
export function patchKind<K extends Turn['kind']>(
  flow: Flow,
  sessionId: string,
  turnId: string,
  kind: K,
  change: (turn: Extract<Turn, { kind: K }>) => Turn,
): void {
  patchTurn(flow, sessionId, turnId, (turn) =>
    turn.kind === kind ? change(turn as Extract<Turn, { kind: K }>) : turn,
  );
}

export function insertAfter(
  flow: Flow,
  sessionId: string,
  anchorId: string | null,
  added: readonly Turn[],
): void {
  if (added.length === 0) return;
  flow.env().sessions.updateTurns(sessionId, (turns) => {
    const index = anchorId === null ? -1 : turns.findIndex((turn) => turn.id === anchorId);
    return index === -1 ? [...turns, ...added] : turns.toSpliced(index + 1, 0, ...added);
  });
}

/** Put `record` at `turnId`: replace it when it is there, else add it after `anchorId`. */
export function placeRecord(
  flow: Flow,
  sessionId: string,
  anchorId: string | null,
  record: Turn,
): void {
  const exists = sessionOf(flow, sessionId)?.turns.some((turn) => turn.id === record.id) ?? false;
  if (exists) {
    patchTurn(flow, sessionId, record.id, () => record);
    return;
  }
  insertAfter(flow, sessionId, anchorId, [record]);
}

/** The request a record answers: its own `request`, else the person's turn before it. */
export function requestOf(
  flow: Flow,
  turnId: string,
): {
  readonly text: string;
  readonly context: readonly SentContext[];
  readonly skillSnapshot?: PromptSkillSnapshot | undefined;
} | null {
  const located = locateTurn(flow, turnId);
  if (located === null) return null;
  const turns = sessionOf(flow, located.sessionId)?.turns ?? [];
  const user = turns.slice(0, located.index).findLast((turn) => turn.kind === 'user');
  if (user?.kind === 'user')
    return { text: user.text, context: user.context, skillSnapshot: user.skillSnapshot };
  const own = 'request' in located.turn ? located.turn.request : undefined;
  return own === undefined ? null : { text: own, context: [] };
}
