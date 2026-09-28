import type {
  AiBuildRevertErrorCode,
  AiChatTurn,
  AiPlan,
  AiSkillActivationPin,
  AiValidatedProposal,
  AiRunFailure,
  DroppedAiPlanStep,
  GenerationStageId,
} from '@craftkit/builder';

import {
  buildReceipt,
  initialBuildProgress,
  lastEvidenceAt,
  type BuildNotice,
  type BuildProgress,
  type BuildReceipt,
} from './AssistantPanel.build';
import type { PlanImpact } from './AssistantPanel.impact';
import { receiptOf, type RunProgress, type RunReceipt } from './AssistantPanel.progress';
import type { AssistantMode } from './AssistantPanel.modes';

/**
 * Why putting a section back was refused. The engine's three
 * (`AiBuildRevertError`), plus two of the panel's:
 *
 * - `refused`: the door turned the revert's own write down.
 * - `no-earlier-version`: the engine's `not-landed` on a section that DID land
 *   — a region a PagePlan skeleton wrote in full has nothing recorded from
 *   before it (wave-2 verifier, pageplan-revert.mjs, 2026-09-28), and "it
 *   never landed" said of a section on the page is false.
 *
 * Nothing was written in any of the five.
 */
export type BuildRevertRefusal = AiBuildRevertErrorCode | 'refused' | 'no-earlier-version';

export interface BuildingTurn {
  readonly id: string;
  readonly from: 'assistant';
  readonly kind: 'building';
  /** The original request, kept so a skipped section can be re-asked. */
  readonly request: string;
  readonly progress: BuildProgress;
  /**
   * Ask mode only: the one approval, still unanswered. Nothing has been written
   * while it is true — the skeleton lands only on Build (2026-09-28, P0-4).
   */
  readonly awaiting?: boolean;
  /** Where this build lands differently from what the words asked for. */
  readonly notices?: readonly BuildNotice[];
}

/** A finished build: the report, and what can still be undone from it. */
export interface BuiltTurn {
  readonly id: string;
  readonly from: 'assistant';
  readonly kind: 'built';
  readonly progress: BuildProgress;
  readonly receipt?: BuildReceipt;
  /** The person stopped it, or the budget did. */
  readonly stopped?: boolean;
  readonly request?: string;
  /**
   * Runtime-only, exactly like a plan's `proposal`: putting a section back
   * needs the build's own record of what it wrote (each section's landing),
   * which belongs to THIS session. A revived report is readable and inert.
   */
  readonly undoable?: boolean;
  /** Where this build landed differently from what the words asked for. */
  readonly notices?: readonly BuildNotice[];
  /**
   * Sections put back FORWARD (`revertBuildSection`), by position. Each one is
   * its own transaction and touches its own region only, so undoing one never
   * takes another with it — the old `undoneFrom`/`undoneSteps` cascade, which
   * looped `kernel.undo()` through the person's own later edits, is gone.
   */
  readonly reverted?: readonly number[];
  /**
   * The last time putting a section back was REFUSED, and why — nothing was
   * written. Runtime-only: an answer to a click in this session.
   */
  readonly revertRefused?: readonly {
    readonly position: number;
    readonly code: BuildRevertRefusal;
  }[];
  /**
   * How many regions the build left holding their empty placeholder (stopped,
   * skipped, never reached). Runtime-only, like `undoable`: removing them needs
   * the build's record of each placeholder.
   */
  readonly unfilled?: number;
  /** What "remove the empty sections" did: removed in one transaction, and kept. */
  readonly unfilledRemoval?: { readonly removed: number; readonly kept: number };
  /**
   * The last "remove the empty sections" was REFUSED by the door — one
   * transaction, so nothing was removed. Runtime-only, like `revertRefused`:
   * an answer to a click in this session. It used to be swallowed, and the
   * button then did nothing anyone could see (wave-2 verifier, 2026-09-28).
   */
  readonly unfilledRemovalRefused?: boolean;
}

export interface ThinkingTurn {
  readonly id: string;
  readonly from: 'assistant';
  readonly kind: 'thinking';
  readonly subject: string;
  /** The provider's own last words about what it is doing, when it streams them. */
  readonly progress?: string;
  /** The bounded stream of provider updates shown in the live run card. */
  readonly progressLog?: readonly string[];
  /** The run as rows — Plan, Structure and (Auto only) Apply. */
  readonly run: RunProgress;
}

