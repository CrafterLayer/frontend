import '../section-layout.css';

import type { BlockRenderProps } from '@craftkit/builder-schema';

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

import type { BlogGridProps } from './schema';

const COLUMN_CLASSES: Record<BlogGridProps['columns'], string> = {
  '2': 'grid-cols-1 @lg:grid-cols-2',
  '3': 'grid-cols-1 @md:grid-cols-2 @xl:grid-cols-3',
};

const ARTICLE_CLASSES: Record<BlogGridProps['variant'], string> = {
  cards:
    'group flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-text/10 bg-surface text-text shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-elevated',
  editorial:
    'group grid min-w-0 grid-cols-1 overflow-hidden rounded-xl border border-text/10 bg-surface p-3 text-text shadow-soft transition duration-300 hover:shadow-elevated @md:grid-cols-3 @md:gap-gap',
  featured:
    'group flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-text/10 bg-surface text-text shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-elevated',
};

/** An editorial article collection with semantic metadata and a first-class featured layout. */
export function BlogGrid({ node, props }: BlockRenderProps<BlogGridProps>) {
  const headingId = `${node.id}-heading`;
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);
  const colorStyle = sectionColorStyle(props);
  const spacingStyle = sectionSpacingStyle(props);
  const style =
    colorStyle === undefined && spacingStyle === undefined
      ? undefined
      : { ...colorStyle, ...spacingStyle };

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
        data-blog-grid-content=""
      >
        <header
          className={cx(
            'flex max-w-content-narrow flex-col gap-gap-sm',
            ALIGN_CLASSES[props.align],
          )}
        >
          {props.eyebrow === undefined ? null : (
            <p className="m-0 inline-flex rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold tracking-wide text-accent uppercase">
              {props.eyebrow}
            </p>
          )}
          <h2
            id={headingId}
            className="m-0 text-3xl leading-tight font-bold tracking-tight text-balance @md:text-4xl"
          >
            {props.heading}
          </h2>
          {props.body === undefined ? null : (
            <p
              className={cx(
                'm-0 text-lg leading-relaxed',
                props.tone === 'dark' ? 'text-inherit opacity-80' : 'text-text-muted',
              )}
            >
              {props.body}
            </p>
          )}
        </header>

        <ul
          className={cx(
            'm-0 grid w-full list-none p-0',
            COLUMN_CLASSES[props.columns],
            GAP_CLASSES.lg,
          )}
          data-blog-grid-list=""
        >
          {props.posts.map((post, index) => {
            const isFeatured =
              props.variant === 'featured' && (post.featured === true || index === 0);

            return (
              <li
                key={`${post.title}-${post.href}`}
                className={cx(
                  isFeatured ? '@lg:col-span-2' : undefined,
                  props.variant === 'editorial' ? 'min-w-0' : undefined,
                )}
              >
                <article
                  className={cx(
                    ARTICLE_CLASSES[props.variant],
                    isFeatured ? '@lg:grid @lg:grid-cols-2' : undefined,
                  )}
                  data-blog-card={isFeatured ? 'featured' : 'standard'}
                >
                  {!props.showImages || post.imageSrc === undefined ? null : (
                    <div
                      className={cx(
                        'overflow-hidden bg-accent/10',
                        props.variant === 'editorial'
                          ? 'aspect-video rounded-xl @md:aspect-square'
                          : 'aspect-video',
                        isFeatured ? '@lg:aspect-auto @lg:min-h-72' : undefined,
                      )}
                    >
                      <img
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none"
                        src={post.imageSrc}
                        alt={post.imageAlt ?? ''}
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  )}

                  <div
                    className={cx(
                      'flex min-w-0 flex-1 flex-col gap-gap-sm',
                      props.variant === 'editorial' ? 'p-3 @md:col-span-2 @md:py-gap-sm' : 'p-6',
                      isFeatured ? '@lg:justify-center @lg:p-8' : undefined,
                    )}
                  >
                    {post.category === undefined ? null : (
                      <p className="m-0 inline-flex self-start rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold tracking-wide text-accent uppercase">
                        {post.category}
                      </p>
                    )}
                    <h3
                      className={cx(
                        'm-0 leading-tight font-semibold tracking-tight text-balance',
                        isFeatured ? 'text-2xl @lg:text-3xl' : 'text-xl',
                      )}
                    >
                      {post.title}
                    </h3>
                    <p className="m-0 leading-relaxed text-text-muted">{post.excerpt}</p>

                    {post.author === undefined &&
                    post.publishedLabel === undefined &&
                    post.readingTime === undefined ? null : (
                      <p className="m-0 flex flex-wrap items-center gap-x-gap-sm gap-y-1 text-sm text-text-muted">
                        {post.author === undefined ? null : <span>{post.author}</span>}
                        {post.publishedLabel === undefined ? null : (
                          <time dateTime={post.dateTime}>{post.publishedLabel}</time>
                        )}
                        {post.readingTime === undefined ? null : <span>{post.readingTime}</span>}
                      </p>
                    )}

                    <a
                      className="mt-auto inline-flex min-h-11 items-center self-start font-semibold text-accent underline-offset-4 transition hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                      href={post.href}
                      aria-label={`${props.actionLabel}: ${post.title}`}
                    >
                      {props.actionLabel}
                      <span aria-hidden="true" className="ms-gap-xs">
                        ↗
                      </span>
                    </a>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
