import { ChromeButton } from '@craftkit/builder';

import type { AgentLocale } from '../AgentFace';
import {
  IconCheck,
  IconClose,
  IconCode,
  IconEye,
  IconSparkle,
  IconUndo,
} from '../AssistantPanel/AssistantPanel.icons';
import type { AssistantMode } from '../AssistantPanel/AssistantPanel.modes';
import type { PlanTurn } from '../AssistantPanel/AssistantPanel.turns';
import { describeStep, shortSkillFingerprint } from '../AssistantPanel/AssistantPanel.utils';
import { PlanImpactLine } from '../PlanImpactLine';
import { StageTimings } from '../StageTimings';

export interface PlanCardProps {
  readonly turn: PlanTurn;
  readonly locale: AgentLocale;
  /** The panel's mode NOW, which is not always the mode the plan was made under. */
  readonly mode: AssistantMode;
  /** Whether this panel is allowed to write at all. Gates Apply AND Undo. */
  readonly canWrite: boolean;
  readonly onApply: () => void;
  readonly onPreview: () => void;
  readonly onDiscard: () => void;
  readonly onUndo: () => void;
  /** Absent when the host has no code view to open. */
  readonly onReviewAsCode?: (() => void) | undefined;
}

/**
 * A proposed change, and the decision it asks for.
 *
 * The card carries everything a person needs before answering: why (the
 * rationale), what would change (the impact, diffed from the plan's own
 * rehearsal), what it cost to ask, which Skills the request activated, and each
 * step in words with the exact command beside it as the technical truth.
 */
