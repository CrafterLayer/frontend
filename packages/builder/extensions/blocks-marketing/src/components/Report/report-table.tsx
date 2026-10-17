import { cx } from '../section-classes';

import { formatValue } from '../Chart/chart-format';
import { valueText } from '../Chart/chart-keys';
import type { ReportView } from './report-model';

/* The Table block's two looks (Table.tsx), so a report's table reads like one. */
const FRAME_CLASSES = {
  card: 'rounded-xl border border-current/10 bg-surface shadow-soft',
  plain: '',
} as const;

const HEADER_CLASSES = {
  card: 'bg-current/5',
  plain: 'border-b-2 border-current/25',
} as const;

/** The first cell with a number, in reading order: where the value prefix and suffix are edited. */
function firstValueCell(props: ReportView['props']): { row: number; column: number } | undefined {
  for (const [row] of props.categories.entries()) {
    const column = props.series.findIndex((entry) => entry.values[row] !== undefined);
    if (column >= 0) return { row, column };
  }
  return undefined;
}

/**
 * The numbers as a semantic table: one row per category with a row header,
 * one column per series with a column header, numbers aligned to the end, in
 * a labelled group a keyboard can scroll (the section is already the region). It shows (and so hosts) every
 * category label and column name the chart also draws.
 */
export function reportTable(view: ReportView, titleId: string) {
  const { props, part, values, hosts } = view;
  const host = hosts.affixes === 'table' ? firstValueCell(props) : undefined;
  return (
    <div
      role="group"
      className={cx(
        'w-full max-w-full overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        FRAME_CLASSES[props.variant],
      )}
      tabIndex={0}
      aria-labelledby={titleId}
      data-report-table=""
    >
      <table
        /* The box's ink sits on the table, a descendant of the surface (section-tone.ts). */
        className={cx(
          'w-full border-collapse text-start text-sm leading-normal',
          props.variant === 'card' ? 'text-text' : undefined,
        )}
        aria-labelledby={titleId}
      >
        <thead className={HEADER_CLASSES[props.variant]}>
          <tr>
            <td className="px-4 py-3" />
            {props.series.map((entry, column) => (
              /* Keyed by position: a bound value may be an inline editor element. */
              <th
                key={column}
                scope="col"
                className="px-4 py-3 text-end align-bottom font-semibold"
              >
                <span {...part('dataset.name', { index: [column] })}>{entry.name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.categories.map((category, row) => (
            <tr key={row} className="border-b border-current/10 last:border-b-0">
              <th scope="row" className="px-4 py-3 text-start align-top font-semibold">
                <span {...part('category', { index: [row] })}>{category}</span>
              </th>
              {props.series.map((entry, column) => {
                const value = entry.values[row];
                return (
                  <td key={column} className="px-4 py-3 text-end align-top tabular-nums">
                    {value === undefined
                      ? null
                      : valueText(
                          formatValue(value),
                          values,
                          host?.row === row && host.column === column,
                        )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
