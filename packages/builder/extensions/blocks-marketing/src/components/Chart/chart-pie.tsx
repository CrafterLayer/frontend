import { cx } from '../section-classes';

import { formatShare, formatValue } from './chart-format';
import { tooltip, type Drawing } from './chart-drawing';
import { PIE_VIEW, valueFormatOf, type PieModel } from './chart-model';
import { isTranslucent, toneOf } from './chart-palette';
import { swatch } from './chart-keys';
import type { ChartProps } from './schema';

const PIE_SIZES: Readonly<Record<ChartProps['height'], string>> = {
  sm: 'max-w-44',
  md: 'max-w-56',
  lg: 'max-w-72',
};

function sliceLegend(model: PieModel, { props, part, muted }: Drawing) {
  const format = valueFormatOf(props);
  return (
    <ul
      {...part('categories', {
        className: 'm-0 flex w-full max-w-xs min-w-0 list-none flex-col gap-gap-xs p-0 text-sm',
      })}
      data-chart-legend=""
    >
      {model.slices.map((slice, position) => (
        <li key={slice.index} className="flex items-center gap-gap-sm">
          {swatch(toneOf(props.palette, position), 'size-3 rounded-sm')}
          {slice.index < 0 ? (
            <span {...part('otherLabel', { className: 'min-w-0' })}>{props.otherLabel}</span>
          ) : (
            <span {...part('category', { index: [slice.index], className: 'min-w-0' })}>
              {props.categories[slice.index]}
            </span>
          )}
          <span className={cx('ms-auto whitespace-nowrap tabular-nums', muted)}>
            {props.showValues ? `${formatValue(slice.value, format)} · ` : ''}
            {formatShare(slice.fraction)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A pie or donut beside its legend of slices, each with its share. */
export function pieFigure(model: PieModel, drawing: Drawing) {
  const { props, svgLabel, ring } = drawing;
  const format = valueFormatOf(props);
  const nameOf = (index: number) => (index < 0 ? props.otherLabel : props.categories[index]);
  return (
    <div
      className="flex flex-col items-center gap-gap @md:flex-row @md:gap-gap-lg"
      data-chart-plot={props.chartType}
    >
      <div className={cx('relative w-full shrink-0', PIE_SIZES[props.height])}>
        <svg
          viewBox={`0 0 ${String(PIE_VIEW)} ${String(PIE_VIEW)}`}
          className="block h-auto w-full"
          focusable="false"
          {...svgLabel}
        >
          {model.slices.map((slice, position) => (
            <g key={slice.index}>
              {isTranslucent(toneOf(props.palette, position)) ? (
                <path d={slice.path} className="fill-surface" data-chart-underlay="" />
              ) : null}
              <path
                d={slice.path}
                className={cx(toneOf(props.palette, position).fill, ring)}
                strokeWidth={2}
                strokeLinejoin="round"
                data-chart-slice=""
              >
                <title>
                  {tooltip(
                    nameOf(slice.index),
                    undefined,
                    `${formatValue(slice.value, format)} (${formatShare(slice.fraction)})`,
                  )}
                </title>
              </path>
            </g>
          ))}
        </svg>
        {props.chartType === 'donut' && props.showValues ? (
          /* Half the width keeps the total inside the hole (58% across); a long suffix wraps. */
          <span
            className="absolute inset-0 flex items-center justify-center"
            aria-hidden="true"
            data-chart-total=""
          >
            <span className="w-1/2 text-center text-base leading-tight font-bold break-words tabular-nums @md:text-lg">
              {formatValue(model.total, format)}
            </span>
          </span>
        ) : null}
      </div>
      {props.showLegend ? sliceLegend(model, drawing) : null}
    </div>
  );
}
