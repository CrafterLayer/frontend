import { Fragment, useId, useState, type ReactNode, type Ref } from 'react';

import { formatClock, t, tParts, UNDO_UNAVAILABLE_KEY, type Key } from '../../copy';
import { resolveLang } from '../../model/resolve-dir';
import type {
  AgentController,
  CopyParams,
  EditPhase,
  EditRecordView,
  Locale,
  RecordMenuItem,
} from '../../model/view-types';
import { RecordButton } from '../BuildRecord/RecordButton';
import { RecordLead } from '../BuildRecord/RecordLead';
import { ChangeLines } from '../ChangeLines';
import { RecordMenu, type RecordMenuProps } from '../RecordMenu';
import type { RunGlyphState } from '../RunGlyph';
import { RunRecord, type RecordMetaItem } from '../RunRecord';

import './EditRecord.css';

/** The controller actions an edit record calls: history, and showing the change on the page. */
export type EditRecordActions = Pick<
  AgentController,
  'undoEdit' | 'redoEdit' | 'reveal' | 'openPageHistory'
>;

export interface EditRecordProps {
  readonly locale: Locale;
  readonly view: EditRecordView;
  readonly actions: EditRecordActions;
  /** The `[⋯]` menu's choice: Restore page…, Reuse request, Copy summary (the caller runs it). */
  readonly onMenuSelect: (item: RecordMenuItem) => void;
  /** Where focus goes after a menu item runs, when not back to `[⋯]` (Reuse → the composer). */
  readonly menuFocusAfter?: RecordMenuProps['focusAfterSelect'];
  readonly menuTriggerRef?: Ref<HTMLButtonElement> | undefined;
  /** The record's heading, for callers that send focus to it (Run this plan, SPEC §6.3). */
  readonly headingRef?: Ref<HTMLHeadingElement> | undefined;
  /** Appended to `ck-agent-record ck-agent-edit`. */
  readonly className?: string | undefined;
}

/**
 * Ink means landed: only a change that landed takes the Indigo disc. One that matched the
 * page already, was stopped, or was undone is not on the page, and says so with the dashed ring.
 */
const GLYPH = {
  running: 'working',
  done: 'landed',
  noChange: 'absent',
  stopped: 'absent',
  undone: 'absent',
} as const satisfies Readonly<Record<EditPhase, RunGlyphState>>;

/**
 * Under a second a clock says nothing but "0:00", which reads as a fault. A direct edit (the
 * engine's `source: 'direct'`, no model call) lands that fast, and shows no time at all.
 */
const INSTANT_MS = 1_000;

function titleOf(view: EditRecordView): { readonly key: Key; readonly params: CopyParams } {
  const target = view.target;
  switch (view.phase) {
    case 'running':
      return target === undefined
        ? { key: 'edit.title.runningPage', params: {} }
        : { key: 'edit.title.running', params: { target } };
    case 'done':
      if (view.origin === 'proposal') {
        return target === undefined
          ? { key: 'proposal.appliedPage', params: {} }
          : { key: 'proposal.applied', params: { target } };
      }
      return target === undefined
        ? { key: 'edit.title.donePage', params: {} }
        : { key: 'edit.title.done', params: { target } };
    case 'noChange':
      return target === undefined
        ? { key: 'edit.title.noChangePage', params: {} }
        : { key: 'edit.title.noChange', params: { target } };
    case 'stopped':
      return { key: 'edit.title.stopped', params: {} };
    case 'undone':
      return { key: 'edit.undone', params: {} };
  }
}

/**
 * One edit run (SPEC §4.9, §3.6, §3.8): the request's target in the title ("Editing Hero",
 * "Hero updated"), and while it runs one live line holding the mapped stage phrase ("Checking
 * the change…"), never the provider's narration. Done, it shows what changed as ChangeLines
 * (label, before → after, three lines then "Show all changes"), then "Show on page" and Undo.
 *
 * Undo is a history action in every mode. It and Redo are one button whose label follows the
 * state, so focus stays on it when the undo lands. When history can no longer undo it (after a
 * reload, or once the page moved on), it stays in place `aria-disabled`, described by the line
 * that says why.
 *
 * A direct edit arrives already done: no stages, no live line, no time under a second.
 */
