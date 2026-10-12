import { cx } from '../section-classes';

import { formatValue } from './chart-format';
import { committed, tooltip, type Drawing } from './chart-drawing';
import { valueText } from './chart-keys';
import { valueFormatOf, type CartesianModel } from './chart-model';
import { isTranslucent, toneOf } from './chart-palette';
import type { ChartProps } from './schema';

/* The cartesian plot's height; its width is the column's (chart-model.ts VIEW_HEIGHTS). */
const PLOT_HEIGHTS: Readonly<Record<ChartProps['height'], string>> = {
  sm: 'h-48',
  md: 'h-64',
  lg: 'h-80',
};

/** The plot of a bar, line or area chart: HTML axis and labels around a stretched SVG. */
export function cartesianFigure(model: CartesianModel, drawing: Drawing) {
  const { props, part, svgLabel, ring, muted, isCanvas } = drawing;
  const format = valueFormatOf(props);
  const count = model.categoryCount;
  /* Crowded axes keep every second or third label once their container narrows. */
  const thin = count > 16 ? 3 : count > 8 ? 2 : 1;
  const nameOf = (series: number) => props.series[series]?.name;
  return (
    <div
      className="grid gap-x-gap-sm gap-y-gap-xs"
      style={{ gridTemplateColumns: `${String(model.axisWidth)}ch minmax(0, 1fr)` }}
      data-chart-plot={model.kind}
    >
      {/* Tick labels are HTML, not SVG text: crisp at any size, and never mirrored under RTL. */}
      <div
        className={cx('relative text-xs leading-none tabular-nums', muted)}
        aria-hidden="true"
        data-chart-axis=""
      >
        {model.ticks.map((tick, index) => (
          <span
            key={tick.value}
            className="absolute end-0 -translate-y-1/2 whitespace-nowrap"
            style={{ top: `${String(tick.top)}%` }}
          >
            {/* The lowest tick hosts the prefix and suffix while they are edited in place. */}
            {valueText(tick.digits, drawing, index === 0)}
          </span>
        ))}
      </div>
      <div className={cx('relative min-w-0', PLOT_HEIGHTS[props.height])}>
        {/*
          The marks stretch to the box and are mirrored as a whole on an RTL
          page, so the first category sits at the inline start.
        */}
        <svg
          viewBox={`0 0 ${String(model.width)} ${String(model.height)}`}
          preserveAspectRatio="none"
          className="block size-full overflow-visible rtl:-scale-x-100"
          focusable="false"
          {...svgLabel}
        >
          {props.showGrid
            ? model.ticks.map((tick) => (
                <line
                  key={tick.value}
                  x1={0}
                  x2={model.width}
                  y1={tick.y}
                  y2={tick.y}
                  className="stroke-current"
                  strokeOpacity={0.12}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                  data-chart-grid=""
                />
              ))
            : null}
          {model.areas.map((area) => (
            <path
              key={area.series}
              d={area.path}
              className={toneOf(props.palette, area.series).fill}
              fillOpacity={props.stacked ? 0.4 : 0.14}
              data-chart-area=""
            >
              {isCanvas ? null : <title>{committed(nameOf(area.series))}</title>}
            </path>
          ))}
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
          {model.zeroY === undefined ? null : (
            <line
              x1={0}
              x2={model.width}
              y1={model.zeroY}
              y2={model.zeroY}
              className="stroke-current"
              strokeOpacity={0.45}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              data-chart-baseline=""
            />
          )}
          {model.lines.map((line) => {
            const tone = toneOf(props.palette, line.series);
            const stroke = {
              d: line.path,
              fill: 'none',
              strokeWidth: 2,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              vectorEffect: 'non-scaling-stroke',
            } as const;
            return (
              <g key={line.series}>
                {isTranslucent(tone) ? (
                  <path {...stroke} className="stroke-surface" data-chart-underlay="" />
                ) : null}
                <path {...stroke} className={tone.stroke} data-chart-line="" />
              </g>
            );
          })}
          {model.markers.map((marker) => {
            /*
              A dot is a round-capped stroke of (almost) no length: with a
              non-scaling stroke it stays a circle however the plot stretches.
              The wider stroke under it is its ring in the ground colour.
            */
            const dot = `M${String(marker.x)} ${String(marker.y)}h0.01`;
            const tone = toneOf(props.palette, marker.series);
            return (
              <g key={`${String(marker.series)}-${String(marker.category)}`}>
                <path
                  d={dot}
                  className={ring}
                  strokeWidth={13}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  data-chart-ring=""
                />
                {isTranslucent(tone) ? (
                  <path
                    d={dot}
                    className="stroke-surface"
                    strokeWidth={9}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    data-chart-underlay=""
                  />
                ) : null}
                <path
                  d={dot}
                  className={tone.stroke}
                  strokeWidth={9}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  data-chart-marker=""
                >
                  {isCanvas ? null : (
                    <title>
                      {tooltip(
                        props.categories[marker.category],
                        nameOf(marker.series),
                        formatValue(marker.value, format),
                      )}
                    </title>
                  )}
                </path>
              </g>
            );
          })}
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
                  'absolute -translate-x-1/2 whitespace-nowrap rtl:translate-x-1/2',
                  label.below ? 'mt-1' : '-mt-1 -translate-y-full',
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
        {...part('categories', { className: cx('grid text-center text-xs leading-tight', muted) })}
        style={{ gridTemplateColumns: `repeat(${String(Math.max(count, 1))}, minmax(0, 1fr))` }}
        aria-hidden="true"
        data-chart-categories=""
      >
        {props.categories.map((category, index) => (
          /* Keyed by position: a bound value may be an inline editor element. */
          <span
            key={index}
            {...part('category', {
              index: [index],
              className: cx(
                'min-w-0 px-0.5 break-words',
                thin > 1 && index % thin !== 0 ? '@max-3xl:invisible' : undefined,
              ),
            })}
          >
            {category}
          </span>
        ))}
      </div>
    </div>
  );
}
