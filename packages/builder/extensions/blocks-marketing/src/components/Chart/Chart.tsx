import '../section-layout.css';

import type { ReactNode } from 'react';

import { blockPartProps, type BlockRenderProps } from '@craftkit/builder-schema';

import {
  ALIGN_CLASSES,
  GAP_CLASSES,
  cx,
  sectionContentClasses,
  sectionShellClasses,
} from '../section-classes';
import { sectionColorStyle } from '../section-color';
import { sectionMotionAttributes } from '../section-motion-attributes';
import { sectionSpacingStyle } from '../section-spacing';
import { sectionTypographyClasses } from '../section-typography';

import { committed, type Drawing, type SvgLabel } from './chart-drawing';
import { advancedIssue, isAdvancedChart } from './advanced-contract';
import { chartPlot } from './chart-figure';
import { dataTable, seriesLegend } from './chart-keys';
import { drawnType, hasSeriesLegend } from './chart-kind';
import { hasChartData } from './chart-model';
import { groundStroke } from './chart-palette';
import { chartSchema, type ChartProps } from './schema';

const FIGURE_CLASSES: Readonly<Record<ChartProps['variant'], string>> = {
  card: 'rounded-xl border border-current/10 bg-surface p-5 text-text shadow-soft @md:p-6',
  plain: '',
};

/** An accessible SVG chart — bars, lines, areas, points, a web, a funnel, dials, trends or slices — with no client script. */
export function Chart({ node, props, isCanvas }: BlockRenderProps<ChartProps>) {
  const titleId = `${node.id}-title`;
  const descriptionId = `${node.id}-description`;
  /* Each inner element is a part: addressable on the canvas, stylable per part. */
  const part = blockPartProps({ node, props, isCanvas }, chartSchema.parts);
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);
  const colorStyle = sectionColorStyle(props);
  const spacingStyle = sectionSpacingStyle(props);
  const style =
    colorStyle === undefined && spacingStyle === undefined
      ? undefined
      : { ...colorStyle, ...spacingStyle };
  const hasTitle = props.title !== undefined;
  const hasDescription = props.description !== undefined;
  const kind = drawnType(props);
  const hasData = hasChartData(props) && advancedIssue(props) === undefined;
  const names = props.series.map((entry) => committed(entry.name)).filter((name) => name !== '');
  /* Named by the visible title; without one, by its series, so the picture always has a name. */
  const svgLabel: SvgLabel = {
    role: 'img',
    ...(hasTitle
      ? { 'aria-labelledby': titleId }
      : { 'aria-label': names.join(', ') || props.chartType }),
    ...(hasDescription ? { 'aria-describedby': descriptionId } : {}),
  };
  const drawing: Drawing = {
    props,
    part,
    svgLabel,
    ring: groundStroke(props.variant, props.tone),
    muted:
      props.variant === 'plain' && props.tone === 'dark'
        ? 'text-inherit opacity-80'
        : 'text-text-muted',
    isCanvas,
  };

  /*
    A card is a light surface even on a dark section. The slab rules recolour
    `text-text` on the card itself, but revert it on the card's descendants, so
    the card's ink is set on its children (section-tone.ts).
  */
  const ink = props.variant === 'card' ? 'text-text' : undefined;

  let plot: ReactNode = null;
  if (isAdvancedChart(props.chartType)) {
    plot = chartPlot(drawing);
  } else if (!hasData) {
    /* Nothing to draw: the canvas shows where the chart will be; a published page shows nothing. */
    plot = isCanvas ? (
      <div
        className="min-h-40 rounded-lg border border-dashed border-current/20"
        aria-hidden="true"
        data-chart-empty=""
      />
    ) : null;
  } else {
    plot = chartPlot(drawing);
  }

  return (
    <section
      className={cx(
        sectionShellClasses(props.tone, props.spacing),
        '@container',
        sectionTypographyClasses(props),
        motionClassName,
        props.className,
      )}
      {...motionData}
      style={style}
      aria-labelledby={hasTitle ? titleId : undefined}
    >
      <div
        className={cx(
          sectionContentClasses(props.width, props.align, props.gutter),
          'flex flex-col',
          ALIGN_CLASSES[props.align],
          GAP_CLASSES.md,
        )}
        data-chart-content=""
      >
        <figure
          className={cx('m-0 flex w-full min-w-0 flex-col gap-gap', FIGURE_CLASSES[props.variant])}
          data-chart={props.chartType}
          data-chart-drawn={kind === props.chartType ? undefined : kind}
        >
          {hasTitle || hasDescription ? (
            <figcaption className={cx('flex flex-col gap-gap-xs', ink)}>
              {hasTitle ? (
                <h2
                  {...part('title', {
                    id: titleId,
                    className:
                      'm-0 text-xl leading-tight font-bold tracking-tight text-balance @md:text-2xl',
                  })}
                >
                  {props.title}
                </h2>
              ) : null}
              {hasDescription ? (
                <p
                  {...part('description', {
                    id: descriptionId,
                    className: cx('m-0 text-sm leading-relaxed', drawing.muted),
                  })}
                >
                  {props.description}
                </p>
              ) : null}
            </figcaption>
          ) : null}
          <div className={cx('flex min-w-0 flex-col gap-gap', ink)} data-chart-body="">
            {plot}
            {hasData && hasSeriesLegend(kind, props) ? seriesLegend(drawing) : null}
            {/* Published only: on the canvas it would repeat every label the person edits in place. */}
            {hasData && !isCanvas ? dataTable(props) : null}
          </div>
        </figure>
      </div>
    </section>
  );
}