export interface StoppedTurn {
  readonly id: string;
  readonly from: 'assistant';
  readonly kind: 'stopped';
  /** How long it ran and where it was — a stop is an outcome, not a void. */
  readonly receipt?: RunReceipt;
}

export interface RefusedTurn {
  readonly id: string;
  readonly from: 'assistant';
  readonly kind: 'refused';
  readonly text: string;
  readonly failure?: AiRunFailure;
  /** Kept only so a retryable failure can start a fresh, bounded run. */
  readonly request?: string;
  /** The row that was active when it broke, so the card can say where. */
  readonly failedAt?: GenerationStageId;
  /** How long it ran, where it broke, and the provider's last words. */
  readonly receipt?: RunReceipt;
}

export interface DiscardedTurn {
  readonly id: string;
  readonly from: 'assistant';
  readonly kind: 'discarded';
}

export interface OutlineTurn {
  readonly id: string;
  readonly from: 'assistant';
  /**
   * A PLAN, in prose, with no commands behind it.
   *
   * A kind of its own rather than a `plan` turn with an empty command list,
   * because the card that renders a plan offers Preview — and Preview
   * offers Apply. A turn that has nothing to apply should not be able to
   * reach a button that applies: the strongest way to say that is to give
   * it a shape with no proposal in it at all.
   */
  readonly kind: 'outline';
  readonly text: string;
  readonly followUp?: string;
  readonly skills?: readonly AiSkillActivationPin[];
  /** Commands the model proposed anyway, and this run refused to keep. */
  readonly dropped: number;
  /**
   * The sections a PLANNED build would create, when this outline came from one.
   *
   * Titles only. An `apply: 'never'` build writes nothing, so there is no node
   * to name — see `AiBuildPlannedTask`.
   */
  readonly sections?: readonly string[];
  /**
   * The request that produced this outline, kept so it can be built for real.
   *
   * A build is a NEW run at a different authority, not this one continued: this
   * run was told not to write and its closure will never write. Re-asking with
   * the same words is the honest way to change that, and it is exactly what a
   * person switching mode by hand would do.
   */
  readonly request?: string;
  /** The settled run, for the timing receipt. */
  readonly run?: RunProgress;
}

export interface PlanTurn {
  readonly id: string;
  readonly from: 'assistant';
  readonly kind: 'plan';
  readonly plan: AiPlan;
  /**
   * What this plan would change, computed ONCE when it arrived.
   *
   * On the turn rather than in a render memo, because the honest source is
   * `previewAiPlan` — it builds a scratch kernel and dispatches the whole
   * plan through the real door. That is the right price to pay once per
   * proposal and the wrong one to pay per render, and `turns` changes on
   * every streamed progress tick. It is plain data, so it survives
   * persistence as readable history, unlike the proposal beside it.
   */
  readonly impact?: PlanImpact;
  /**
   * The steps the recovery ladder LEFT BEHIND, and why the door refused each.
   *
   * A salvaged plan is a smaller plan than the model wrote, and a person is
   * owed that fact before they are shown the result — otherwise the card reads
   * as a complete answer to a request it only partly answered. Plain data, so
   * it survives persistence: a revived card can still say what was dropped,
   * even though it can no longer apply anything.
   */
  readonly salvaged?: {
    readonly kept: number;
    readonly dropped: readonly DroppedAiPlanStep[];
  };
  /**
   * What the request cost to send, estimated with the engine's own
   * estimator over the context this run actually carried.
   *
   * Stored beside the impact for the same reason: the inputs (the assembled
   * context, the history) belong to the run and are gone by the next
   * render, so the number is computed once, when the answer arrives.
   */
  readonly costTokens?: number;
  /** Runtime-authenticated authority. It deliberately cannot survive JSON revival. */
  readonly proposal?: AiValidatedProposal;
  readonly skills?: readonly AiSkillActivationPin[];
  readonly applied: boolean;
  /** The mode this plan was proposed under; absent (revived old data) reads as 'ask'. */
  readonly mode?: AssistantMode;
  /** The settled run, for the timing receipt. */
  readonly run?: RunProgress;
}

export type Turn =
  | { readonly id: string; readonly from: 'you'; readonly text: string }
  | BuildingTurn
  | BuiltTurn
  | ThinkingTurn
  | StoppedTurn
  | RefusedTurn
  | DiscardedTurn
  | OutlineTurn
  | PlanTurn;

export interface Session {
  readonly id: string;
  readonly title: string;
  readonly turns: readonly Turn[];
}

