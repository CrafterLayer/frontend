/**
 * What "Copy" writes for a record: an answer, an error's details, or a summary.
 */
import type { AiRunFailure } from '@craftkit/builder';

import { type Key, t } from '../../copy';
import { landedCount } from '../../model/build-progress';
import type { CopyParams, CopyTarget } from '../../model/view-types';

import type { Flow } from './controller-state';
import { locateTurn } from './turn-plumbing';

/* ── Copy ────────────────────────────────────────────────────────────────────── */

export function copyText(flow: Flow, turnId: string, what: CopyTarget): string | null {
  const turn = locateTurn(flow, turnId)?.turn;
  if (turn === undefined) return null;
  const { locale } = flow.env().options;
  const line = (key: Key, params?: CopyParams): string => t(locale, key, params);
  const details = (failure: AiRunFailure): string =>
    `${failure.source}/${String(failure.code)}${failure.status === undefined ? '' : ` ${String(failure.status)}`}: ${failure.message}`;
  switch (what) {
    case 'answer':
      return turn.kind === 'answer' ? turn.text : null;
    case 'error':
      if (turn.kind === 'error') return details(turn.failure);
      if (turn.kind === 'build' && turn.failure !== undefined) return details(turn.failure);
      return null;
    case 'summary':
      if (turn.kind === 'build') {
        return [
          line('build.caption.done', { n: landedCount(turn.progress) }),
          ...turn.progress.tasks.map((task) => `${String(task.position)}. ${task.title}`),
        ].join('\n');
      }
      if (turn.kind === 'edit') {
        const title =
          turn.target === undefined
            ? line('edit.title.runningPage')
            : line('edit.title.done', { target: turn.target });
        return [
          title,
          ...turn.changes.map((change) =>
            change.kind === 'changed'
              ? `${change.label}: ${change.before} / ${change.after}`
              : `${change.label}: ${change.value}`,
          ),
        ].join('\n');
      }
      return null;
  }
}