export function EditRecord({
  locale,
  view,
  actions,
  onMenuSelect,
  menuFocusAfter,
  menuTriggerRef,
  headingRef,
  className,
}: EditRecordProps) {
  const reasonId = useId();
  const [live] = useState(() => view.phase === 'running');
  const { turnId, phase, target } = view;

  const { key, params } = titleOf(view);
  const targetLang = target === undefined ? locale : resolveLang(target, locale);
  const title = tParts(locale, key, params).map((part, index) =>
    part.kind === 'value' ? (
      <bdi key={index} lang={targetLang === locale ? undefined : targetLang}>
        {part.text}
      </bdi>
    ) : (
      <Fragment key={index}>{part.text}</Fragment>
    ),
  );

  const meta: readonly RecordMetaItem[] =
    phase === 'running' || view.elapsedMs === undefined || view.elapsedMs < INSTANT_MS
      ? []
      : [{ text: formatClock(view.elapsedMs) }];

  /* ── Body ─────────────────────────────────────────────────────────────── */

  const body: ReactNode[] = [];
  switch (phase) {
    case 'running':
      body.push(
        <RecordLead key="lead" segment={{ state: 'indeterminate', to: 'end' }}>
          <p className="ck-agent-lead__live">{t(locale, view.stage ?? 'edit.started')}</p>
        </RecordLead>,
      );
      break;
    case 'done':
    case 'undone':
      if (view.changes.length > 0) {
        body.push(<ChangeLines key="changes" locale={locale} changes={view.changes} />);
      } else if (view.unlisted === true) {
        body.push(
          <p key="unlisted" className="ck-agent-edit__line">
            {t(locale, 'edit.unlisted')}
          </p>,
        );
      }
      break;
    case 'noChange':
      body.push(
        <p key="no-change" className="ck-agent-edit__line">
          {t(locale, 'edit.noChange')}
        </p>,
      );
      break;
    case 'stopped':
      body.push(
        <p key="unchanged" className="ck-agent-edit__line">
          {t(locale, 'edit.pageUnchanged')}
        </p>,
      );
      break;
  }

  const undo = phase === 'done' || phase === 'undone' ? view.undo : undefined;
  if (undo?.kind === 'unavailable') {
    body.push(
      <p key="why" id={reasonId} className="ck-agent-edit__caption">
        {t(locale, UNDO_UNAVAILABLE_KEY[undo.why])}
      </p>,
    );
    if (undo.why === 'revived') {
      body.push(
        <RecordButton
          key="history"
          tone="text"
          data-ck-align="text"
          className="ck-agent-edit__history"
          onClick={() => {
            actions.openPageHistory();
          }}
        >
          {t(locale, 'build.pageHistory')}
        </RecordButton>,
      );
    }
  }

  /* ── Footer ───────────────────────────────────────────────────────────── */

  const buttons: ReactNode[] = [];
  const revealNodeId = view.revealNodeId;
  if (phase === 'done' && revealNodeId !== undefined) {
    buttons.push(
      <RecordButton
        key="show"
        tone="text"
        onClick={() => {
          actions.reveal(revealNodeId);
        }}
      >
        {t(locale, 'edit.showOnPage')}
      </RecordButton>,
    );
  }
  if (undo !== undefined) {
    const redo = undo.kind === 'redo' || (undo.kind === 'unavailable' && phase === 'undone');
    const label =
      target === undefined
        ? t(locale, redo ? 'edit.redo' : 'edit.undo')
        : t(locale, redo ? 'row.redo.aria' : 'row.undo.aria', { title: target });
    buttons.push(
      <RecordButton
        key="history-action"
        tone="secondary"
        aria-label={label}
        unavailable={undo.kind === 'unavailable'}
        aria-describedby={undo.kind === 'unavailable' ? reasonId : undefined}
        onClick={() => {
          if (undo.kind === 'undo') actions.undoEdit(turnId);
          else if (undo.kind === 'redo') actions.redoEdit(turnId);
        }}
      >
        {t(locale, redo ? 'edit.redo' : 'edit.undo')}
      </RecordButton>,
    );
  }

  return (
    <RunRecord
      className={className === undefined ? 'ck-agent-edit' : `ck-agent-edit ${className}`}
      data-phase={phase}
      glyph={GLYPH[phase]}
      animateGlyph={live}
      title={title}
      meta={meta}
      headingRef={headingRef}
      actions={buttons.length === 0 ? undefined : buttons}
      menu={
        view.menu.length === 0 ? undefined : (
          <RecordMenu
            locale={locale}
            items={view.menu}
            onSelect={onMenuSelect}
            focusAfterSelect={menuFocusAfter}
            triggerRef={menuTriggerRef}
          />
        )
      }
    >
      {body.length === 0 ? undefined : body}
    </RunRecord>
  );
}
