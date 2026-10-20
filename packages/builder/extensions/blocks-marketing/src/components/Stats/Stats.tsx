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

import { committed } from '../Chart/chart-drawing';
import { MetricTrend } from '../MetricTrend';

import { statsSchema, type StatsProps } from './schema';

const COLUMN_CLASSES: Readonly<Record<StatsProps['columns'], string>> = {
  auto: 'grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-4',
  '2': 'grid-cols-1 @sm:grid-cols-2',
  '3': 'grid-cols-1 @sm:grid-cols-3',
  '4': 'grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-4',
};

const ITEM_CLASSES: Readonly<Record<StatsProps['variant'], string>> = {
  cards: 'min-h-40 rounded-xl border border-text/10 bg-surface p-6 text-text shadow-soft',
  minimal: 'border-s-2 border-accent py-4 ps-5',
  contrast: 'min-h-40 rounded-xl bg-surface-inverse p-6 text-text-inverse shadow-elevated mkt-slab',
};

const SENTIMENTS = {
  positive: { symbol: '✓', label: 'Positive change' },
  negative: { symbol: '!', label: 'Negative change' },
  neutral: { symbol: '–', label: 'Neutral change' },
} as const;

/** Quantified outcomes presented as a semantic description list. */
export function Stats({ node, props, isCanvas }: BlockRenderProps<StatsProps>) {
  const headingId = `${node.id}-heading`;
  /* Each inner element is a part: addressable on the canvas, stylable per part. */
  const part = blockPartProps({ node, props, isCanvas }, statsSchema.parts);
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);
  const colorStyle = sectionColorStyle(props);
  const spacingStyle = sectionSpacingStyle(props);
  const style =
    colorStyle === undefined && spacingStyle === undefined
      ? undefined
      : { ...colorStyle, ...spacingStyle };
  const splitHeader = props.headerLayout === 'split';

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
      aria-labelledby={headingId}
    >
      <div
        className={cx(
          sectionContentClasses(props.width, props.align, props.gutter),
          'flex flex-col',
          ALIGN_CLASSES[props.align],
          GAP_CLASSES.lg,
        )}
        data-stats-content=""
      >
        <header
          className={cx(
            'flex w-full flex-col',
            splitHeader ? '@lg:flex-row @lg:items-end @lg:justify-between' : undefined,
            GAP_CLASSES.md,
          )}
          data-stats-header={props.headerLayout}
        >
          <div className={cx('flex max-w-content-narrow flex-col', GAP_CLASSES.sm)}>
            <p
              {...part('eyebrow', {
                className: 'm-0 text-xs font-semibold uppercase tracking-wide text-accent',
              })}
            >
              {props.eyebrow}
            </p>
            <h2
              {...part('heading', {
                id: headingId,
                className:
                  'm-0 text-3xl font-bold leading-tight tracking-tight text-balance @md:text-4xl',
              })}
            >
              {props.heading}
            </h2>
          </div>
          <p
            {...part('body', {
              className: cx(
                'm-0 max-w-content-narrow text-base leading-relaxed',
                props.tone === 'dark' ? 'text-inherit opacity-80' : 'text-text-muted',
              ),
            })}
          >
            {props.body}
          </p>
        </header>
        <dl
          {...part('items', {
            className: cx('m-0 grid w-full gap-4', COLUMN_CLASSES[props.columns]),
          })}
          data-stats-grid=""
        >
          {props.items.map((item, index) => {
            const at = [index];
            const sentiment = SENTIMENTS[item.sentiment ?? 'neutral'];
            return (
              /* Keyed by position: a bound value may be an inline editor element. */
              <div
                key={index}
                {...part('item', {
                  index: at,
                  className: cx('flex min-w-0 flex-col', ITEM_CLASSES[props.variant]),
                })}
                data-stat-item=""
              >
                <dt
                  {...part('item.label', {
                    index: at,
                    className: 'order-2 mt-3 text-sm font-bold uppercase tracking-wide',
                  })}
                >
                  {item.label}
                </dt>
                <dd
                  {...part('item.value', {
                    index: at,
                    className:
                      'order-1 m-0 text-3xl font-bold leading-none tracking-tight text-accent @lg:text-4xl',
                  })}
                >
                  {item.value}
                </dd>
                {item.change === undefined ? null : (
                  <dd
                    className="order-3 m-0 mt-3 flex flex-wrap items-center gap-2 text-sm"
                    data-stat-change={item.sentiment ?? 'neutral'}
                  >
                    <span
                      role="img"
                      aria-label={sentiment.label}
                      className={cx(
                        'font-bold',
                        item.sentiment === 'positive' ? 'text-success' : undefined,
                      )}
                    >
                      {sentiment.symbol}
                    </span>
                    <span
                      {...part('item.change', {
                        index: at,
                        className: 'font-semibold tabular-nums',
                      })}
                    >
                      {item.change}
                    </span>
                  </dd>
                )}
                {item.trend === undefined || item.trend.length < 2 ? null : (
                  <dd className="order-4 m-0 mt-3">
                    <MetricTrend values={item.trend} label={committed(item.label)} />
                  </dd>
                )}
                {item.progress === undefined ? null : (
                  <dd className="order-5 m-0 mt-3 flex flex-col gap-2" data-stat-progress="">
                    <div className="flex flex-wrap justify-between gap-2 text-xs">
                      {item.progressLabel === undefined ? (
                        <span className="tabular-nums">{item.progress}%</span>
                      ) : (
                        <span {...part('item.progressLabel', { index: at })}>
                          {item.progressLabel}
                        </span>
                      )}
                    </div>
                    <div
                      role="progressbar"
                      aria-label={committed(item.progressLabel) || committed(item.label)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={item.progress}
                      aria-valuetext={committed(item.progressLabel) || `${String(item.progress)}%`}
                      className="flex h-1.5 overflow-hidden rounded-full bg-current/10"
                    >
                      <span
                        className="h-full rounded-full bg-accent"
                        style={{ inlineSize: `${String(item.progress)}%` }}
                      />
                    </div>
                  </dd>
                )}
                {item.detail === undefined ? null : (
                  <dd
                    {...part('item.detail', {
                      index: at,
                      className: cx(
                        'order-6 m-0 mt-2 text-sm leading-relaxed',
                        props.variant === 'contrast' || props.tone === 'dark'
                          ? 'text-inherit opacity-75'
                          : 'text-text-muted',
                      ),
                    })}
                  >
                    {item.detail}
                  </dd>
                )}
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}
