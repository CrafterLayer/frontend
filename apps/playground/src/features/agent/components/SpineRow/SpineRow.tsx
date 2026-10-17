import { useId, type CSSProperties, type ReactNode } from 'react';

import { formatNumber, t, UNDO_UNAVAILABLE_KEY } from '../../copy';
import { resolveLang } from '../../model/resolve-dir';
import type { Locale, SpineRowView } from '../../model/view-types';
import { RecordButton } from '../BuildRecord/RecordButton';
import { IconButton } from '../IconButton';
import { glyphForRow, RunGlyph } from '../RunGlyph';

import './SpineRow.css';
import { SpineSegment } from './SpineSegment';
import { segmentForRow, trailingActionOf } from './spine-segment-state';

/** Arrival stagger (SPEC §5 moment 6): 24ms apart, the ninth row and later all at 8 × 24ms. */
const ARRIVAL_STEP_MS = 24;
const ARRIVAL_CAP = 8;

export interface SpineRowProps {
  readonly locale: Locale;
  readonly row: SpineRowView;
  /**
   * The row below this one. This row draws the stretch of spine between its node and that
   * row's, in that row's state (the stretch above a node takes the node's state, SPEC §3.4).
   * `null` for the last row, which draws nothing below itself.
   */
  readonly next?: Pick<SpineRowView, 'key' | 'state'> | null | undefined;
  /** A live build: the node's arrival motion, the light on a writing stretch, the ink filling. */
  readonly live?: boolean | undefined;
  /** Set when the list has just appeared (`build.planned`): this row's place in the stagger. */
  readonly arrival?: number | undefined;
  /**
   * The id of the record's caption that explains a revived Undo (`build.caption.revived`): an
   * unavailable Undo after a reload is described by it (SPEC §4.8).
   */
  readonly revivedCaptionId?: string | undefined;
  /** Activating the row selects its section on the canvas (phase 1: `kernel.setSelection`). */
  readonly onReveal?: ((nodeId: string) => void) | undefined;
  /** Hover or focus on the row outlines its section (phase 2); `null` when it ends. */
  readonly onPeek?: ((nodeId: string | null) => void) | undefined;
  readonly onUndo?: ((key: string) => void) | undefined;
  readonly onRedo?: ((key: string) => void) | undefined;
  readonly onRetry?: ((key: string) => void) | undefined;
}

/**
 * One section of the page spine (SPEC §4.8 SpineRow): node, number, title and state word,
 * then one trailing action. 32px tall, 44px on a coarse pointer.
 *
 * Two sibling interactive elements, never nested:
 * 1. The row itself, a button while its section exists on the page: it reveals the section,
 *    and it is named in full: "Section 3 of 8: Services, Writing". A section with no node yet
 *    is text, not a button, and says the same sentence to a screen reader.
 * 2. The trailing action: Undo (↺) on a landed row once the build has ended, shown on hover
 *    or focus with a fine pointer and always under a coarse one; Redo on an undone row; Retry,
 *    always shown, on a failed row, whose classified reason reads on a second line in Alarm.
 *
 * Undo and Redo are the same button with a new label, so focus stays on it when a row's Undo
 * lands and it becomes Redo (SPEC §6.3 "Row Undo → the same row's trailing action").
 */
