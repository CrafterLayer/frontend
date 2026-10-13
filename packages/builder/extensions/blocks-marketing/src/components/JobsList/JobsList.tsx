import '../section-layout.css';

import { blockPartProps, type BlockRenderProps } from '@craftkit/builder-schema';

import { ALIGN_CLASSES, GAP_CLASSES, cx, sectionContentClasses } from '../section-classes';
import { ICON_PATHS, ICON_SVG_PROPS, type IconName } from '../section-icons';
import { mutedTextClasses, sectionRootAttributes } from '../section-root';
import { sharedText } from '../section-text';

import { jobsListSchema, type JobsListProps } from './schema';

type Job = JobsListProps['jobs'][number];
const META = [
  ['team', 'briefcase'],
  ['location', 'mapPin'],
  ['type', 'clock'],
] as const satisfies readonly (readonly [keyof Job, IconName])[];

const LIST_CLASSES: Readonly<Record<JobsListProps['layout'], string>> = {
  rows: 'flex flex-col border-y border-current/10 divide-y divide-current/10',
  cards: 'grid grid-cols-1 gap-gap @2xl:grid-cols-2',
};

const ITEM_CLASSES: Readonly<Record<JobsListProps['layout'], string>> = {
  rows: 'py-5 @2xl:flex-row @2xl:items-center @2xl:justify-between @2xl:gap-gap-lg',
  cards: 'rounded-2xl border border-current/10 p-5 hover:border-current/25',
};

/** A careers page's open positions: each a titled, linked row with its team, place and type. */
export function JobsList({ node, props, isCanvas }: BlockRenderProps<JobsListProps>) {
  const headingId = `${node.id}-heading`;
  /* Each inner element is a part: addressable on the canvas, stylable per part. */
  const part = blockPartProps({ node, props, isCanvas }, jobsListSchema.parts);
  const root = sectionRootAttributes(props);
  const muted = mutedTextClasses(props.tone);
  /* "Apply" is one part shown beside every linked job; the first linked job hosts its editor. */
  const applyHost = props.jobs.findIndex((job) => job.href !== undefined);
  const hasAction = props.actionLabel !== undefined && props.actionHref !== undefined;

  return (
    <section
      className={root.className}
      {...root.motion}
      style={root.style}
      aria-labelledby={headingId}
    >
      <div
        className={cx(
          sectionContentClasses(props.width, props.align, props.gutter),
          'flex flex-col',
          ALIGN_CLASSES[props.align],
          GAP_CLASSES.lg,
        )}
        data-jobs-list-content=""
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

        {props.jobs.length === 0 ? (
          <p
            {...part('emptyMessage', {
              className: cx(
                'm-0 w-full rounded-2xl border border-dashed border-current/20 p-8 text-center text-lg',
                muted,
              ),
            })}
          >
            {props.emptyMessage}
          </p>
        ) : (
          <ul
            {...part('jobs', {
              className: cx('m-0 w-full list-none p-0 text-start', LIST_CLASSES[props.layout]),
            })}
            data-jobs-list-layout={props.layout}
          >
            {props.jobs.map((job, index) => {
              const at = [index];
              return (
                /* Keyed by position: a bound value may be an inline editor element. */
                <li
                  key={index}
                  {...part('job', {
                    index: at,
                    className: cx(
                      'group relative flex flex-col gap-3 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent',
                      ITEM_CLASSES[props.layout],
                    ),
                  })}
                >
                  <div className="flex min-w-0 flex-col gap-2">
                    {/*
                      The heading is the part and the link inside it is a BLOCK:
                      the page's text-bidi rule gives every `a` its own
                      `unicode-bidi: plaintext`, so an inline link would be an
                      isolate inside the heading, and an Arabic title would sit
                      at the left edge.
                    */}
                    <h3
                      {...part('job.title', {
                        index: at,
                        className: 'm-0 text-lg leading-snug font-semibold text-balance',
                      })}
                    >
                      {job.href === undefined ? (
                        job.title
                      ) : (
                        <a
                          className={cx(
                            'block text-inherit no-underline group-hover:text-accent focus-visible:outline-none',
                            /* The whole row is the link; on the canvas each part stays clickable. */
                            isCanvas ? undefined : 'after:absolute after:inset-0',
                          )}
                          href={job.href}
                        >
                          {job.title}
                        </a>
                      )}
                    </h3>
                    <ul
                      className={cx(
                        'm-0 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-sm',
                        muted,
                      )}
                    >
                      {META.map(([key, icon]) =>
                        job[key] === undefined ? null : (
                          <li key={key} className="inline-flex items-center gap-1.5">
                            <svg {...ICON_SVG_PROPS} className="size-4 shrink-0 opacity-70">
                              {ICON_PATHS[icon].map((d) => (
                                <path key={d} d={d} />
                              ))}
                            </svg>
                            <span {...part(`job.${key}`, { index: at })}>{job[key]}</span>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                  {job.href === undefined ? null : (
                    /* The row's link already names the job; this is its visual affordance. */
                    <span
                      aria-hidden="true"
                      className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-accent transition-all group-hover:gap-3 motion-reduce:transition-none"
                    >
                      <span {...part('applyLabel')}>
                        {sharedText(props.applyLabel, index === applyHost)}
                      </span>
                      <svg {...ICON_SVG_PROPS} className="size-4 rtl:-scale-x-100">
                        {ICON_PATHS.arrowEnd.map((d) => (
                          <path key={d} d={d} />
                        ))}
                      </svg>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {hasAction ? (
          <a
            {...part('action', {
              className:
                'inline-flex min-h-11 items-center justify-center rounded-xl border border-current/20 px-control-inline-md py-control-block-sm font-semibold text-inherit transition hover:bg-current/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent',
            })}
            href={props.actionHref}
          >
            {props.actionLabel}
          </a>
        ) : null}
      </div>
    </section>
  );
}
