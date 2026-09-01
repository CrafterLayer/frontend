import '../section-layout.css';

import type { MouseEvent } from 'react';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import {
  ALIGN_CLASSES,
  GAP_CLASSES,
  cx,
  sectionContentClasses,
  sectionShellClasses,
} from '../section-classes';
import { sectionColorStyle } from '../section-color';
import { sectionMotionAttributes } from '../section-motion';
import { sectionSpacingStyle } from '../section-spacing';
import { sectionTypographyClasses } from '../section-typography';

import type { ProductGridProps } from './schema';

const GRID_CLASSES: Record<ProductGridProps['columns'], string> = {
  '2': 'grid-cols-1 @md:grid-cols-2',
  '3': 'grid-cols-1 @md:grid-cols-2 @xl:grid-cols-3',
  '4': 'grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-3 @xl:grid-cols-4',
};

const RATIO_CLASSES: Record<ProductGridProps['imageRatio'], string> = {
  square: 'aspect-square',
  portrait: 'aspect-4/5',
};

const STAR_PATH =
  'M10 1.5 12.47 6.51 18 7.31 14 11.21 14.94 16.72 10 14.12 5.06 16.72 6 11.21 2 7.31 7.53 6.51 10 1.5Z';

function preventCanvasNavigation(event: MouseEvent<HTMLAnchorElement>): void {
  event.preventDefault();
}