export function highestIdSuffix(sessions: readonly Session[]): number {
  let highest = 1;
  const consider = (id: string): void => {
    const match = /-(\d+)$/u.exec(id);
    if (match?.[1] !== undefined) highest = Math.max(highest, Number(match[1]));
  };
  for (const session of sessions) {
    consider(session.id);
    for (const turn of session.turns) consider(turn.id);
  }
  return highest;
}

export function historyOf(turns: readonly Turn[]): AiChatTurn[] {
  return turns
    .flatMap<AiChatTurn>((turn) => {
      if (turn.from === 'you') {
        return [{ role: 'user', text: turn.text }];
      }
      if (turn.kind === 'plan') {
        return [{ role: 'assistant', text: turn.plan.rationale }];
      }
      if (turn.kind === 'outline') {
        /*
          The plan the assistant just wrote IS the answer, so it belongs in the
          history like any other. Dropping it meant a person could say "do
          option two" and the next request would arrive without the answer that
          had the options in it — the model being asked to remember something it
          was never told.
        */
        return [{ role: 'assistant', text: turn.text }];
      }
      if (turn.kind === 'refused') {
        return [{ role: 'assistant', text: turn.text }];
      }
      if (turn.kind === 'built') {
        return [{ role: 'assistant', text: turn.progress.direction }];
      }
      return [];
    })
    .slice(-12);
}

export interface PersistedPanelState {
  readonly sessions: readonly Session[];
  readonly activeId: string;
  /**
   * The mode the person last chose.
   *
   * It was not saved, so every reload returned to Ask — and Ask can write. A
   * person who deliberately put the assistant in Plan came back to a panel that
   * would apply, having changed nothing and been told nothing. Revived
   * defensively: anything that is not one of the three reads as the host's
   * default mode, as does data written before this field.
   */
  readonly mode?: AssistantMode;
  /**
   * Whether the person CHOSE `mode`, rather than it being the default the
   * panel happened to save. Only a chosen mode outlives a change of default:
   * without this every browser that ever opened the panel kept the old
   * default forever, because the default was saved like a choice. Absent in
   * older data, where a saved Plan or Auto still counts as chosen.
   */
  readonly modeChosen?: boolean;
}

/**
 * Saved conversations from before ids continued across reloads can hold two
 * turns with one id. React keys must be unique, so the later twin is re-keyed
 * once, on revival; nothing else refers to a turn by id after it is settled.
 */
export function withUniqueTurnIds(sessions: readonly Session[]): readonly Session[] {
  const seen = new Set<string>();
  let repaired = highestIdSuffix(sessions);
  return sessions.map((session) => ({
    ...session,
    turns: session.turns.map((turn) => {
      if (!seen.has(turn.id)) {
        seen.add(turn.id);
        return turn;
      }
      repaired += 1;
      const id = `turn-${String(repaired)}`;
      seen.add(id);
      return { ...turn, id };
    }),
  }));
}

/**
 * Revive a saved conversation, defensively: storage can be missing, blocked,
 * or stale. A turn saved mid-thought becomes 'stopped' — a reload killed that
 * request, and a spinner that nothing will ever resolve is a lie.
 */
