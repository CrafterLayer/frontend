import { cx } from '../../section-classes';
import { advancedIssue, isAdvancedChart } from '../advanced-contract';
import { committed, tooltip, type Drawing } from '../chart-drawing';
import { formatValue } from '../chart-format';
import { valueText } from '../chart-keys';
import { toneOf } from '../chart-palette';
import { bulletModel, intervalModel } from './intervals';
import { bubbleModel, heatmapModel, treemapModel } from './matrices';
import { compactNumber } from './model';

export interface AdvancedChartProps {
  readonly drawing: Drawing;
}

/** Bounded specialized charts: pure SVG marks and editable HTML labels, with explicit invalid-data feedback. */
export function AdvancedChart({ drawing }: AdvancedChartProps) {
  const { props, part, isCanvas, svgLabel, muted } = drawing;
  const issue = advancedIssue(props);
  if (issue !== undefined || !isAdvancedChart(props.chartType)) {
    return (
      <div className="rounded-lg border border-current/20 p-4 text-sm" data-chart-invalid="">
        <p role="status" className="m-0">
          {issue ?? 'Choose a supported advanced chart type.'}
        </p>
        {isCanvas ? (
          <>
            <div
              {...part('categories', { className: 'mt-3 flex flex-wrap gap-2' })}
              data-chart-categories=""
            >
              {props.categories.map((category, index) => (
                <span key={index} {...part('category', { index: [index] })}>
                  {category}
                </span>
              ))}
            </div>
            <div {...part('series', { className: 'mt-2 flex flex-wrap gap-2' })}>
              {props.series.map((series, index) => (
                <span key={index} {...part('dataset', { index: [index] })}>
                  <span {...part('dataset.name', { index: [index] })}>{series.name}</span>
                </span>
              ))}
            </div>
            {valueText('', drawing, true)}
          </>
        ) : null}
      </div>
    );
  }
  const model =
    props.chartType === 'heatmap'
      ? heatmapModel(props)
      : props.chartType === 'treemap'
        ? treemapModel(props)
        : props.chartType === 'bubble'
          ? bubbleModel(props)
          : props.chartType === 'bullet'
            ? bulletModel(props)
            : intervalModel(props);
  const tree = props.chartType === 'treemap';
  const heat = props.chartType === 'heatmap';
  const valueAffixes = props.chartType !== 'histogram';
  const crowded =
    props.chartType !== 'bullet' && props.chartType !== 'bubble' && props.categories.length > 8;
  const labelStep = props.categories.length > 16 ? 3 : 2;

  return (
    <div className="flex min-w-0 flex-col gap-3" data-chart-plot={props.chartType}>
      <div className="relative w-full min-w-0" style={{ blockSize: model.height }}>
        <svg
          viewBox={`0 0 ${String(model.width)} ${String(model.height)}`}
          preserveAspectRatio="none"
          className="block size-full rtl:-scale-x-100"
          focusable="false"
          {...svgLabel}
        >
          {props.showGrid
            ? model.grid.map((path, index) => (
                <path
                  key={index}
                  d={path}
                  fill="none"
                  className="stroke-current"
                  strokeOpacity={0.1}
                  vectorEffect="non-scaling-stroke"
                  data-chart-grid=""
                />
              ))
            : null}
          {model.marks.map((mark, index) => {
            const tone = toneOf(props.palette, mark.tone);
            return (
              <path
                key={index}
                d={mark.path}
                className={cx(
                  mark.fill ? tone.fill : 'fill-none',
                  tree ? drawing.ring : tone.stroke,
                )}
                strokeWidth={mark.stroke ?? 0}
                strokeLinecap="round"
                strokeDasharray={mark.dash ? '3 3' : undefined}
                opacity={mark.opacity}
                vectorEffect="non-scaling-stroke"
                data-chart-mark={mark.kind}
              >
                {isCanvas || mark.detail === '' ? null : (
                  <title>
                    {tooltip(
                      props.categories[mark.category],
                      props.series[mark.series]?.name,
                      mark.detail,
                    )}
                  </title>
                )}
              </path>
            );
          })}
        </svg>
        <div
          className={cx(
            'pointer-events-none absolute inset-0 text-[10px] leading-tight tabular-nums @md:text-xs',
            muted,
          )}
          aria-hidden="true"
          data-chart-axis=""
        >
          {model.ticks.map((tick, index) => (
            <span
              key={`${tick.axis}-${String(index)}`}
              className={cx(
                'absolute -translate-y-1/2',
                tick.axis === 'y'
                  ? '-translate-x-full rtl:translate-x-full'
                  : '-translate-x-1/2 rtl:translate-x-1/2',
              )}
              style={{
                insetInlineStart: `${String((tick.x / model.width) * 100)}%`,
                top: `${String((tick.y / model.height) * 100)}%`,
              }}
            >
              {valueAffixes && !(props.chartType === 'bubble' && tick.axis === 'x')
                ? valueText(compactNumber(tick.value), drawing, index === 0)
                : compactNumber(tick.value)}
            </span>
          ))}
        </div>
        {tree ? null : (
          <div
            {...part('categories', {
              className: cx(
                'absolute inset-0 text-center text-[10px] leading-tight @md:text-xs',
                muted,
              ),
            })}
            aria-hidden="true"
            data-chart-categories=""
          >
            {model.categories.map((label) => (
              <span
                key={label.index}
                {...part('category', {
                  index: [label.index],
                  className: cx(
                    'absolute -translate-x-1/2 -translate-y-1/2 break-words rtl:translate-x-1/2',
                    crowded && label.index % labelStep !== 0 ? '@max-3xl:invisible' : undefined,
                  ),
                })}
                style={{
                  insetInlineStart: `${String((label.x / model.width) * 100)}%`,
                  top: `${String((label.y / model.height) * 100)}%`,
                  inlineSize: `${String((label.width / model.width) * 100)}%`,
                }}
              >
                {props.categories[label.index]}
              </span>
            ))}
          </div>
        )}
        {heat ? (
          <div
            {...part('series', {
              className: 'absolute inset-0 text-center text-[10px] leading-tight @md:text-xs',
            })}
            aria-hidden="true"
            data-chart-rows=""
          >
            {model.rows.map((label) => (
              <span
                key={label.index}
                {...part('dataset', {
                  index: [label.index],
                  className:
                    'absolute -translate-x-1/2 -translate-y-1/2 break-words rtl:translate-x-1/2',
                })}
                style={{
                  insetInlineStart: `${String((label.x / model.width) * 100)}%`,
                  top: `${String((label.y / model.height) * 100)}%`,
                  inlineSize: `${String((label.width / model.width) * 100)}%`,
                }}
              >
                <span {...part('dataset.name', { index: [label.index] })}>
                  {props.series[label.index]?.name}
                </span>
              </span>
            ))}
          </div>
        ) : null}
        {props.showValues && model.values.length <= 24 ? (
          <div
            className="pointer-events-none absolute inset-0 text-center text-[10px] font-semibold tabular-nums @md:text-xs"
            aria-hidden="true"
            data-chart-values=""
          >
            {model.values.map((label, index) => (
              <span
                key={index}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-sm bg-surface/90 px-0.5 text-text rtl:translate-x-1/2"
                style={{
                  insetInlineStart: `${String((label.x / model.width) * 100)}%`,
                  top: `${String((label.y / model.height) * 100)}%`,
                }}
              >
                {valueAffixes
                  ? valueText(
                      compactNumber(label.value),
                      drawing,
                      model.ticks.length === 0 && index === 0,
                    )
                  : compactNumber(label.value)}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {tree ? (
        <ul
          {...part('categories', {
            className: 'm-0 grid list-none grid-cols-2 gap-2 p-0 text-xs @md:grid-cols-3',
          })}
          data-chart-tile-key=""
        >
          {props.categories.map((category, index) => (
            <li key={index} className="flex min-w-0 items-baseline gap-1.5">
              <span
                aria-hidden="true"
                className={cx(
                  'size-2 shrink-0 rounded-sm',
                  toneOf(props.palette, index % 6).swatch,
                )}
              />
              <span {...part('category', { index: [index], className: 'min-w-0 break-words' })}>
                {category}
              </span>
              <span className="ms-auto tabular-nums">
                {valueText(formatValue(props.series[0]?.values[index] ?? 0), drawing, index === 0)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {heat ? (
        <p className={cx('m-0 text-xs', muted)} data-chart-scale="">
          {valueText(
            formatValue(Math.min(...props.series.flatMap((series) => series.values))),
            drawing,
            !(props.showValues && model.values.length <= 24),
          )}{' '}
          —{' '}
          {valueText(
            formatValue(Math.max(...props.series.flatMap((series) => series.values))),
            drawing,
            false,
          )}
        </p>
      ) : null}
      {props.chartType === 'candlestick' ? (
        <p className={cx('m-0 text-xs', muted)}>
          Open → Close · Low–High · Hollow: close ≥ open · Filled: close &lt; open
        </p>
      ) : null}
      {props.chartType === 'bubble' ? (
        <p className={cx('m-0 text-xs', muted)}>
          X: {committed(props.categories[0]) === '' ? 'numeric category' : 'numeric categories'} ·
          Y: {committed(props.series[0]?.name)} · Size: {committed(props.series[1]?.name)}
        </p>
      ) : null}
    </div>
  );
}
