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

import { timelineSchema, type TimelineProps } from './schema';

type Item = TimelineProps['items'][number];

/*
  Alternating (from a 48rem container up): each milestone takes half the
  width, the even ones at the inline start with their marker on their END,
  the odd ones at the inline end with their marker on their START. Each is
  nudged half a marker column (`start-3` / `-start-3`, logical, so it holds in
  RTL) so every marker sits on the one centre rail. Below 48rem the list falls
  back to the vertical rail at the inline start.
*/
function itemLayoutClasses(layout: TimelineProps['layout'], index: number): string {
  if (layout !== 'alternating') return '';
  return index % 2 === 0
    ? '@3xl:w-1/2 @3xl:flex-row-reverse @3xl:start-3 @3xl:text-end'
    : '@3xl:w-1/2 @3xl:ms-auto @3xl:-start-3';
}

/* The connector to the NEXT milestone: dashed when that one is still to come. */
function connectorClasses(next: Item | undefined): string {
  if (next === undefined) return 'hidden';
  return next.status === 'upcoming'
    ? 'mt-1 w-0 flex-1 border-s-2 border-dashed border-current/25'
    : 'mt-1 w-0.5 flex-1 rounded-full bg-current/20';
}

/** Dated milestones on a rail: history, a roadmap or an agenda, as an ordered list. */
export function Timeline({ node, props, isCanvas }: BlockRenderProps<TimelineProps>) {
  const headingId = `${node.id}-heading`;
  /* Each inner element is a part: addressable on the canvas, stylable per part. */
  const part = blockPartProps({ node, props, isCanvas }, timelineSchema.parts);
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);
  const colorStyle = sectionColorStyle(props);
  const spacingStyle = sectionSpacingStyle(props);
  const style =
    colorStyle === undefined && spacingStyle === undefined
      ? undefined
      : { ...colorStyle, ...spacingStyle };
  const muted = props.tone === 'dark' ? 'text-inherit opacity-80' : 'text-text-muted';
  const last = props.items.length - 1;

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
        data-timeline-content=""
      >
        <header
          className={cx(
            'flex max-w-content-narrow flex-col',
            GAP_CLASSES.sm,
            ALIGN_CLASSES[props.align],
          )}
        >
          {props.eyebrow === undefined ? null : (
            <p
              {...part('eyebrow', {
                className: 'm-0 text-xs font-semibold tracking-wide text-accent uppercase',
              })}
            >
              {props.eyebrow}
            </p>
          )}
          <h2
            {...part('heading', {
              id: headingId,
              className:
                'm-0 text-3xl leading-tight font-bold tracking-tight text-balance @md:text-4xl',
            })}
          >
            {props.heading}
          </h2>
          {props.body === undefined ? null : (
            <p {...part('body', { className: cx('m-0 text-lg leading-relaxed', muted) })}>
              {props.body}
            </p>
          )}
        </header>

        <ol
          {...part('items', { className: 'm-0 flex w-full list-none flex-col p-0 text-start' })}
          data-timeline-layout={props.layout}
        >
          {props.items.map((item, index) => {
            const at = [index];
            const done = item.status === 'done';
            return (
              /* Keyed by position: a bound value may be an inline editor element. */
              <li
                key={index}
                {...part('item', {
                  index: at,
                  className: cx(
                    'relative flex min-w-0 gap-gap',
                    itemLayoutClasses(props.layout, index),
                  ),
                })}
                data-timeline-status={item.status}
              >
                <div className="flex w-6 shrink-0 flex-col items-center" data-timeline-marker="">
                  {/*
                    The status in words, as the marker's accessible name, so it
                    is never carried by the fill alone. A name, not a hidden
                    text node: the words are a11y-only copy, and a second text
                    node would read as an unbound value on the canvas.
                  */}
                  <span
                    role="img"
                    aria-label={done ? props.doneLabel : props.upcomingLabel}
                    className={cx(
                      'mt-1 size-4 shrink-0 rounded-full border-2 border-accent',
                      done ? 'bg-accent' : 'bg-transparent',
                    )}
                    data-timeline-dot=""
                  />
                  <span
                    aria-hidden="true"
                    className={connectorClasses(props.items[index + 1])}
                    data-timeline-connector=""
                  />
                </div>
                <div className={cx('min-w-0 flex-1', index === last ? 'pb-0' : 'pb-gap-lg')}>
                  <p
                    {...part('item.date', {
                      index: at,
                      className: cx(
                        'm-0 text-sm font-semibold tracking-wide tabular-nums',
                        done && props.tone !== 'dark' ? 'text-accent' : muted,
                      ),
                    })}
                  >
                    {item.date}
                  </p>
                  <h3
                    {...part('item.title', {
                      index: at,
                      className: 'm-0 mt-1 text-lg leading-snug font-semibold text-balance',
                    })}
                  >
                    {item.title}
                  </h3>
                  {item.badge === undefined ? null : (
                    <span
                      {...part('item.badge', {
                        index: at,
                        className:
                          'mt-2 inline-flex rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-text',
                      })}
                    >
                      {item.badge}
                    </span>
                  )}
                  {item.description === undefined ? null : (
                    <p
                      {...part('item.description', {
                        index: at,
                        className: cx('m-0 mt-2 text-sm leading-relaxed', muted),
                      })}
                    >
                      {item.description}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