export function SpineRow({
  locale,
  row,
  next = null,
  live = false,
  arrival,
  revivedCaptionId,
  onReveal,
  onPeek,
  onUndo,
  onRedo,
  onRetry,
}: SpineRowProps) {
  const reasonId = useId();
  const stateWord = t(locale, `row.${row.state}`);
  const name = t(locale, 'row.aria', {
    i: row.position,
    n: row.total,
    title: row.title,
    state: stateWord,
  });
  const titleLang = resolveLang(row.title, locale);
  const action = trailingActionOf(row);

  /*
    The second line, in the text column: why a section failed (Alarm), or why its Undo could
    not run (Slate). A revived record's Undo is explained once, by the record's caption.
  */
  let reason: { readonly text: string; readonly tone: 'danger' | 'muted' } | null = null;
  if (row.state === 'failed') {
    reason = { text: t(locale, `reason.${row.reason ?? 'unknown'}`), tone: 'danger' };
  } else if (row.undo?.kind === 'unavailable' && row.undo.why !== 'revived') {
    reason = { text: t(locale, UNDO_UNAVAILABLE_KEY[row.undo.why]), tone: 'muted' };
  }

  /*
    The drawn row. Its parts are the row's grid items directly (the list's columns reach them
    through subgrid). Inside a button they are presentational; outside one, a visually hidden
    sentence speaks for them and they are hidden from assistive technology one by one.
  */
  const drawn = (hidden: boolean): ReactNode => (
    <>
      <RunGlyph state={glyphForRow(row.state)} animate={live} className="ck-agent-spine-row__node" />
      <span className="ck-agent-spine-row__number" aria-hidden={hidden || undefined}>
        {formatNumber(locale, row.position)}
      </span>
      <bdi
        className="ck-agent-spine-row__title"
        lang={titleLang === locale ? undefined : titleLang}
        aria-hidden={hidden || undefined}
      >
        {row.title}
      </bdi>
      <span className="ck-agent-spine-row__state" aria-hidden={hidden || undefined}>
        {stateWord}
      </span>
    </>
  );

  const nodeId = row.nodeId;
  const primary =
    nodeId === undefined ? (
      <div className="ck-agent-spine-row__primary">
        {drawn(true)}
        <span className="bldr-visually-hidden">{name}</span>
      </div>
    ) : (
      <button
        type="button"
        className="ck-agent-spine-row__primary"
        aria-label={name}
        aria-describedby={reason === null ? undefined : reasonId}
        onClick={() => {
          onReveal?.(nodeId);
        }}
        onPointerEnter={() => {
          onPeek?.(nodeId);
        }}
        onPointerLeave={() => {
          onPeek?.(null);
        }}
        onFocus={() => {
          onPeek?.(nodeId);
        }}
        onBlur={() => {
          onPeek?.(null);
        }}
      >
        {drawn(false)}
      </button>
    );

  let trailing: ReactNode = null;
  if (action?.kind === 'retry') {
    trailing = (
      <span className="ck-agent-spine-row__trailing">
        <RecordButton
          tone="text"
          className="ck-agent-spine-row__retry"
          aria-label={t(locale, 'row.retry.aria', { title: row.title })}
          onClick={() => {
            onRetry?.(row.key);
          }}
        >
          {t(locale, 'row.retry')}
        </RecordButton>
      </span>
    );
  } else if (action !== null) {
    // Undo, Redo, or an Undo that cannot run: one button, whose label follows the state.
    const redo =
      action.kind === 'redo' || (action.kind === 'unavailable' && row.state === 'undone');
    let describedBy: string | undefined;
    if (action.kind === 'unavailable') {
      describedBy = action.why === 'revived' ? revivedCaptionId : reasonId;
    }
    trailing = (
      <span
        className="ck-agent-spine-row__trailing"
        // Undo waits for hover or focus under a fine pointer (SPEC §4.8); Redo stays in view.
        data-reveal={redo ? undefined : 'hover'}
      >
        <IconButton
          icon={redo ? 'redo' : 'undo'}
          label={t(locale, redo ? 'row.redo.aria' : 'row.undo.aria', { title: row.title })}
          unavailable={action.kind === 'unavailable'}
          describedBy={describedBy}
          tooltipSide="top"
          tooltipAlign="end"
          onClick={() => {
            if (redo) onRedo?.(row.key);
            else onUndo?.(row.key);
          }}
        />
      </span>
    );
  }

  const style =
    arrival === undefined
      ? undefined
      : ({
          '--ck-agent-arrive-delay': `${String(Math.min(arrival, ARRIVAL_CAP) * ARRIVAL_STEP_MS)}ms`,
        } as CSSProperties);

  return (
    <li
      className="ck-agent-spine-row"
      data-state={row.state}
      data-interactive={nodeId === undefined ? undefined : ''}
      data-live={live ? '' : undefined}
      data-arriving={arrival === undefined ? undefined : ''}
      data-land-key={row.key}
      style={style}
    >
      {next === null ? null : (
        <SpineSegment
          state={segmentForRow(next.state)}
          from="node"
          to="node"
          live={live}
          landKey={next.key}
        />
      )}
      {primary}
      {trailing}
      {reason === null ? null : (
        <span id={reasonId} className="ck-agent-spine-row__reason" data-tone={reason.tone}>
          {reason.text}
        </span>
      )}
    </li>
  );
}
