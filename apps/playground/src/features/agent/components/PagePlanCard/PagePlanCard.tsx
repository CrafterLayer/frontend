import { useId, useMemo, useRef } from 'react';

import { PLAN_PROBLEM_KEY, t } from '../../copy';
import { duplicateSectionKeys, PLAN_MAX_SECTIONS } from '../../model/page-plan-draft';
import { resolveDir, resolveLang } from '../../model/resolve-dir';
import type {
  AgentController,
  FontPairOption,
  Locale,
  PlanOp,
  PlanView,
} from '../../model/view-types';
import { AddSectionRow } from '../AddSectionRow';
import { RecordButton } from '../BuildRecord/RecordButton';
import { RecordLead } from '../BuildRecord/RecordLead';
import { DirectionEditor } from '../DirectionEditor';
import { DirectionLine } from '../DirectionLine';
import { PlanSectionList } from '../PlanSectionList';
import { RunRecord } from '../RunRecord';

import { focusAfterAnswer } from './answer-focus';
import { DecisionCard } from './DecisionCard';
import './PagePlanCard.css';

/** The controller actions a plan card calls. */
export type PagePlanCardActions = Pick<AgentController, 'build' | 'discard' | 'editPlan'>;

export interface PagePlanCardProps {
  readonly locale: Locale;
  readonly view: PlanView;
  readonly actions: PagePlanCardActions;
  /**
   * Whether the plan would take an op (the model's `applyPlanOp` against the turn's draft).
   * Without it the card offers what it can see: moves inside the list, removals down to
   * two, additions up to twelve. With it, an op the engine would refuse for its shape (the
   * header moved below the hero) is offered as unavailable, never silently dropped.
   */
  readonly accepts?: ((op: PlanOp) => boolean) | undefined;
  /** The pairs FontPairMenu offers; the model's curated, engine-verified list by default. */
  readonly fontPairs?: readonly FontPairOption[] | undefined;
  /**
   * SPEC §7.6 E0c: in Ask mode the page's empty layout was written before approval. The card
   * then says so, «جُهّز هيكل الصفحة، ولم يتغيّر شيء آخر.», instead of implying nothing moved.
   */
  readonly layoutPrepared?: boolean | undefined;
  /** Appended to `ck-agent-card ck-agent-plan`. */
  readonly className?: string | undefined;
}

/** The head's `view-transition-name` for the plan-to-build morph (SPEC §5 moment 4). */
export const PLAN_HEAD_TRANSITION_NAME = 'ck-plan-head';

/**
 * The page plan, a decision surface (SPEC §4.11 PagePlanCard, frame §3.7): Plan mode's
 * answer to a page request, and Ask mode's approval for one.
 *
 *   Page plan                       Edited     head: title, tag; the subject in Graphite
 *   Dental clinic, Amman
 *   ─────────────────────────────────────────
 *   Calm, clinical, teal               [✎]     DirectionEditor
 *   ▪ ▪ ▪ ▪ ▪          Reem Kufi / Plex ▾
 *   ─────────────────────────────────────────
 *   ○ 1  Header                    [⠿] [⋯]     PlanSectionList on the pencil spine
 *   ┊ …
 *   +  Add section                             AddSectionRow
 *   ─────────────────────────────────────────
 *   [ Build this page ]  Discard plan          the button IS the approval
 *   Builds exactly the sections shown.
 *
 * What it edits is the engine's structured plan (SPEC §7.6 E6, E7): every change leaves as
 * one `PlanOp` through `editPlan`, the model applies it, and the card renders the view that
 * comes back, "Edited" and the problems included. When the engine cannot take a structured
 * plan (`view.editable` false) the card is read-only: titles, the direction as prose, and a
 * note that says whether the build will follow these sections exactly or re-plan.
 *
 * Build is refused while the plan has a problem (under two sections, over twelve, two
 * sections sharing a name, an unreadable colour pair): the button stays in the tab order,
 * `aria-disabled` and described by the reason written under it in Amber.
 *
 * Answering names where focus goes (SPEC §6.3): Build this page → the new build record's
 * head, the same turn inked in place; Discard plan → the composer.
 */
