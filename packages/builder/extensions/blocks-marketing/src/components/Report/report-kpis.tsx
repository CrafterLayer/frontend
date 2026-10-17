import { cx } from '../section-classes';

import { sharedText } from '../Chart/chart-drawing';
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
        className: 'm-0 grid list-none grid-cols-1 gap-gap p-0 @sm:grid-cols-2 @4xl:grid-cols-4',
      })}
      data-report-kpis=""
    >
      {kpis.map((kpi) => {
        const change = kpi.change;
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
                : valueText(
                    kpi.digits,
                    values,
                    hosts.affixes === 'kpis' && hosts.affixKpi === kpi.index,
                  )}
            </span>
            {change === undefined ? null : (
              <span
                className={cx(
                  'inline-flex flex-wrap items-baseline gap-x-gap-xs text-sm',
                  change.good === true ? 'text-success' : change.good === false ? ink : muted,
                )}
                data-report-change={change.direction}
                data-report-good={change.good === undefined ? undefined : String(change.good)}
              >
                <span aria-hidden="true">{ARROWS[change.direction]}</span>
                <span className="font-semibold tabular-nums">{change.text}</span>
                <span {...part('changeLabel', { className: muted })}>
                  {sharedText(props.changeLabel, hosts.changeKpi === kpi.index)}
                </span>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
