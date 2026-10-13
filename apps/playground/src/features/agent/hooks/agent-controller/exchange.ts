/**
 * Where a run's turns go: what was sent (`Outgoing`), where the record is placed
 * (`Placement`, `openExchange`), the history it carries, and its creative mark.
 */
import { type NodeId, pixiSkillIdsFor, type RunAiAgentOptions } from '@craftkit/builder';

import { historyOf, type SentContext, type Turn } from '../../model/turns';
import { skillRequestText, type PromptSkillSnapshot } from '../../model/prompt-skills';

import type { Env, Flow } from './controller-state';
import { locateTurn, patchKind, patchTurn, sessionOf } from './turn-plumbing';

/* ── Where a run's turns go ──────────────────────────────────────────────────── */

/** What was sent: the person's words, their context chips, the blocks they point at. */
export interface Outgoing {
  readonly text: string;
  readonly context: readonly SentContext[];
  readonly pointed: readonly NodeId[];
  /** What the engine is asked, when it is more than the words (a change to a plan). */
  readonly request?: string | undefined;
  /** The words are a catalog suggestion, picked and sent unedited (answered from the catalog). */
  readonly catalog?: boolean | undefined;
  readonly skillSnapshot?: PromptSkillSnapshot | undefined;
}

export function engineRequest(outgoing: Outgoing): string {
  return outgoing.request ?? outgoing.text;
}

/**
 * creative agent (2026-10-12): the build will write a game or story scene (free code is on
 * and the request names one, the engine's own `needsSceneCode` test), so its record shows
 * the planner's creative brief. Read once, when the build starts.
 */
export function creativeMark(env: Env, request: string): { readonly creative?: true } {
  return env.options.freeCode === true &&
    pixiSkillIdsFor(env.registry, skillRequestText(env.options, request)).length > 0
    ? { creative: true }
    : {};
}

/** A new exchange, or an existing record re-run in place (Try again, Build, Run this plan). */
export interface Placement {
  readonly sessionId: string;
  readonly recordTurnId?: string | undefined;
  /** The history the run carries, computed before the record changed. */
  readonly history?: RunAiAgentOptions['history'];
}

/**
 * Open the run's place in the thread: the person's turn and the record (a new exchange),
 * or the record re-run in place. `record: null` opens the person's turn alone (an answer
 * appears when it is ready). Returns the turn the record goes after.
 */
export function openExchange(
  flow: Flow,
  placement: Placement,
  outgoing: Outgoing,
  record: Turn | null,
): string | null {
  const { sessions } = flow.env();
  const reuse = placement.recordTurnId;
  if (reuse !== undefined) {
    const located = locateTurn(flow, reuse);
    const turns = sessionOf(flow, placement.sessionId)?.turns ?? [];
    const anchor = located === null ? null : (turns[located.index - 1]?.id ?? null);
    if (record === null) {
      sessions.updateTurns(placement.sessionId, (current) =>
        current.filter((turn) => turn.id !== reuse),
      );
    } else {
      patchTurn(flow, placement.sessionId, reuse, () => record);
    }
    return anchor;
  }
  const userId = sessions.nextId('turn');
  sessions.updateTurns(placement.sessionId, (turns) => [
    ...turns,
    {
      id: userId,
      kind: 'user',
      text: outgoing.text,
      context: outgoing.context,
      ...(outgoing.skillSnapshot === undefined ? {} : { skillSnapshot: outgoing.skillSnapshot }),
    },
    ...(record === null ? [] : [record]),
  ]);
  return userId;
}

/** The person's turn before `turnId` was stopped before any output (SPEC §4.5 "Not run"). */
export function markNotRun(flow: Flow, sessionId: string, anchorId: string | null): void {
  if (anchorId === null) return;
  patchKind(flow, sessionId, anchorId, 'user', (turn) => ({ ...turn, notRun: true }));
}

export function historyFor(flow: Flow, placement: Placement): RunAiAgentOptions['history'] {
  if (placement.history !== undefined) return placement.history;
  return historyOf(sessionOf(flow, placement.sessionId)?.turns ?? []);
}
