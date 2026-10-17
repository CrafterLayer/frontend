import { cx } from '../section-classes';

import { formatValue } from './chart-format';
import { sharedText, tooltip, type Drawing } from './chart-drawing';
import { valueText } from './chart-keys';
import { valueFormatOf } from './chart-model';
import { isTranslucent, toneOf } from './chart-palette';
import { GAUGE_STROKE, GAUGE_VIEW, type GaugeModel } from './chart-polar';
import type { ChartProps } from './schema';

const GAUGE_SIZES: Readonly<Record<ChartProps['height'], string>> = {
  sm: 'max-w-40',
  md: 'max-w-56',
  lg: 'max-w-72',
};

/* Columns by how many dials there are, widening with the container. */
const GAUGE_COLUMNS: Readonly<Record<number, string>> = {
  2: 'grid-cols-1 @sm:grid-cols-2',
  3: 'grid-cols-1 @sm:grid-cols-3',
  4: 'grid-cols-2 @2xl:grid-cols-4',
  5: 'grid-cols-2 @xl:grid-cols-3',
  6: 'grid-cols-2 @xl:grid-cols-3',
};

/**
 * Gauges: one half dial per category of the first series, filled from the
 * inline start to its value against the shared maximum, the value printed
 * inside, its label below, and a target marked across every dial. The row of
 * dials is one named image; the dials themselves are decoration of it.
 */
export function gaugeFigure(model: GaugeModel, drawing: Drawing) {
  const { props, part, svgLabel, muted, isCanvas } = drawing;
  const format = valueFormatOf(props);
  const tone = toneOf(props.palette, 0);
  return (
    <div
      {...svgLabel}
      className={cx(
        'grid justify-items-center gap-gap',
        GAUGE_COLUMNS[Math.min(model.dials.length, 6)],
      )}
      data-chart-plot="gauge"
    >
      {model.dials.map((dial, position) => (
        <div
          key={dial.index}
          className={cx(
            'flex w-full min-w-0 flex-col items-center gap-gap-xs',
            GAUGE_SIZES[props.height],
          )}
          data-chart-dial=""
        >
          <div className="relative w-full">
            <svg
              viewBox={`0 0 ${String(GAUGE_VIEW.width)} ${String(GAUGE_VIEW.height)}`}
              className="block h-auto w-full overflow-visible rtl:-scale-x-100"
              focusable="false"
              aria-hidden="true"
            >
              <path
                d={model.track}
                fill="none"
                className="stroke-current"
                strokeOpacity={0.12}
                strokeWidth={GAUGE_STROKE}
                strokeLinecap="round"
                data-chart-track=""
              />
              {dial.arc === '' ? null : (
                <g>
                  {isTranslucent(tone) ? (
                    <path
                      d={dial.arc}
                      fill="none"
                      className="stroke-surface"
                      strokeWidth={GAUGE_STROKE}
                      strokeLinecap="round"
                      data-chart-underlay=""
                    />
                  ) : null}
                  <path
                    d={dial.arc}
                    fill="none"
                    className={tone.stroke}
                    strokeWidth={GAUGE_STROKE}
                    strokeLinecap="round"
                    data-chart-arc=""
                  >
                    {isCanvas || dial.value === undefined ? null : (
                      <title>
                        {tooltip(
                          props.categories[dial.index],
                          undefined,
                          formatValue(dial.value, format),
                        )}
                      </title>
                    )}
                  </path>
                </g>
              )}
              {model.target === undefined ? null : (
                <path
                  d={model.target.path}
                  className="stroke-current"
                  strokeWidth={3}
                  strokeLinecap="round"
                  data-chart-target=""
                />
              )}
            </svg>
            <span
              className="absolute inset-x-0 bottom-0 text-center text-2xl leading-none font-bold tabular-nums @md:text-3xl"
              data-chart-total=""
            >
              {/* The first dial hosts the prefix and suffix while they are edited in place. */}
              {dial.value === undefined
                ? '–'
                : valueText(formatValue(dial.value), drawing, position === 0)}
            </span>
          </div>
          <span
            className={cx('flex w-full justify-between text-xs tabular-nums', muted)}
            data-chart-ends=""
          >
            <span>{valueText('0', drawing, false)}</span>
            <span>{valueText(formatValue(model.max), drawing, false)}</span>
          </span>
          <span
            {...part('category', {
              index: [dial.index],
              className: 'text-center text-sm leading-tight font-semibold break-words',
            })}
          >
            {props.categories[dial.index]}
          </span>
          {model.target === undefined ? null : (
            <span className={cx('text-xs', muted)} data-chart-target-label="">
              <span {...part('targetLabel')}>{sharedText(props.targetLabel, position === 0)}</span>{' '}
              <span className="tabular-nums">
                {valueText(formatValue(model.target.value), drawing, false)}
              </span>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
