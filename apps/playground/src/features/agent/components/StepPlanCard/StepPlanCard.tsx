import { useRef } from 'react';

import { formatNumber, t, tParts } from '../../copy';
import { resolveDir, resolveLang } from '../../model/resolve-dir';
import type { AgentController, Locale, StepPlanView, StepView } from '../../model/view-types';
import { RecordButton } from '../BuildRecord/RecordButton';
import { RecordLead } from '../BuildRecord/RecordLead';
import { focusAfterAnswer } from '../PagePlanCard/answer-focus';
import { DecisionCard } from '../PagePlanCard/DecisionCard';
import { RunRecord } from '../RunRecord';

import './StepPlanCard.css';

/** The controller actions a change plan calls. */
export type StepPlanCardActions = Pick<AgentController, 'runSteps' | 'discard'>;

export interface StepPlanCardProps {
  readonly locale: Locale;
  readonly view: StepPlanView;
  readonly actions: StepPlanCardActions;
  /** Appended to `ck-agent-card ck-agent-steps`. */
  readonly className?: string | undefined;
}

/** One step of the list: its number in the glyph column, its words, the block it touches. */
function stepItem(locale: Locale, step: StepView, position: number) {
  const uiDir = locale === 'ar' ? 'rtl' : 'ltr';
  const textLang = resolveLang(step.text, locale);
  const target = step.target;
  const targetLang = target === undefined ? locale : resolveLang(target, locale);
  return (
    <li key={step.key} className="ck-agent-steps__step">
      <span className="ck-agent-steps__number" aria-hidden="true">
        {formatNumber(locale, position)}
      </span>
      <span
        className="ck-agent-steps__text"
        dir={resolveDir(step.text, uiDir)}
        lang={textLang === locale ? undefined : textLang}
      >
        {step.text}
      </span>
      {target === undefined ? null : (
        <span className="ck-agent-steps__target">
          {tParts(locale, 'steps.target', { target }).map((part, index) =>
            part.kind === 'value' ? (
              <bdi key={index} lang={targetLang === locale ? undefined : targetLang}>
                {part.text}
              </bdi>
            ) : (
              part.text
            ),
          )}
        </span>
      )}
    </li>
  );
}

/**
 * Plan mode's answer to an edit request (SPEC §4.12 StepPlanCard): the steps the change
 * would take, read-only and numbered, each naming the block it touches, and "Run this plan".
 *
 *   ◇ Change plan
 *   1 Rename the heading to “Questions patients ask”
 *     In FAQ
 *   2 Add a WhatsApp button under the answers
 *     In FAQ
 *   [ Run this plan ]  Discard
 *   Nothing changes until the plan runs.
 *
 * The same box as ProposalCard. The numbers stand in the glyph column under the diamond and
 * the steps start on the title's edge, so the card reads as one column of text. "Run this
 * plan" runs the request once with authority to apply; the chosen mode does not change.
 * It removes Plan mode's old dead end: a plan that could only be read.
 *
 * Answering names where focus goes (SPEC §6.3): Run this plan → the new edit record's head,
 * the same turn; Discard → the composer.
 */
export function StepPlanCard({ locale, view, actions, className }: StepPlanCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const { turnId } = view;

  if (view.status === 'drafting') {
    return (
      <RunRecord
        className={
          className === undefined
            ? 'ck-agent-steps-drafting'
            : `ck-agent-steps-drafting ${className}`
        }
        glyph="working"
        title={t(locale, 'steps.title')}
      >
        <RecordLead segment={{ state: 'indeterminate', to: 'end' }}>
          <p className="ck-agent-lead__live">{t(locale, 'plan.drafting')}</p>
        </RecordLead>
      </RunRecord>
    );
  }

  const run = () => {
    const card = cardRef.current;
    actions.runSteps(turnId);
    if (card !== null) focusAfterAnswer(card, 'head', locale);
  };

  const discard = () => {
    const card = cardRef.current;
    actions.discard(turnId);
    if (card !== null) focusAfterAnswer(card, 'composer', locale);
  };

  return (
    <DecisionCard
      className={className === undefined ? 'ck-agent-steps' : `ck-agent-steps ${className}`}
      cardRef={cardRef}
      glyph="decision"
      title={t(locale, 'steps.title')}
    >
      <ol
        // WebKit drops list semantics from a list styled without markers.
        role="list"
        aria-label={t(locale, 'steps.label')}
        className="ck-agent-card__body ck-agent-steps__list"
      >
        {view.steps.map((step, index) => stepItem(locale, step, index + 1))}
      </ol>
      <div className="ck-agent-card__footer">
        <div className="ck-agent-card__actions">
          <RecordButton tone="primary" unavailable={view.steps.length === 0} onClick={run}>
            {t(locale, 'steps.run')}
          </RecordButton>
          <RecordButton tone="text" onClick={discard}>
            {t(locale, 'steps.discard')}
          </RecordButton>
        </div>
        <p className="ck-agent-card__note">{t(locale, 'steps.note')}</p>
      </div>
    </DecisionCard>
  );
}