export function PagePlanCard({
  locale,
  view,
  actions,
  accepts,
  fontPairs,
  layoutPrepared = false,
  className,
}: PagePlanCardProps) {
  const reasonId = useId();
  const cardRef = useRef<HTMLElement>(null);
  const uiDir = locale === 'ar' ? 'rtl' : 'ltr';
  const { turnId, sections, direction, problems, editable } = view;

  const duplicates = useMemo(
    () =>
      problems.includes('duplicateTitle')
        ? duplicateSectionKeys({ subject: view.subject, sections })
        : undefined,
    [problems, sections, view.subject],
  );

  if (view.status === 'drafting') {
    return (
      <RunRecord
        className={
          className === undefined ? 'ck-agent-plan-drafting' : `ck-agent-plan-drafting ${className}`
        }
        glyph="working"
        title={t(locale, 'plan.title')}
      >
        <RecordLead segment={{ state: 'indeterminate', to: 'end' }}>
          <p className="ck-agent-lead__live">{t(locale, 'plan.drafting')}</p>
        </RecordLead>
      </RunRecord>
    );
  }

  const edit = (op: PlanOp) => {
    actions.editPlan(turnId, op);
  };

  const blocked = problems.length > 0;
  const canAdd =
    sections.length < PLAN_MAX_SECTIONS &&
    (accepts?.({ kind: 'add', title: t(locale, 'plan.add') }) ?? true);
  const structured = editable && direction !== undefined && (direction.swatches?.length ?? 0) > 0;

  const tag = view.approval
    ? t(locale, 'plan.tag.approval')
    : view.edited
      ? t(locale, 'plan.tag.edited')
      : undefined;

  const subjectLang = resolveLang(view.subject, locale);
  const subject =
    view.subject === '' ? undefined : (
      <bdi
        dir={resolveDir(view.subject, uiDir)}
        lang={subjectLang === locale ? undefined : subjectLang}
      >
        {view.subject}
      </bdi>
    );

  const build = () => {
    if (blocked) return;
    const card = cardRef.current;
    actions.build(turnId);
    if (card !== null) focusAfterAnswer(card, 'head', locale);
  };

  const discard = () => {
    const card = cardRef.current;
    actions.discard(turnId);
    if (card !== null) focusAfterAnswer(card, 'composer', locale);
  };

  return (
    <DecisionCard
      className={className === undefined ? 'ck-agent-plan' : `ck-agent-plan ${className}`}
      cardRef={cardRef}
      title={t(locale, 'plan.title')}
      tag={tag}
      subject={subject}
      headTransitionName={PLAN_HEAD_TRANSITION_NAME}
      data-edited={view.edited ? '' : undefined}
      data-approval={view.approval ? '' : undefined}
      data-editable={editable ? '' : undefined}
    >
      {direction === undefined ? null : (
        <div className="ck-agent-card__section ck-agent-plan__direction">
          {structured ? (
            <DirectionEditor
              locale={locale}
              direction={direction}
              onEdit={edit}
              fontPairs={fontPairs}
            />
          ) : (
            <DirectionLine locale={locale} direction={direction} />
          )}
        </div>
      )}
      <div className="ck-agent-card__section ck-agent-plan__sections">
        <PlanSectionList
          locale={locale}
          sections={sections}
          editable={editable}
          duplicates={duplicates}
          accepts={accepts}
          onEdit={edit}
          morph
        />
        {editable ? (
          <AddSectionRow
            locale={locale}
            canAdd={canAdd}
            onAdd={(title) => {
              edit({ kind: 'add', title });
            }}
          />
        ) : null}
      </div>
      <div className="ck-agent-card__section ck-agent-card__footer ck-agent-plan__footer">
        <div className="ck-agent-card__actions">
          <RecordButton
            tone="primary"
            unavailable={blocked}
            aria-describedby={blocked ? reasonId : undefined}
            onClick={build}
          >
            {t(locale, 'plan.build')}
          </RecordButton>
          <RecordButton tone="text" onClick={discard}>
            {t(locale, 'plan.discard')}
          </RecordButton>
        </div>
        {blocked ? (
          <div id={reasonId} className="ck-agent-plan__reasons">
            {problems.map((problem) => (
              <p key={problem} className="ck-agent-card__note" data-tone="warning">
                {t(locale, PLAN_PROBLEM_KEY[problem])}
              </p>
            ))}
          </div>
        ) : (
          <>
            {layoutPrepared ? (
              <p className="ck-agent-card__note ck-agent-plan__prepared">
                {t(locale, 'plan.layoutPrepared')}
              </p>
            ) : null}
            <p className="ck-agent-card__note">
              {t(locale, view.note === 'exact' ? 'plan.note' : 'plan.note.mayDiffer')}
            </p>
          </>
        )}
      </div>
    </DecisionCard>
  );
}
