import '../section-layout.css';

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

import { chartPlot } from '../Chart/chart-figure';
import type { Drawing, SvgLabel } from '../Chart/chart-drawing';
import { dataTable, seriesLegend } from '../Chart/chart-keys';
import { drawnType, hasSeriesLegend } from '../Chart/chart-kind';
import { hasChartData } from '../Chart/chart-model';
import { groundStroke } from '../Chart/chart-palette';

import { kpiCards } from './report-kpis';
import { kpiModels, reportChartProps, reportHosts, type ReportView } from './report-model';
import { reportTable } from './report-table';
import { reportSchema, type ReportProps } from './schema';

const FIGURE_CLASSES: Readonly<Record<ReportProps['variant'], string>> = {
  card: 'rounded-xl border border-current/10 bg-surface p-5 shadow-soft @md:p-6',
  plain: '',
};

/**
 * One dataset as a report section: a title and summary, up to eight KPI cards
 * computed from the data, one chart drawn by the Chart block's own figures
 * (accessible SVG, no script), and an optional table of the numbers.
 */
export function Report({ node, props, isCanvas }: BlockRenderProps<ReportProps>) {
  const titleId = `${node.id}-title`;
  const summaryId = `${node.id}-summary`;
  const dataNoteId = `${node.id}-data-note`;
  /* Each inner element is a part: addressable on the canvas, stylable per part. */
  const part = blockPartProps({ node, props, isCanvas }, reportSchema.parts);
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);
  const colorStyle = sectionColorStyle(props);
  const spacingStyle = sectionSpacingStyle(props);
  const style =
    colorStyle === undefined && spacingStyle === undefined
      ? undefined
      : { ...colorStyle, ...spacingStyle };
  const hasSummary = props.summary !== undefined;
  // Keep inline-editor elements visible; a blank stored note means it was cleared.
  const hasDataNote =
    props.dataNote !== undefined &&
    (typeof props.dataNote !== 'string' || props.dataNote.trim() !== '');
  const descriptionIds = [hasSummary ? summaryId : undefined, hasDataNote ? dataNoteId : undefined]
    .filter((id) => id !== undefined)
    .join(' ');
  const kpis = kpiModels(props);
  const hosts = reportHosts(props, kpis);
  /* The chart shows a label as it is only while nothing else (the table, a card) hosts it. */
  const chartProps = reportChartProps(props, {
    labels: hosts.labelsInTable ? 'committed' : 'raw',
    affixes: hosts.affixes === 'chart' ? 'raw' : 'committed',
    target: hosts.targetKpi >= 0 ? 'committed' : 'raw',
  });
  const kind = drawnType(chartProps);
  const hasData = hasChartData(chartProps);
  const onCard = props.variant === 'card';
  const muted = !onCard && props.tone === 'dark' ? 'text-inherit opacity-80' : 'text-text-muted';
  const ink = onCard ? 'text-text' : undefined;
  /* The picture is named by the report's title and described by its summary. */
  const svgLabel: SvgLabel = {
    role: 'img',
    'aria-labelledby': titleId,
    ...(descriptionIds === '' ? {} : { 'aria-describedby': descriptionIds }),
  };
  const drawing: Drawing = {
    props: chartProps,
    part,
    svgLabel,
    ring: groundStroke(props.variant, props.tone),
    muted,
    isCanvas,
  };
  const view: ReportView = {
    props,
    part,
    values: { ...drawing, props: reportChartProps(props, { labels: 'raw', affixes: 'raw' }) },
    hosts,
    muted,
    ink,
  };

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
      aria-labelledby={titleId}
    >
      <div
        className={cx(
          sectionContentClasses(props.width, props.align, props.gutter),
          'flex flex-col',
          ALIGN_CLASSES[props.align],
          GAP_CLASSES.md,
        )}
        data-report-content=""
      >
        <header className="flex w-full flex-col gap-gap-xs">
          <h2
            {...part('title', {
              id: titleId,
              className:
                'm-0 text-2xl leading-tight font-bold tracking-tight text-balance @md:text-3xl',
            })}
          >
            {props.title}
          </h2>
          {hasSummary ? (
            <p
              {...part('summary', {
                id: summaryId,
                className: cx(
                  'm-0 max-w-prose text-base leading-relaxed',
                  props.tone === 'dark' ? 'text-inherit opacity-80' : 'text-text-muted',
                ),
              })}
            >
              {props.summary}
            </p>
          ) : null}
        </header>
        {kpis.length > 0 ? <div className="w-full">{kpiCards(kpis, view)}</div> : null}
        {!hasData && !isCanvas ? null : (
          <figure
            className={cx(
              'm-0 flex w-full min-w-0 flex-col gap-gap',
              FIGURE_CLASSES[props.variant],
            )}
            data-chart={props.chartType}
            data-report-chart=""
          >
            <div className={cx('flex min-w-0 flex-col gap-gap', ink)} data-chart-body="">
              {hasData ? chartPlot(drawing) : null}
              {/* Nothing to draw: the canvas shows where the chart will be; a published page shows nothing. */}
              {!hasData && isCanvas ? (
                <div
                  className="min-h-40 rounded-lg border border-dashed border-current/20"
                  aria-hidden="true"
                  data-chart-empty=""
                />
              ) : null}
              {hasData && hasSeriesLegend(kind, chartProps) ? seriesLegend(drawing) : null}
              {/* Without the visible table, the screen-reader one (published only) carries the numbers. */}
              {hasData && !isCanvas && !hosts.labelsInTable ? dataTable(chartProps) : null}
            </div>
          </figure>
        )}
        {hasDataNote ? (
          <p
            {...part('dataNote', {
              id: dataNoteId,
              className: cx(
                'm-0 w-full text-sm leading-relaxed',
                props.tone === 'dark' ? 'text-inherit opacity-80' : 'text-text-muted',
              ),
            })}
            data-report-note=""
          >
            {props.dataNote}
          </p>
        ) : null}
        {hosts.labelsInTable ? reportTable(view, titleId) : null}
      </div>
    </section>
  );
}
