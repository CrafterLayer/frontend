import { cx } from '../section-classes';

import { committed, sharedText } from '../Chart/chart-drawing';
import { formatValue } from '../Chart/chart-format';
import { MetricTrend } from '../MetricTrend';
import { valueText } from '../Chart/chart-keys';
import type { KpiDirection, KpiModel, ReportView } from './report-model';

/* Written out in full: Tailwind finds a class only where it appears literally. */
const CARD_CLASSES = {
  card: 'rounded-xl border border-current/10 bg-surface p-4 shadow-soft @md:p-5',
  plain: 'border-s-2 border-current/15 ps-4',
} as const;

/* The arrow carries the direction for everyone; colour only adds whether it is good. */
const ARROWS: Readonly<Record<KpiDirection, string>> = { up: '▲', down: '▼', flat: '–' };

/**
 * The KPI cards: each card's label, its number (with the report's prefix and
 * suffix), and — for a `last` KPI — an arrow, the signed change against the
 * previous row and the change label. A good change wears the success role;
 * a bad one keeps the ink, because no theme role means "bad", and the arrow
 * and sign already say which way it went.
 */
export function kpiCards(kpis: readonly KpiModel[], view: ReportView) {
  const { props, part, values, hosts, muted, ink } = view;
  return (
    <ul
      {...part('kpis', {
        className: cx(
          'm-0 grid list-none grid-cols-1 gap-gap p-0',
          kpis.length > 1 ? '@sm:grid-cols-2' : undefined,
          kpis.length === 3 ? '@4xl:grid-cols-3' : kpis.length > 3 ? '@4xl:grid-cols-4' : undefined,
        ),
      })}
      data-report-kpis=""
    >
      {kpis.map((kpi) => {
        const change = kpi.change;
        const config = props.kpis[kpi.index];
        if (config === undefined) return null;
        const target = kpi.target;
        const baseline = kpi.comparisonValue;
        const baselineDigits = baseline === undefined ? '' : formatValue(baseline);
        const targetDigits = target === undefined ? '' : formatValue(target.value);
        const percent =
          target?.percent === undefined
            ? undefined
            : target.percent < 1_000_000
              ? Math.round(target.percent * 10) / 10
              : target.percent;
        const targetText =
          target === undefined
            ? ''
            : `${committed(props.targetLabel ?? 'Target')}: ${config.better === 'down' ? '≤' : '≥'} ${kpi.unitless ? '' : committed(props.valuePrefix)}${targetDigits}${kpi.unitless ? '' : committed(props.valueSuffix)}`;
        return (
          /* Keyed by position: a bound value may be an inline editor element. */
          <li
            key={kpi.index}
            {...part('kpi', {
              index: [kpi.index],
              className: cx('flex min-w-0 flex-col gap-gap-xs', CARD_CLASSES[props.variant]),
            })}
          >
            <span
              {...part('kpi.label', {
                index: [kpi.index],
                className: cx('text-sm leading-snug', muted),
              })}
            >
              {props.kpis[kpi.index]?.label}
            </span>
            <span
              className={cx(
                'text-3xl leading-none font-bold tracking-tight tabular-nums @md:text-4xl',
                ink,
              )}
              data-report-value=""
            >
              {kpi.value === undefined
                ? '–'
                : kpi.unitless
                  ? kpi.digits
                  : valueText(
                      kpi.digits,
                      values,
                      hosts.affixes === 'kpis' && hosts.affixKpi === kpi.index,
                    )}
            </span>
            {props.showTrends === true ? (
              <MetricTrend values={kpi.trend} label={committed(config.label)} />
            ) : null}
            {change === undefined && baseline === undefined ? null : (
              <span
                className={cx(
                  'inline-flex flex-wrap items-baseline gap-x-gap-xs text-sm',
                  change?.good === true ? 'text-success' : change?.good === false ? ink : muted,
                )}
                data-report-change={change?.direction}
                data-report-good={change?.good === undefined ? undefined : String(change.good)}
              >
                {change === undefined ? null : (
                  <>
                    <span aria-hidden="true">{ARROWS[change.direction]}</span>
                    <span className="font-semibold tabular-nums">{change.text}</span>
                  </>
                )}
                {baseline === undefined ? (
                  <span {...part('changeLabel', { className: muted })}>
                    {sharedText(props.changeLabel, hosts.changeKpi === kpi.index)}
                  </span>
                ) : (
                  <>
                    <span {...part('comparisonLabel', { className: muted })}>
                      {sharedText(
                        props.comparisonLabel ?? 'vs baseline',
                        hosts.comparisonKpi === kpi.index,
                      )}
                    </span>
                    <span className={cx('tabular-nums', muted)} data-report-baseline="">
                      {kpi.unitless
                        ? baselineDigits
                        : valueText(
                            baselineDigits,
                            values,
                            hosts.affixes === 'kpis' &&
                              hosts.affixKpi === kpi.index &&
                              kpi.value === undefined,
                          )}
                    </span>
                  </>
                )}
              </span>
            )}
            {target === undefined ? null : (
              <div
                className="flex flex-col gap-2 text-xs"
                data-report-target={target.met ? 'met' : 'unmet'}
              >
                <div className={cx('flex flex-wrap items-baseline gap-x-2 gap-y-1', muted)}>
                  <span role="img" aria-label={target.met ? 'Target met' : 'Target not met'}>
                    {target.met ? '✓' : '○'}
                  </span>
                  <span>
                    <span {...part('targetLabel')}>
                      {sharedText(props.targetLabel ?? 'Target', hosts.targetKpi === kpi.index)}
                    </span>
                    {': '}
                    {config.better === 'down' ? '≤' : '≥'}{' '}
                    {kpi.unitless ? targetDigits : valueText(targetDigits, values, false)}
                  </span>
                  {percent === undefined ? null : (
                    <span className="font-semibold tabular-nums">{formatValue(percent)}%</span>
                  )}
                </div>
                {percent === undefined ? null : (
                  <div
                    role="progressbar"
                    aria-label={`${committed(config.label)} — ${targetText}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.min(100, percent)}
                    aria-valuetext={`${String(percent)}% (${targetText})`}
                    className="flex h-1.5 overflow-hidden rounded-full bg-current/10"
                  >
                    <span
                      className="h-full rounded-full bg-accent"
                      style={{ inlineSize: `${String(Math.min(100, percent))}%` }}
                    />
                  </div>
                )}
              </div>
            )}
            {config.detail === undefined ? null : (
              <span
                {...part('kpi.detail', {
                  index: [kpi.index],
                  className: cx('text-xs leading-relaxed', muted),
                })}
              >
                {config.detail}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
