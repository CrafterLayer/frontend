/*
  BuildRecord's phase sets and head lines (split from BuildRecord.tsx, 2026-10-12): which
  phases are live, folded or show the direction, the head's figures and the caption line.
*/

import { formatClock, formatNumber, t, tAnnounce } from '../../copy';
import type { BuildPhase, BuildRecordView, Locale } from '../../model/view-types';
import type { RecordMetaItem } from '../RunRecord';

/** Phases in which the build is still being written. */
export const LIVE: ReadonlySet<BuildPhase> = new Set(['skeleton', 'building', 'stopping']);

/**
 * Phases whose sections sit behind "Show sections" from the start: nothing of the build is on
 * the page, and the record's own lines (the failure, "Build undone") are the news.
 */
export const FOLDED: ReadonlySet<BuildPhase> = new Set(['failed', 'undone']);

/** Where the DirectionLine shows (SPEC §4.8 phase table: building, done; a stop changes nothing). */
export const WITH_DIRECTION: ReadonlySet<BuildPhase> = new Set(['building', 'stopping', 'done']);

/** The head's figures: the count while live, the final time once settled (SPEC §4.8). */
export function headMeta(locale: Locale, view: BuildRecordView): readonly RecordMetaItem[] {
  switch (view.phase) {
    case 'building':
    case 'stopping':
      return [
        {
          text: `${formatNumber(locale, view.landed)}/${formatNumber(locale, view.total)}`,
          label: tAnnounce(locale, 'build.progress', { done: view.landed, total: view.total }),
        },
      ];
    case 'skeleton':
    case 'interrupted':
      return [];
    default:
      return view.elapsedMs === undefined ? [] : [{ text: formatClock(view.elapsedMs) }];
  }
}

/** The record's caption line (SPEC §4.8 "Caption line(s)"), or null when the phase has none. */
export function captionOf(locale: Locale, view: BuildRecordView): string | null {
  switch (view.phase) {
    case 'done':
    case 'partial':
      return t(locale, 'build.caption.done', { n: view.landed });
    case 'stopped':
      return t(locale, 'build.caption.stopped', {
        n: view.rows.filter((row) => row.state === 'notWritten').length,
      });
    case 'interrupted':
      // The list was not saved: nothing can finish it, and the caption says so.
      return view.actions.finishRest === 0 && view.landed < view.total
        ? t(locale, 'build.caption.notResumable')
        : t(locale, 'build.caption.interrupted', { done: view.landed, total: view.total });
    default:
      return null;
  }
}
