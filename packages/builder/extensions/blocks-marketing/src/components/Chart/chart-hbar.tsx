import { cx } from '../section-classes';

import { formatValue } from './chart-format';
import { tooltip, type Drawing } from './chart-drawing';
import { valueText } from './chart-keys';
import { valueFormatOf } from './chart-model';
import { isTranslucent, toneOf } from './chart-palette';
import type { HBarModel } from './chart-rows';
import type { ChartProps } from './schema';

/* A row is at least this tall; a label that wraps makes every row taller together. */
export const ROW_MIN_HEIGHTS: Readonly<Record<ChartProps['height'], string>> = {
  sm: '1.5rem',
  md: '2rem',
  lg: '2.75rem',
};

/**
 * Horizontal bars: each category's label beside its row, so a long label
 * wraps instead of colliding, and the value axis along the bottom. The rows
 * are equal (`1fr` rows size to the tallest label), and the SVG stretches over
 * them, so every bar sits in the middle of its label's row.
 */
export function hbarFigure(model: HBarModel, drawing: Drawing) {
  const { props, part, svgLabel, muted, isCanvas } = drawing;
  const format = valueFormatOf(props);
  const count = Math.max(props.categories.length, 1);
  const nameOf = (series: number) => props.series[series]?.name;
  return (
    <div
      className="grid gap-x-gap-sm gap-y-gap-xs"
      style={{ gridTemplateColumns: 'fit-content(40%) minmax(0, 1fr)' }}
      data-chart-plot="hbar"
    >
      <div
        {...part('categories', { className: cx('grid text-xs leading-tight', muted) })}
        style={{
          gridTemplateRows: `repeat(${String(count)}, minmax(${ROW_MIN_HEIGHTS[props.height]}, 1fr))`,
        }}
        aria-hidden="true"
        data-chart-categories=""
      >
        {props.categories.map((category, index) => (
          /* Keyed by position: a bound value may be an inline editor element. */
          <span
            key={index}
            {...part('category', {
              index: [index],
              className: 'flex min-w-0 items-center justify-end text-end break-words',
            })}
          >
            {category}
          </span>
        ))}
      </div>
      <div className="relative min-w-0">
        {/* Mirrored as a whole on an RTL page: the bars grow from the inline start. */}
        <svg
          viewBox={`0 0 ${String(model.width)} ${String(model.height)}`}
          preserveAspectRatio="none"
          className="absolute inset-0 block size-full overflow-visible rtl:-scale-x-100"
          focusable="false"
          {...svgLabel}
        >
          {props.showGrid
            ? model.ticks.map((tick) => (
                <line
                  key={tick.value}
                  x1={tick.x}
                  x2={tick.x}
                  y1={0}
                  y2={model.height}
                  className="stroke-current"
                  strokeOpacity={0.12}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                  data-chart-grid=""
                />
              ))
            : null}
          {model.bars.map((bar) => {
            const tone = toneOf(props.palette, bar.series);
            return (
              <g key={`${String(bar.series)}-${String(bar.category)}`}>
                {isTranslucent(tone) ? (
                  <path d={bar.path} className="fill-surface" data-chart-underlay="" />
                ) : null}
                <path d={bar.path} className={tone.fill} data-chart-bar="">
                  {isCanvas ? null : (
                    <title>
                      {tooltip(
                        props.categories[bar.category],
                        nameOf(bar.series),
                        formatValue(bar.value, format),
                      )}
                    </title>
                  )}
                </path>
              </g>
            );
          })}
          {model.zeroX === undefined ? null : (
            <line
              x1={model.zeroX}
              x2={model.zeroX}
              y1={0}
              y2={model.height}
              className="stroke-current"
              strokeOpacity={0.45}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              data-chart-baseline=""
            />
          )}
        </svg>
        {model.labels.length === 0 ? null : (
          <div
            className="pointer-events-none absolute inset-0 text-xs leading-none font-semibold tabular-nums"
            aria-hidden="true"
            data-chart-values=""
          >
            {model.labels.map((label) => (
              <span
                key={label.key}
                className={cx(
                  'absolute -translate-y-1/2 whitespace-nowrap',
                  label.negative ? '-ms-1 -translate-x-full rtl:translate-x-full' : 'ms-1',
                )}
                style={{
                  insetInlineStart: `${String(label.start)}%`,
                  top: `${String(label.top)}%`,
                }}
              >
                {valueText(label.digits, drawing, false)}
              </span>
            ))}
          </div>
        )}
      </div>
      <div aria-hidden="true" />
      <div
        className={cx('relative h-4 text-xs leading-none tabular-nums', muted)}
        aria-hidden="true"
        data-chart-axis=""
      >
        {model.ticks.map((tick, index) => (
          <span
            key={tick.value}
            className="absolute top-0 -translate-x-1/2 whitespace-nowrap rtl:translate-x-1/2"
            style={{ insetInlineStart: `${String(tick.start)}%` }}
          >
            {/* The first tick hosts the prefix and suffix while they are edited in place. */}
            {valueText(tick.digits, drawing, index === 0)}
          </span>
        ))}
      </div>
    </div>
  );
}
