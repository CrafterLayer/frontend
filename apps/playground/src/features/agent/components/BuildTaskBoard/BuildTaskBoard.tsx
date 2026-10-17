import { t } from '../../copy';
import type { BuildPhase, Locale, SpineRowView } from '../../model/view-types';

import './BuildTaskBoard.css';

export interface BuildTaskBoardProps {
  readonly locale: Locale;
  readonly rows: readonly SpineRowView[];
  /** The engine's actual pool limit; null for records that did not retain it. */
  readonly writers: number | null;
  readonly phase: BuildPhase;
}

/** A compact account of real work. A drafted section is never applied progress. */
export function BuildTaskBoard({ locale, rows, writers, phase }: BuildTaskBoardProps) {
  if (rows.length === 0) return null;
  const live = phase === 'building' || phase === 'stopping';
  const active = rows.filter((row) => row.state === 'writing' || row.state === 'retrying').length;
  const queued = rows.filter((row) => row.state === 'planned' || row.state === 'waiting').length;
  const drafted = rows.filter((row) => row.state === 'drafted').length;
  const applied = rows.filter((row) => row.state === 'landed').length;
  const failed = rows.filter((row) => row.state === 'failed').length;
  const capacity =
    writers !== null && Number.isSafeInteger(writers) && writers > 0 ? writers : null;

  return (
    <section className="ck-agent-tasks" aria-label={t(locale, 'tasks.label')}>
      <div className="ck-agent-tasks__head">
        <span className="ck-agent-tasks__coordinator">{t(locale, 'tasks.coordinator')}</span>
        {live ? (
          <span className="ck-agent-tasks__active">{t(locale, 'tasks.active', { n: active })}</span>
        ) : null}
        {live && capacity !== null ? <span>{t(locale, 'tasks.pool', { n: capacity })}</span> : null}
      </div>
      <progress
        className="ck-agent-tasks__progress"
        aria-label={t(locale, 'tasks.progress', { n: applied, total: rows.length })}
        max={rows.length}
        value={applied}
      />
      <div className="ck-agent-tasks__counts">
        <span className="ck-agent-tasks__applied">
          {t(locale, 'tasks.applied', { n: applied })}
        </span>
        {live && queued > 0 ? <span>{t(locale, 'tasks.queued', { n: queued })}</span> : null}
        {live && drafted > 0 ? <span>{t(locale, 'tasks.drafted', { n: drafted })}</span> : null}
        {failed > 0 ? <span>{t(locale, 'tasks.failed', { n: failed })}</span> : null}
      </div>
    </section>
  );
}
