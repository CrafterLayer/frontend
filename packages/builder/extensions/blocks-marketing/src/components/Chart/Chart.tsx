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
import { dataTable, seriesLegend } from './chart-keys';
import { cartesianModel, hasChartData, pieModel } from './chart-model';
import { groundStroke } from './chart-palette';
import { pieFigure } from './chart-pie';
import { cartesianFigure } from './chart-plot';
import { chartSchema, type ChartProps } from './schema';

const FIGURE_CLASSES: Readonly<Record<ChartProps['variant'], string>> = {
  card: 'rounded-xl border border-current/10 bg-surface p-5 text-text shadow-soft @md:p-6',
  plain: '',
};

/** An accessible SVG chart — bar, line, area, pie or donut — that renders without client script. */
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
  const pie = props.chartType === 'pie' || props.chartType === 'donut';
  const hasData = hasChartData(props);
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
  };

  let plot: ReactNode = null;
  if (!hasData) {
    /* Nothing to draw: the canvas shows where the chart will be; a published page shows nothing. */
    plot = isCanvas ? (
      <div
        className="min-h-40 rounded-lg border border-dashed border-current/20"
        aria-hidden="true"
        data-chart-empty=""
      />
    ) : null;
  } else if (pie) {
    plot = pieFigure(pieModel(props), drawing);
  } else {
    plot = cartesianFigure(cartesianModel(props), drawing);
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
        >
          {hasTitle || hasDescription ? (
            <figcaption className="flex flex-col gap-gap-xs">
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
          {plot}
          {hasData && !pie && props.showLegend && props.series.length > 1
            ? seriesLegend(drawing)
            : null}
          {hasData ? dataTable(props, pie) : null}
        </figure>
      </div>
    </section>
  );
}
