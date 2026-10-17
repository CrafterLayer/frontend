import { formatShare, formatValue } from './chart-format';
import { tooltip, type Drawing } from './chart-drawing';
import { ROW_MIN_HEIGHTS } from './chart-hbar';
import { valueText } from './chart-keys';
import { valueFormatOf } from './chart-model';
import { isTranslucent, toneOf } from './chart-palette';
import type { FunnelModel } from './chart-rows';

/**
 * A funnel: one row per stage of the first series — its label, a centred bar
 * as wide as its value with a wash narrowing to the next stage, and its value
 * with its share of the first stage (the conversion so far). Symmetric, so it
 * reads the same in either direction; one hue keeps the eye on the widths,
 * the label beside each bar carries its identity.
 */
export function funnelFigure(model: FunnelModel, drawing: Drawing) {
  const { props, part, svgLabel, muted, isCanvas } = drawing;
  const format = valueFormatOf(props);
  const tone = toneOf(props.palette, 0);
  const rows = {
    gridTemplateRows: `repeat(${String(Math.max(model.stages.length, 1))}, minmax(${ROW_MIN_HEIGHTS[props.height]}, 1fr))`,
  };
  return (
    <div
      className="grid gap-x-gap-sm"
      style={{ gridTemplateColumns: 'fit-content(30%) minmax(0, 1fr) auto' }}
      data-chart-plot="funnel"
    >
      <div
        {...part('categories', { className: 'grid text-sm leading-tight' })}
        style={rows}
        aria-hidden="true"
        data-chart-categories=""
      >
        {props.categories.map((category, index) => (
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
        <svg
          viewBox={`0 0 ${String(model.width)} ${String(model.height)}`}
          preserveAspectRatio="none"
          className="absolute inset-0 block size-full overflow-visible"
          focusable="false"
          {...svgLabel}
        >
          {model.necks.map((neck, index) => (
            <path
              key={index}
              d={neck}
              className="fill-current"
              fillOpacity={0.08}
              data-chart-neck=""
            />
          ))}
          {model.stages.map((stage) =>
            stage.path === '' ? null : (
              <g key={stage.index}>
                {isTranslucent(tone) ? (
                  <path d={stage.path} className="fill-surface" data-chart-underlay="" />
                ) : null}
                <path d={stage.path} className={tone.fill} data-chart-stage="">
                  {isCanvas ? null : (
                    <title>
                      {tooltip(
                        props.categories[stage.index],
                        undefined,
                        stage.share === undefined
                          ? formatValue(stage.value, format)
                          : `${formatValue(stage.value, format)} (${formatShare(stage.share)})`,
                      )}
                    </title>
                  )}
                </path>
              </g>
            ),
          )}
        </svg>
      </div>
      <div
        className="grid text-sm leading-tight tabular-nums"
        style={rows}
        aria-hidden="true"
        data-chart-values=""
      >
        {model.stages.map((stage, position) => (
          <span
            key={stage.index}
            className="flex items-center justify-end gap-gap-xs whitespace-nowrap"
          >
            {/* The first stage hosts the prefix and suffix while they are edited in place. */}
            <span className="font-semibold">
              {valueText(formatValue(stage.value), drawing, position === 0)}
            </span>
            {stage.share === undefined ? null : (
              <span className={muted}>{formatShare(stage.share)}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
