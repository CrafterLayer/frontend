import { cx } from '../section-classes';

import { formatValue } from './chart-format';
import { committed, type Drawing } from './chart-drawing';
import { valueFormatOf } from './chart-model';
import { isTranslucent, toneOf, type SeriesTone } from './chart-palette';
import type { ChartProps } from './schema';

/* A legend key. A translucent tone sits on the surface, exactly as its marks do. */
export function swatch(tone: SeriesTone, shape: string) {
  return (
    <span
      aria-hidden="true"
      className={cx('inline-block shrink-0', shape, isTranslucent(tone) ? 'bg-surface' : undefined)}
      data-chart-swatch=""
    >
      <span className={cx('block', shape, tone.swatch)} />
    </span>
  );
}

export function seriesLegend({ props, part }: Drawing) {
  return (
    <ul
      {...part('series', {
        className: 'm-0 flex list-none flex-wrap gap-x-gap gap-y-gap-xs p-0 text-sm',
      })}
      data-chart-legend=""
    >
      {props.series.map((entry, index) => (
        <li
          key={index}
          {...part('dataset', {
            index: [index],
            className: 'inline-flex min-w-0 items-center gap-gap-xs',
          })}
        >
          {swatch(
            toneOf(props.palette, index),
            props.chartType === 'line' ? 'h-0.5 w-4 rounded-full' : 'size-3 rounded-sm',
          )}
          <span {...part('dataset.name', { index: [index] })}>{entry.name}</span>
        </li>
      ))}
    </ul>
  );
}

/* The numbers behind the picture, for a screen reader: one row per category, one column per series. */
export function dataTable(props: ChartProps, pie: boolean) {
  const format = valueFormatOf(props);
  const series = pie ? props.series.slice(0, 1) : props.series;
  const caption = committed(props.title);
  return (
    <table className="sr-only" data-chart-table="">
      {caption === '' ? null : <caption>{caption}</caption>}
      <thead>
        <tr>
          <td />
          {series.map((entry, index) => (
            <th key={index} scope="col">
              {committed(entry.name)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {props.categories.map((category, categoryIndex) => (
          <tr key={categoryIndex}>
            <th scope="row">{committed(category)}</th>
            {series.map((entry, index) => {
              const value = entry.values[categoryIndex];
              return <td key={index}>{value === undefined ? '' : formatValue(value, format)}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
