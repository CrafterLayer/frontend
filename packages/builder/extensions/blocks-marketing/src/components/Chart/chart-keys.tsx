import { cx } from '../section-classes';

import { formatValue } from './chart-format';
import { committed, sharedText, type Drawing } from './chart-drawing';
import { drawnType, firstSeriesOnly, swatchShape } from './chart-kind';
import { valueFormatOf } from './chart-model';
import { gaugeEnds } from './chart-polar';
import { isTranslucent, toneOf, type SeriesTone } from './chart-palette';
import type { ChartProps } from './schema';

/** A printed number between the prefix and suffix parts; `host` shows them while they are edited in place. */
export function valueText(digits: string, { props, part }: Drawing, host: boolean) {
  return (
    <>
      {props.valuePrefix === undefined ? null : (
        <span {...part('valuePrefix')}>{sharedText(props.valuePrefix, host)}</span>
      )}
      {digits}
      {props.valueSuffix === undefined ? null : (
        <span {...part('valueSuffix')}>{sharedText(props.valueSuffix, host)}</span>
      )}
    </>
  );
}

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
          {swatch(toneOf(props.palette, index), swatchShape(drawnType(props), index))}
          <span {...part('dataset.name', { index: [index] })}>{entry.name}</span>
        </li>
      ))}
    </ul>
  );
}

/*
  The numbers behind the picture, for a screen reader: one row per category,
  one column per series (the first only where only it is drawn). A gauge adds
  its dial's end ("72 / 100") and a column for its target.
*/
export function dataTable(props: ChartProps) {
  const format = valueFormatOf(props);
  const kind = drawnType(props);
  const series = firstSeriesOnly(kind) ? props.series.slice(0, 1) : props.series;
  const dial = kind === 'gauge' ? gaugeEnds(props) : undefined;
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
          {dial?.target === undefined ? null : <th scope="col">{committed(props.targetLabel)}</th>}
        </tr>
      </thead>
      <tbody>
        {props.categories.map((category, categoryIndex) => (
          <tr key={categoryIndex}>
            <th scope="row">{committed(category)}</th>
            {series.map((entry, index) => {
              const value = entry.values[categoryIndex];
              const text = value === undefined ? '' : formatValue(value, format);
              return (
                <td key={index}>
                  {dial === undefined || text === ''
                    ? text
                    : `${text} / ${formatValue(dial.max, format)}`}
                </td>
              );
            })}
            {dial?.target === undefined ? null : <td>{formatValue(dial.target, format)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
