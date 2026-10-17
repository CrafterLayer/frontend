import { cx } from '../section-classes';

import { formatValue } from './chart-format';
import type { Drawing } from './chart-drawing';
import { valueText } from './chart-keys';
import { isTranslucent, toneOf } from './chart-palette';
import { SPARK_VIEW, type SparkRow } from './chart-spark';
import type { ChartProps } from './schema';

const SPARK_HEIGHTS: Readonly<Record<ChartProps['height'], string>> = {
  sm: 'h-8',
  md: 'h-10',
  lg: 'h-14',
};

/**
 * Sparklines: one row per series — its name, a compact trend with a wash and
 * a dot on the last point, and the last value. No axis, grid or category
 * labels: the trend's shape is the message, and the screen-reader table under
 * the image carries every number.
 */
export function sparklineFigure(rows: readonly SparkRow[], drawing: Drawing) {
  const { props, part, svgLabel } = drawing;
  /* The first row with a value hosts the prefix and suffix while they are edited in place. */
  const host = rows.findIndex((row) => row.last !== undefined);
  return (
    <div {...svgLabel} data-chart-plot="sparkline">
      <ul
        {...part('series', { className: 'm-0 flex list-none flex-col gap-gap-sm p-0' })}
        data-chart-legend=""
      >
        {rows.map((row) => {
          const tone = toneOf(props.palette, row.series);
          const dot =
            row.end === undefined ? '' : `M${String(row.end.x)} ${String(row.end.y)}h0.01`;
          return (
            <li
              key={row.series}
              {...part('dataset', {
                index: [row.series],
                className: 'grid items-center gap-x-gap-sm text-sm',
              })}
              style={{ gridTemplateColumns: 'minmax(0, 10rem) minmax(0, 1fr) auto' }}
            >
              <span
                {...part('dataset.name', { index: [row.series], className: 'min-w-0 break-words' })}
              >
                {props.series[row.series]?.name}
              </span>
              <svg
                viewBox={`0 0 ${String(SPARK_VIEW.width)} ${String(SPARK_VIEW.height)}`}
                preserveAspectRatio="none"
                className={cx(
                  'block w-full overflow-visible rtl:-scale-x-100',
                  SPARK_HEIGHTS[props.height],
                )}
                focusable="false"
                aria-hidden="true"
              >
                {row.area === '' ? null : (
                  <path d={row.area} className={tone.fill} fillOpacity={0.14} data-chart-area="" />
                )}
                {isTranslucent(tone) ? (
                  <path
                    d={row.line}
                    fill="none"
                    className="stroke-surface"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                    data-chart-underlay=""
                  />
                ) : null}
                <path
                  d={row.line}
                  fill="none"
                  className={tone.stroke}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  data-chart-line=""
                />
                {dot === '' ? null : (
                  <path
                    d={dot}
                    className={tone.stroke}
                    strokeWidth={7}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    data-chart-marker=""
                  />
                )}
              </svg>
              <span className="font-semibold whitespace-nowrap tabular-nums" data-chart-last="">
                {row.last === undefined
                  ? '–'
                  : valueText(formatValue(row.last), drawing, row.series === host)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
