import { ChromeButton, GENERATION_STAGE_LABELS } from '@craftkit/builder';

import { IconAlert } from '../AssistantPanel/AssistantPanel.icons';
import type {
  DiscardedTurn,
  RefusedTurn,
  StoppedTurn,
} from '../AssistantPanel/AssistantPanel.turns';
import { EndingLine } from '../EndingLine';

export interface OutcomeCardProps {
  /** A run that ended with nothing to decide: stopped, refused, or discarded. */
  readonly turn: StoppedTurn | RefusedTurn | DiscardedTurn;
  /** Another run owns the panel, so Retry must not start a second one. */
  readonly busy: boolean;
  /** Ask the same request again. Only ever offered for a retryable failure. */
  readonly onRetry: (request: string) => void;
}

/**
 * How a run ENDED, when it ended with nothing to decide.
 *
 * The three endings share a card because they share a shape — a sentence, a
 * receipt, and at most one way forward — and because keeping them together is
 * what stops them from drifting into three different ways of saying "it is
 * over". They are not three variants of one state: a stop is the person's own
 * decision, a refusal is the run's, and a discard is the person dismissing a
 * proposal that never ran at all.
 */
export function OutcomeCard({ turn, busy, onRetry }: OutcomeCardProps) {
  if (turn.kind === 'stopped') {
    return (
      <div className="pg-chat__card pg-chat__card--discarded" data-state="stopped">
        <p className="pg-chat__refused">Stopped.</p>
        {/*
          A stop is an OUTCOME, not a void. Without the receipt the card said
          "Stopped." and left a person guessing whether it had run for a second
          or for six minutes — and that is the one thing they need in order to
          decide whether asking again is worth it.
        */}
        <EndingLine verb="Stopped" receipt={turn.receipt} />
      </div>
    );
  }

  if (turn.kind === 'discarded') {
    return (
      <div className="pg-chat__card pg-chat__card--discarded" data-state="discarded">
        {/*
          No receipt, and there is nothing missing: a discarded proposal was
          never a run. The person dismissed a card, and a duration would be
          answering a question nobody asked.
        */}
        <p className="pg-chat__refused">Discarded.</p>
      </div>
    );
  }

  return (
    <div className="pg-chat__card pg-chat__card--refused" data-state="refused">
      <IconAlert />
      <div>
        <p className="pg-chat__refused" dir="auto">
          {turn.text}
        </p>
        {turn.failure === undefined ? null : (
          <p className="pg-chat__failure-meta">
            <code className="pg-chat__code">{turn.failure.code}</code>
            {` · ${turn.failure.source}`}
            {turn.failure.status === undefined ? '' : ` · HTTP ${String(turn.failure.status)}`}
            {/* The receipt below already names the row; only a card without one
              has to say it here. */}
            {turn.failedAt === undefined || turn.receipt !== undefined
              ? ''
              : ` · at ${GENERATION_STAGE_LABELS[turn.failedAt]}`}
          </p>
        )}
        <EndingLine verb="Failed" receipt={turn.receipt} />
        {/*
          Retry is offered only when the failure SAID it was retryable and the
          request survived. A retry that re-sends a request the panel no longer
          has would send an empty one, and a retry on a permanent failure asks a
          person to wait for the same answer twice.
        */}
        {turn.failure?.retryable === true && turn.request !== undefined ? (
          <ChromeButton
            variant="quiet"
            size="sm"
            disabled={busy}
            onClick={() => {
              onRetry(turn.request ?? '');
            }}
          >
            Retry
          </ChromeButton>
        ) : null}
      </div>
    </div>
  );
}
