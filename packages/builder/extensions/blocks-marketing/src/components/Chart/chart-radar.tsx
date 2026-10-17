import { cx } from '../section-classes';

import { formatValue } from './chart-format';
import { tooltip, type Drawing } from './chart-drawing';
import { valueText } from './chart-keys';
import { valueFormatOf } from './chart-model';
import { isTranslucent, toneOf } from './chart-palette';
import type { RadarLabel, RadarModel } from './chart-polar';
import type { ChartProps } from './schema';

const RADAR_SIZES: Readonly<Record<ChartProps['height'], string>> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

/* A label grows away from the web: from its point towards the inline end, the start, or both. */
const ANCHOR_CLASSES: Readonly<Record<RadarLabel['anchor'], string>> = {
  start: 'text-start',
  middle: '-translate-x-1/2 text-center rtl:translate-x-1/2',
  end: '-translate-x-full text-end rtl:translate-x-full',
};

const SIDE_CLASSES: Readonly<Record<RadarLabel['side'], string>> = {
  top: '-translate-y-full',
  middle: '-translate-y-1/2',
  bottom: '',
};

/**
 * A radar: one spoke per category clockwise from twelve o'clock (anticlockwise
 * on an RTL page, which mirrors the SVG), rings at nice values with their
 * numbers on the first spoke, and one closed shape per series.
 */
export function radarFigure(model: RadarModel, drawing: Drawing) {
  const { props, part, svgLabel, ring, muted, isCanvas } = drawing;
  const format = valueFormatOf(props);
  const nameOf = (series: number) => props.series[series]?.name;
  return (
    <div className="flex justify-center" data-chart-plot="radar">
      {/* The padding is the room the category labels take outside the web. */}
      <div className={cx('w-full px-16 py-6', RADAR_SIZES[props.height])}>
        <div className="relative">
          <svg
            viewBox={`0 0 ${String(model.view)} ${String(model.view)}`}
            className="block h-auto w-full overflow-visible rtl:-scale-x-100"
            focusable="false"
            {...svgLabel}
          >
            {props.showGrid
              ? model.rings.map((web) => (
                  <path
                    key={web.value}
                    d={web.path}
                    fill="none"
                    className="stroke-current"
                    strokeOpacity={0.14}
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                    data-chart-grid=""
                  />
                ))
              : null}
            {props.showGrid
              ? model.spokes.map((spoke, index) => (
                  <line
                    key={index}
                    x1={model.center}
                    y1={model.center}
                    x2={spoke.x}
                    y2={spoke.y}
                    className="stroke-current"
                    strokeOpacity={0.14}
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                    data-chart-grid="spoke"
                  />
                ))
              : null}
            {model.shapes.map((shape) => {
              const tone = toneOf(props.palette, shape.series);
              return (
                <g key={shape.series}>
                  <path
                    d={shape.path}
                    className={tone.fill}
                    fillOpacity={0.16}
                    data-chart-area=""
                  />
                  {isTranslucent(tone) ? (
                    <path
                      d={shape.path}
                      fill="none"
                      className="stroke-surface"
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                      data-chart-underlay=""
                    />
                  ) : null}
                  <path
                    d={shape.path}
                    fill="none"
                    className={tone.stroke}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    data-chart-line=""
                  />
                  {shape.points.map((point) => {
                    const dot = `M${String(point.x)} ${String(point.y)}h0.01`;
                    return (
                      <g key={point.category}>
                        <path
                          d={dot}
                          className={ring}
                          strokeWidth={11}
                          strokeLinecap="round"
                          vectorEffect="non-scaling-stroke"
                          data-chart-ring=""
                        />
                        <path
                          d={dot}
                          className={tone.stroke}
                          strokeWidth={7}
                          strokeLinecap="round"
                          vectorEffect="non-scaling-stroke"
                          data-chart-marker=""
                        >
                          {isCanvas ? null : (
                            <title>
                              {tooltip(
                                props.categories[point.category],
                                nameOf(shape.series),
                                formatValue(point.value, format),
                              )}
                            </title>
                          )}
                        </path>
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>
          {props.showGrid ? (
            <div
              className={cx(
                'pointer-events-none absolute inset-0 text-xs leading-none tabular-nums',
                muted,
              )}
              aria-hidden="true"
              data-chart-axis=""
            >
              {model.rings.map((web, index) => (
                <span
                  key={web.value}
                  className="absolute ms-1 -translate-y-1/2 whitespace-nowrap"
                  style={{ insetInlineStart: '50%', top: `${String(web.top)}%` }}
                >
                  {/* The innermost ring hosts the prefix and suffix while they are edited in place. */}
                  {valueText(formatValue(web.value, {}, 'compact'), drawing, index === 0)}
                </span>
              ))}
            </div>
          ) : null}
          <div
            {...part('categories', {
              className: 'pointer-events-none absolute inset-0 text-xs leading-tight',
            })}
            aria-hidden="true"
            data-chart-categories=""
          >
            {model.labels.map((label) => (
              <span
                key={label.index}
                {...part('category', {
                  index: [label.index],
                  className: cx(
                    'pointer-events-auto absolute w-max max-w-28 break-words',
                    ANCHOR_CLASSES[label.anchor],
                    SIDE_CLASSES[label.side],
                  ),
                })}
                style={{
                  insetInlineStart: `${String(label.start)}%`,
                  top: `${String(label.top)}%`,
                }}
              >
                {props.categories[label.index]}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
