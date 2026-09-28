import type { AnimationEvent } from 'react';

import { t } from '../../copy';
import type { Locale, SpineRowView } from '../../model/view-types';
import { SpineRow, trailingActionOf } from '../SpineRow';

import './SpineList.css';

/** The completion light's keyframes, named so the list hears its own animation end. */
const SWEEP = 'ck-agent-spine-sweep';

export interface SpineListProps {
  readonly locale: Locale;
  readonly rows: readonly SpineRowView[];
  /** For a disclosure's `aria-controls` (Show sections). */
  readonly id?: string | undefined;
  /** A live build: arrivals, the travelling light, the ink filling as sections land. */
  readonly live?: boolean | undefined;
  /** The rows have just appeared (`build.planned`): they arrive in page order. */
  readonly arrive?: boolean | undefined;
  /**
   * Play the completion sweep: one pass of light down the unbroken stroke, first node to
   * last. The record sets it once, when it saw its build become whole (SPEC §5 moment 5).
   */
  readonly sweep?: boolean | undefined;
  /** The sweep has passed; the record drops it, so it never plays again. */
  readonly onSweepEnd?: (() => void) | undefined;
  readonly revivedCaptionId?: string | undefined;
  readonly onReveal?: ((nodeId: string) => void) | undefined;
  readonly onPeek?: ((nodeId: string | null) => void) | undefined;
  readonly onUndo?: ((key: string) => void) | undefined;
  readonly onRedo?: ((key: string) => void) | undefined;
  readonly onRetry?: ((key: string) => void) | undefined;
}

/**
 * The page spine (SPEC §1, §4.8): an `<ol>` named "Page sections", one SpineRow per section
 * in page order. Each row draws the stretch below its node in the next row's state, so the
 * spine is continuous down the glyph column: dashed pencil where sections wait, pale where
 * writers work, Indigo ink where sections are on the page. Ink grows from the top, because
 * the engine lands sections in page order.
 *
 * The list owns the columns its rows share through subgrid, and a trailing column only when
 * some row has an action, so a live build's state words sit flush at the inline end.
 */
export function SpineList({
  locale,
  rows,
  id,
  live = false,
  arrive = false,
  sweep = false,
  onSweepEnd,
  revivedCaptionId,
  onReveal,
  onPeek,
  onUndo,
  onRedo,
  onRetry,
}: SpineListProps) {
  const trailing = rows.some((row) => trailingActionOf(row) !== null);
  return (
    <ol
      id={id}
      // WebKit drops list semantics from a list styled without markers.
      role="list"
      aria-label={t(locale, 'spine.label')}
      className="ck-agent-spine"
      data-trailing={trailing ? '' : undefined}
      data-sweep={sweep ? '' : undefined}
      onAnimationEnd={(event: AnimationEvent<HTMLOListElement>) => {
        if (event.target === event.currentTarget && event.animationName === SWEEP) onSweepEnd?.();
      }}
    >
      {rows.map((row, index) => {
        const next = rows[index + 1];
        return (
          <SpineRow
            key={row.key}
            locale={locale}
            row={row}
            next={next === undefined ? null : next}
            live={live}
            arrival={arrive ? index : undefined}
            revivedCaptionId={revivedCaptionId}
            onReveal={onReveal}
            onPeek={onPeek}
            onUndo={onUndo}
            onRedo={onRedo}
            onRetry={onRetry}
          />
        );
      })}
    </ol>
  );
}