export function PlanCard({
  turn,
  locale,
  mode,
  canWrite,
  onApply,
  onPreview,
  onDiscard,
  onUndo,
  onReviewAsCode,
}: PlanCardProps) {
  const proposedMode = turn.mode ?? 'ask';
  /*
    A revived card cannot act. Its transaction belongs to the session that made
    it, and this session's history has entirely different entries at the same
    position — so an Undo here would undo somebody else's work while claiming to
    undo this plan, and an Apply would re-run authority that no longer exists.
    `proposal` is the marker: persistence deliberately drops it, so its absence
    means revived.
  */
  const revived = turn.proposal === undefined;
  return (
    <div
      className={`pg-chat__card ${
        turn.applied ? 'pg-chat__card--applied' : 'pg-chat__card--pending'
      }`}
      data-state={turn.applied ? 'applied' : 'pending'}
    >
      <div className="pg-chat__card-head">
        <span className="pg-chat__card-kind" data-kind={turn.applied ? 'applied' : proposedMode}>
          {turn.applied ? <IconCheck /> : <IconSparkle />}
          {turn.applied ? 'Applied' : proposedMode === 'plan' ? 'Plan' : 'Proposal'}
        </span>
        <span className="pg-chat__card-count">
          {String(turn.plan.commands.length)} {turn.plan.commands.length === 1 ? 'step' : 'steps'}
        </span>
      </div>
      <p className="pg-chat__rationale" dir="auto">
        {turn.plan.rationale}
      </p>
      {/*
        WHAT WOULD CHANGE, before deciding.

        Not a re-reading of the step list and not a second model call:
        `previewAiPlan` already runs the plan on a scratch kernel through the
        real door, so diffing that document against the live one is the only
        honest answer. The two differ exactly where it matters — a `setProp` to
        the value already there reads like work in the step list and moves
        nothing on the page, and a person about to press Apply should be told
        that before spending an undo step to find out.
      */}
      <PlanImpactLine impact={turn.impact} costTokens={turn.costTokens} locale={locale} />
      {/*
        WHAT WAS LEFT BEHIND, said before the steps that survived.

        A salvaged plan is a SMALLER plan than the model wrote. Without this the
        card reads as a complete answer to a request it only partly answered,
        and the person's next move — asking again for the missing part — depends
        entirely on knowing there is a missing part.

        Above the step list on purpose: it changes how the list should be read.
      */}
      {turn.salvaged === undefined || turn.salvaged.dropped.length === 0 ? null : (
        <details className="pg-chat__salvage">
          <summary>
            {locale === 'ar'
              ? `أُسقطت ${String(turn.salvaged.dropped.length)} من خطوات الخطة`
              : `${String(turn.salvaged.dropped.length)} step${
                  turn.salvaged.dropped.length === 1 ? '' : 's'
                } dropped from this plan`}
          </summary>
          {/* The door's own reason, per step. Not a summary of them: a person
              deciding whether to ask again needs to know WHICH refusal it was. */}
          <ul className="pg-chat__steps">
            {turn.salvaged.dropped.map((step) => (
              <li key={`${turn.id}-dropped-${String(step.step)}`}>
                <span className="pg-chat__step-title">
                  {locale === 'ar' ? `الخطوة ${String(step.step)}` : `Step ${String(step.step)}`} ·{' '}
                  {step.command}
                </span>
                <code className="pg-chat__step-cmd">{step.reason}</code>
              </li>
            ))}
          </ul>
        </details>
      )}
      <details className="pg-chat__details">
        <summary>{locale === 'ar' ? 'تفاصيل التغييرات' : 'Change details'}</summary>
        {turn.skills === undefined || turn.skills.length === 0 ? null : (
          <ul aria-label="Activated Skills" className="pg-chat__steps">
            {turn.skills.map((skill) => (
              <li key={`${turn.id}-${skill.id}`}>
                <span className="pg-chat__step-title">
                  {skill.id} · v{skill.version} · {shortSkillFingerprint(skill.contentFingerprint)}
                </span>
                <code className="pg-chat__step-cmd">{skill.reason}</code>
              </li>
            ))}
          </ul>
        )}
        {/* Each step in a person's words; the exact command rides along in mono as
        the technical truth, never the headline. */}
        <ol className="pg-chat__steps">
          {turn.plan.commands.map((step, index) => (
            <li key={`${turn.id}-${String(index)}`}>
              <span className="pg-chat__step-title">{describeStep(step)}</span>
              <code className="pg-chat__step-cmd">{step.command}</code>
            </li>
          ))}
        </ol>
        <StageTimings run={turn.run} />
      </details>
      {turn.applied ? (
        <p className="pg-chat__applied">
          <IconCheck />
          Applied as one change.{' '}
          {revived ? null : canWrite ? (
            <ChromeButton variant="quiet" size="sm" onClick={onUndo}>
              <IconUndo />
              Undo
            </ChromeButton>
          ) : (
            <span className="pg-chat__plan-only">Planning only — switch mode to undo.</span>
          )}
        </p>
      ) : (
        <div className="pg-chat__decide">
          {/*
            Hidden when the plan was PROPOSED in Plan mode, and when the panel is
            in Plan mode NOW. The second is the one that was missing: a proposal
            made in Ask kept its Apply after the person switched to Plan.
            `accept` refuses either way — this only stops the panel from offering
            what it would refuse.
          */}
          {proposedMode === 'plan' || mode === 'plan' || revived ? null : (
            <ChromeButton variant="primary" onClick={onApply}>
              <IconCheck />
              Apply
            </ChromeButton>
          )}
          {revived ? null : (
            <ChromeButton variant="quiet" size="sm" onClick={onPreview}>
              <IconEye />
              Preview
            </ChromeButton>
          )}
          {onReviewAsCode === undefined ? null : (
            <ChromeButton variant="quiet" size="sm" onClick={onReviewAsCode}>
              <IconCode />
              Review as code
            </ChromeButton>
          )}
          <ChromeButton
            variant="quiet"
            size="sm"
            className="pg-chat__decide-discard"
            onClick={onDiscard}
          >
            <IconClose />
            Discard
          </ChromeButton>
          {revived ? (
            <p className="pg-chat__refused">
              This saved proposal expired after reload. Ask again to revalidate it.
            </p>
          ) : null}
        </div>
      )}
      {/*
        The plan's own "and next…" is NOT drawn here any more.

        It moved to the suggestion strip above the composer, which is the one
        place a person is deciding what to say next — and, unlike a card inside
        the log, it does not scroll away the moment the next message arrives.
        Drawing it in both places put two identical buttons for one action on
        screen at once.
      */}
    </div>
  );
}