/** Commerce-ready product cards with pricing, ratings, merchandising badges, and safe actions. */
export function ProductGrid({ node, props, isCanvas }: BlockRenderProps<ProductGridProps>) {
  const headingId = `${node.id}-heading`;
  const explicitlyFeatured = props.products.findIndex((product) => product.featured === true);
  const featuredIndex = explicitlyFeatured < 0 ? 0 : explicitlyFeatured;
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
        data-product-grid-content=""
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

        {props.products.length === 0 ? (
          isCanvas ? (
            <div
              className="grid min-h-56 w-full place-items-center rounded-xl border border-dashed border-text-muted/30 bg-surface p-8 text-center text-text shadow-soft"
              role="status"
            >
              <span className="flex max-w-content-narrow flex-col items-center gap-gap-sm">
                <strong className="text-lg leading-tight font-semibold">
                  Add products to build a polished, shoppable collection.
                </strong>
                <span className="text-sm leading-relaxed text-text-muted">
                  Add pricing and a safe product link, then enrich each card with imagery, ratings,
                  or merchandising badges.
                </span>
              </span>
            </div>
          ) : null
        ) : (
          <ul
            className={cx(
              'm-0 grid w-full list-none p-0',
              GRID_CLASSES[props.columns],
              GAP_CLASSES.md,
            )}
            data-product-grid={props.variant}
          >
            {props.products.map((product, index) => {
              const isFeatured = props.variant === 'featured' && index === featuredIndex;
              const rating = product.rating;

              return (
                <li
                  key={`${product.name}-${product.href}`}
                  className={cx('min-w-0', isFeatured ? '@xl:col-span-2' : undefined)}
                >
                  <article
                    className={cx(
                      'group relative h-full min-w-0 overflow-hidden rounded-xl border bg-surface text-text shadow-soft transition hover:-translate-y-1 hover:shadow-elevated motion-reduce:transform-none motion-reduce:transition-none',
                      isFeatured
                        ? 'border-accent @lg:grid @lg:grid-cols-2'
                        : 'flex flex-col border-text/10',
                    )}
                    data-product-card={isFeatured ? 'featured' : 'standard'}
                  >
                    <div
                      className={cx(
                        'relative grid w-full place-items-center overflow-hidden bg-accent/10 text-accent',
                        RATIO_CLASSES[props.imageRatio],
                        isFeatured ? '@lg:aspect-auto @lg:min-h-80' : undefined,
                      )}
                    >
                      {product.imageSrc === undefined ? (
                        <span aria-hidden="true" className="text-4xl font-bold opacity-30">
                          {product.name.trim().slice(0, 1).toLocaleUpperCase()}
                        </span>
                      ) : (
                        <img
                          className="h-full w-full object-cover transition group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none"
                          src={product.imageSrc}
                          alt={product.imageAlt ?? ''}
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                      {product.badge === undefined ? null : (
                        <span className="absolute start-4 top-4 inline-flex rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-text shadow-soft">
                          {product.badge}
                        </span>
                      )}
                    </div>

                    <div
                      className={cx(
                        'flex min-w-0 flex-1 flex-col gap-gap-sm p-6',
                        isFeatured ? '@lg:justify-center @lg:p-8' : undefined,
                      )}
                    >
                      <h3
                        className={cx(
                          'm-0 leading-tight font-semibold tracking-tight text-balance',
                          isFeatured ? 'text-3xl' : 'text-xl',
                        )}
                      >
                        {product.name}
                      </h3>
                      {product.description === undefined ? null : (
                        <p className="m-0 leading-relaxed text-text-muted">{product.description}</p>
                      )}

                      {!props.showRatings || rating === undefined ? null : (
                        <div
                          className="flex flex-wrap items-center gap-gap-xs text-sm"
                          role="img"
                          aria-label={
                            product.ratingLabel ??
                            `${props.ratingPrefix} ${rating.toFixed(1)} ${props.ratingSuffix}${product.reviewCount === undefined ? '' : `, ${String(product.reviewCount)} ${props.reviewCountLabel}`}`
                          }
                        >
                          <span aria-hidden="true" className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }, (_, starIndex) => {
                              const fillSteps = Math.max(
                                0,
                                Math.min(10, Math.round((rating - starIndex) * 10)),
                              );
                              const fill = fillSteps / 10;
                              const clipId = `${node.id}-rating-${String(index)}-${String(starIndex)}`;

                              return (
                                <svg
                                  key={clipId}
                                  aria-hidden="true"
                                  className="size-4 shrink-0 rtl:-scale-x-100"
                                  viewBox="0 0 20 20"
                                  data-rating-fill={fill.toFixed(1)}
                                >
                                  <path
                                    className="fill-current text-text-muted opacity-30"
                                    d={STAR_PATH}
                                  />
                                  {fill === 0 ? null : (
                                    <>
                                      <defs>
                                        <clipPath id={clipId}>
                                          <rect width={fill * 20} height="20" />
                                        </clipPath>
                                      </defs>
                                      <path
                                        className="fill-current text-accent"
                                        clipPath={`url(#${clipId})`}
                                        d={STAR_PATH}
                                      />
                                    </>
                                  )}
                                </svg>
                              );
                            })}
                          </span>
                          <span aria-hidden="true" className="font-semibold text-text">
                            {rating.toFixed(1)}
                          </span>
                          {product.reviewCount === undefined ? null : (
                            <span aria-hidden="true" className="text-text-muted">
                              ({product.reviewCount})
                            </span>
                          )}
                        </div>
                      )}

                      <p className="m-0 flex flex-wrap items-baseline gap-gap-sm">
                        <span className="text-2xl leading-tight font-bold tracking-tight">
                          {product.price}
                        </span>
                        {product.originalPrice === undefined ? null : (
                          <del className="text-sm text-text-muted">{product.originalPrice}</del>
                        )}
                      </p>

                      <a
                        className="mt-auto inline-flex min-h-12 items-center justify-center rounded-xl border border-accent bg-accent px-control-inline-lg py-control-block-md font-semibold text-accent-text shadow-soft transition hover:-translate-y-0.5 hover:shadow-elevated focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent motion-reduce:transform-none motion-reduce:transition-none"
                        href={product.href}
                        aria-label={`${props.actionLabel}: ${product.name}`}
                        onClick={isCanvas ? preventCanvasNavigation : undefined}
                      >
                        {props.actionLabel}
                      </a>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