export function reviveSessions(persistKey: string | undefined): PersistedPanelState | null {
  if (persistKey === undefined) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(persistKey);
    if (raw === null) {
      return null;
    }
    const parsed = JSON.parse(raw) as PersistedPanelState;
    // Checked via a separate binding: Array.isArray on a readonly-array
    // property would narrow it to any[] and un-type every turn below.
    const sessionsShape: unknown = parsed.sessions;
    if (!Array.isArray(sessionsShape) || typeof parsed.activeId !== 'string') {
      return null;
    }
    const sessions = parsed.sessions.map((session) => ({
      ...session,
      turns: session.turns.map((turn): Turn => {
        if (turn.from === 'assistant' && turn.kind === 'thinking') {
          /*
            The run it left behind is plain data, so the stop can still say
            how far it got — measured to the last moment there is EVIDENCE
            for (when its open row began), never to now: the wall clock kept
            running while the tab was closed, the request did not. Saved data
            from before runs carried an origin yields no receipt at all rather
            than an invented one.
          */
          // Saved JSON, not a live turn: storage predating run receipts has no
          // `run` at all, so it is read through the shape it was written in.
          const { run } = turn as { readonly run?: RunProgress };
          const receipt =
            run === undefined
              ? null
              : receiptOf(run, run.stageSince ?? run.startedAt, turn.progress);
          return {
            id: turn.id,
            from: 'assistant',
            kind: 'stopped',
            ...(receipt === null ? {} : { receipt }),
          };
        }
        if (turn.from === 'assistant' && turn.kind === 'building' && turn.awaiting === true) {
          /*
            Still waiting on its ONE question, which is asked before anything is
            written (2026-09-28, P0-4): the reload killed a build that wrote
            nothing. It comes back as a stop — never as a "Stopped 0/3" report
            whose rows name sections that were never on the page.
          */
          const { progress } = turn as { readonly progress?: BuildProgress };
          const run = progress?.run ?? null;
          const receipt = run === null ? null : receiptOf(run, run.stageSince ?? run.startedAt);
          return {
            id: turn.id,
            from: 'assistant',
            kind: 'stopped',
            ...(receipt === null ? {} : { receipt }),
          };
        }
        if (turn.from === 'assistant' && turn.kind === 'building') {
          /*
            The same rule the thinking turn follows, for the same reason: the
            reload killed the build, so a list that still says "Working" is a
            lie. The sections it had already applied are on the page — they
            were real transactions — so the receipt reports them, measured to
            the last moment there is evidence for rather than to now.
          */
          // Saved JSON, not a live turn: read through the shape it was written in.
          const { progress } = turn as { readonly progress?: BuildProgress };
          const receipt =
            progress === undefined ? null : buildReceipt(progress, lastEvidenceAt(progress));
          return {
            id: turn.id,
            from: 'assistant',
            kind: 'built',
            progress: progress ?? initialBuildProgress(turn.id, Number.NaN),
            stopped: true,
            ...(receipt === null ? {} : { receipt }),
            ...(turn.notices === undefined ? {} : { notices: turn.notices }),
          };
        }
        if (turn.from === 'assistant' && turn.kind === 'built') {
          /*
            A report is readable across a reload; its Undo is not. What a
            section is put back TO is the build's record of it, held by the
            session that ran the build, and this one has none — so `undoable`
            (and the empty-section count its removal needs) is dropped exactly
            as a plan's `proposal` is. What already HAPPENED stays: the notices,
            the sections put back, the removal.
          */
          return {
            id: turn.id,
            from: turn.from,
            kind: turn.kind,
            progress: turn.progress,
            ...(turn.receipt === undefined ? {} : { receipt: turn.receipt }),
            ...(turn.stopped === undefined ? {} : { stopped: turn.stopped }),
            ...(turn.notices === undefined ? {} : { notices: turn.notices }),
            ...(turn.reverted === undefined ? {} : { reverted: turn.reverted }),
            ...(turn.unfilledRemoval === undefined
              ? {}
              : { unfilledRemoval: turn.unfilledRemoval }),
          };
        }
        if (turn.from === 'assistant' && turn.kind === 'plan') {
          // A JSON clone does not carry the module-private authentication held
          // by a live proposal. Keep the conversation, never revive authority.
          return {
            id: turn.id,
            from: turn.from,
            kind: turn.kind,
            plan: turn.plan,
            applied: turn.applied,
            ...(turn.skills === undefined ? {} : { skills: turn.skills }),
            ...(turn.mode === undefined ? {} : { mode: turn.mode }),
          };
        }
        return turn;
      }),
    }));
    /*
      Data from before the marker has none. Then the default was Ask and only
      the radios wrote Plan or Auto, so those two were chosen; a saved Ask may
      have been the default, and stays unchosen. Read as unknown: a hand-edited
      store can hold anything, and only a literal `true` marks a choice.
    */
    const marked: unknown = parsed.modeChosen;
    const modeChosen =
      marked === undefined ? parsed.mode === 'plan' || parsed.mode === 'auto' : marked === true;
    return {
      sessions: withUniqueTurnIds(sessions),
      activeId: parsed.activeId,
      // Passed through as READ. The caller decides what an unrecognised value
      // means, so one place owns the "unknown reads as the default" rule.
      ...(parsed.mode === undefined ? {} : { mode: parsed.mode }),
      ...(modeChosen ? { modeChosen: true } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * The assistant, as a conversation.
 *
 * It never writes a document. It proposes kernel COMMANDS; they are dry-run on
 * a scratch kernel before anyone sees them; and applying them goes through the
 * same validated door every other edit uses — stamped `author: 'ai'`, so an
 * assistant edit is undoable and appears in the provenance strip beside the
 * ones a person made.
 *
 * The plan is SHOWN before it is applied. An assistant that changes the page
 * the instant you press Enter is a magic trick; one that says what it intends
 * and can be refused is a tool.
 */
