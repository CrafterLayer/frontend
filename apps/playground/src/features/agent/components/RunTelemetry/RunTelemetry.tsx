import { formatNumber, t, type Key } from '../../copy';
import { cacheMissLine } from '../../copy/cache-labels';
import {
  latestCacheMiss,
  telemetryTotals,
  type OperationalStage,
  type RunTelemetryState,
} from '../../model/run-telemetry';
import type { Locale } from '../../model/view-types';
import './RunTelemetry.css';

export interface RunTelemetryProps {
  readonly locale: Locale;
  readonly state: RunTelemetryState;
  /** False on saved/settled turns: phases remain history, not a busy announcement. */
  readonly live?: boolean;
}
const STAGE_KEY: Readonly<Record<OperationalStage, Key>> = {
  reading: 'run.understanding',
  planning: 'telemetry.planning',
  writing: 'edit.writing',
  checking: 'edit.checking',
  repairing: 'edit.repairing',
  applying: 'edit.applying',
};
const COUNTS = [
  ['inputTokens', 'telemetry.input'],
  ['outputTokens', 'telemetry.output'],
  ['cacheReadTokens', 'telemetry.cacheRead'],
  ['cacheWriteTokens', 'telemetry.cacheWrite'],
] as const;

/** Bounded public work phases and actual measurements, separate from context estimates. */
export function RunTelemetry({ locale, state, live = false }: RunTelemetryProps) {
  const totals = telemetryTotals(state);
  // Why the cache was written instead of read (2026-10-13): the server's cause, said plainly.
  const miss = latestCacheMiss(state);
  const latest = state.activity.at(-1);
  /*
    Usage is drawn only when the provider reported a count (2026-10-12): four cells reading
    "Not reported" took a quarter of a narrow thread and said nothing. A missing count beside
    a reported one still reads "Not reported", so a partial total never passes as whole.
  */
  const reported = totals.requests > 0 && COUNTS.some(([field]) => totals[field] !== null);
  if (latest === undefined && !reported) return null;
  if (!live && state.activity.length === 0 && !reported) return null;
  return (
    <section className="ck-agent-telemetry" aria-label={t(locale, 'telemetry.activity')}>
      {latest === undefined || !live ? null : (
        <p className="ck-agent-telemetry__live" role="status" aria-atomic="true">
          {latest.scope === undefined ? null : <bdi>{latest.scope} · </bdi>}
          {t(locale, STAGE_KEY[latest.stage])}
        </p>
      )}
      {state.activity.length < (live ? 2 : 1) ? null : (
        <details className="ck-agent-telemetry__history">
          <summary>{t(locale, 'telemetry.activity')}</summary>
          <ol>
            {state.activity.slice(-16).map((item, index) => (
              <li key={index}>
                {item.scope === undefined ? null : <bdi>{item.scope} · </bdi>}
                {t(locale, STAGE_KEY[item.stage])}
              </li>
            ))}
          </ol>
        </details>
      )}
      {!reported ? null : (
        <div className="ck-agent-telemetry__usage">
          <p>{t(locale, 'telemetry.usage')}</p>
          <dl>
            {COUNTS.map(([field, key]) => (
              <div key={field}>
                <dt>{t(locale, key)}</dt>
                <dd>
                  <bdi dir="ltr">
                    {totals[field] === null
                      ? t(locale, 'telemetry.unknown')
                      : formatNumber(locale, totals[field])}
                  </bdi>
                </dd>
              </div>
            ))}
          </dl>
          {totals.cachedReplies === 0 ? null : (
            <p>{t(locale, 'telemetry.cached', { n: totals.cachedReplies })}</p>
          )}
          {miss === undefined ? null : (
            <p className="ck-agent-telemetry__cache-miss">{cacheMissLine(locale, miss)}</p>
          )}
          {totals.costUsd == null ? null : (
            <p>
              {t(locale, 'telemetry.cost')}: <bdi dir="ltr">{totals.costUsd.toFixed(4)}</bdi>
            </p>
          )}
        </div>
      )}
    </section>
  );
}
