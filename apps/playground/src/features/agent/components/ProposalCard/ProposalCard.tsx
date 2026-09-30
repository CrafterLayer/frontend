import { Fragment, useRef, type KeyboardEvent, type ReactNode, type Ref } from 'react';

import { t, tParts, type Key } from '../../copy';
import { resolveLang } from '../../model/resolve-dir';
import type {
  AgentController,
  CopyParams,
  Locale,
  ProposalView,
  RecordMenuItem,
} from '../../model/view-types';
import { RecordButton } from '../BuildRecord/RecordButton';
import { RecordLead } from '../BuildRecord/RecordLead';
import { ChangeLines } from '../ChangeLines';
import { IconButton } from '../IconButton';
import { focusAfterAnswer } from '../PagePlanCard/answer-focus';
import { DecisionCard } from '../PagePlanCard/DecisionCard';
import { RecordMenu } from '../RecordMenu';
import { RunRecord } from '../RunRecord';

import './ProposalCard.css';

/** The controller actions a proposal calls. */
export type ProposalCardActions = Pick<AgentController, 'apply' | 'discard' | 'togglePreview'>;

export interface ProposalCardProps {
  readonly locale: Locale;
  readonly view: ProposalView;
  readonly actions: ProposalCardActions;
  /** The `[⋯]` menu's choice (`view.menu`: View as code); the caller runs it. */
  readonly onMenuSelect: (item: RecordMenuItem) => void;
  /** `[⋯]`, which a dialog opened from the menu returns focus to. */
  readonly menuTriggerRef?: Ref<HTMLButtonElement> | undefined;
  /** Appended to `ck-agent-card ck-agent-proposal`. */
  readonly className?: string | undefined;
}

function titleOf(view: ProposalView): { readonly key: Key; readonly params: CopyParams } {
  return view.target === undefined
    ? { key: 'proposal.title.page', params: {} }
    : { key: 'proposal.title', params: { target: view.target } };
}

/**
 * Ask mode's proposed edit, waiting for the person (SPEC §4.13 ProposalCard, frame §3.8):
 *
 *   ◇ Proposed change: FAQ
 *     Heading  “FAQ” → “Questions patients ask”
 *     The page hasn't changed yet.                 the honesty line, only while true
 *   [ Apply ]  Discard                   [◫] [⋯]   Preview toggle; View as code
 *
 * A decision surface, so boxed until it is answered. The head is the decision diamond and
 * the target by its human name; the changes are ChangeLines, in schema labels and the
 * page's own words. Two lines may follow them:
 * - the honesty line, "The page hasn't changed yet.", rendered ONLY while it is true: the
 *   proposal is unapplied and the run wrote nothing (`view.pageUnchanged`, SPEC §6.5);
 * - when validation dropped some changes, an Amber line saying how many survived.
 *
 * It never shows a token or cost estimate (SPEC §7.4: telemetry and Technical details only).
 * The owner once saw "تقدير: ~11.3k توكن" on a one-step plan; that line does not exist here.
 *
 * Preview is a toggle (`aria-pressed`) that shows the proposal on the canvas without
 * writing it; Esc inside the card ends a preview. Answering names where focus goes (SPEC
 * §6.3): Apply → the resulting record's Undo; Discard → the composer.
 */
export function ProposalCard({
  locale,
  view,
  actions,
  onMenuSelect,
  menuTriggerRef,
  className,
}: ProposalCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLButtonElement>(null);
  const { turnId } = view;

  const { key, params } = titleOf(view);
  const target = view.target;
  const targetLang = target === undefined ? locale : resolveLang(target, locale);
  const title: ReactNode = tParts(locale, key, params).map((part, index) =>
    part.kind === 'value' ? (
      <bdi key={index} lang={targetLang === locale ? undefined : targetLang}>
        {part.text}
      </bdi>
    ) : (
      <Fragment key={index}>{part.text}</Fragment>
    ),
  );

  if (view.status === 'drafting') {
    return (
      <RunRecord
        className={
          className === undefined
            ? 'ck-agent-proposal-drafting'
            : `ck-agent-proposal-drafting ${className}`
        }
        glyph="working"
        title={title}
      >
        <RecordLead segment={{ state: 'indeterminate', to: 'end' }}>
          <p className="ck-agent-lead__live">{t(locale, 'proposal.drafting')}</p>
        </RecordLead>
      </RunRecord>
    );
  }

  const nothingToApply = view.partial?.kept === 0;

  const apply = () => {
    if (nothingToApply) return;
    const card = cardRef.current;
    actions.apply(turnId);
    if (card !== null) focusAfterAnswer(card, 'undo', locale);
  };

  const discard = () => {
    const card = cardRef.current;
    actions.discard(turnId);
    if (card !== null) focusAfterAnswer(card, 'composer', locale);
  };

  // Esc ends a preview (SPEC §6.7), and focus lands on the toggle that started it.
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape' || !view.previewing || event.defaultPrevented) return;
    event.preventDefault();
    event.stopPropagation();
    actions.togglePreview(turnId);
    previewRef.current?.focus();
  };

  return (
    <DecisionCard
      className={className === undefined ? 'ck-agent-proposal' : `ck-agent-proposal ${className}`}
      cardRef={cardRef}
      glyph="decision"
      title={title}
      data-previewing={view.previewing ? '' : undefined}
      onKeyDown={onKeyDown}
    >
      {view.changes.length === 0 && view.partial === undefined && !view.pageUnchanged ? null : (
        <div className="ck-agent-card__body">
          {view.changes.length === 0 ? null : (
            <ChangeLines locale={locale} changes={view.changes} />
          )}
          {view.partial === undefined ? null : (
            <p className="ck-agent-card__meta ck-agent-proposal__partial" data-tone="warning">
              {t(locale, 'proposal.partial', {
                kept: view.partial.kept,
                total: view.partial.total,
              })}
            </p>
          )}
          {view.pageUnchanged ? (
            <p className="ck-agent-card__meta ck-agent-proposal__unchanged">
              {t(locale, 'proposal.unchanged')}
            </p>
          ) : null}
        </div>
      )}
      <div className="ck-agent-card__footer">
        <div className="ck-agent-card__actions">
          <RecordButton tone="primary" unavailable={nothingToApply} onClick={apply}>
            {t(locale, 'proposal.apply')}
          </RecordButton>
          <RecordButton tone="text" onClick={discard}>
            {t(locale, 'proposal.discard')}
          </RecordButton>
        </div>
        <div className="ck-agent-card__tools">
          <IconButton
            ref={previewRef}
            icon="preview"
            label={t(locale, 'proposal.preview')}
            hint={view.previewing ? t(locale, 'proposal.preview.end') : undefined}
            pressed={view.previewing}
            tooltipSide="top"
            tooltipAlign="end"
            className="ck-agent-proposal__preview"
            onClick={() => {
              actions.togglePreview(turnId);
            }}
          />
          <RecordMenu
            locale={locale}
            items={view.menu}
            onSelect={onMenuSelect}
            triggerRef={menuTriggerRef}
          />
        </div>
      </div>
    </DecisionCard>
  );
}
