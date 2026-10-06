import '../section-layout.css';

import type { MouseEvent } from 'react';

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

import { gallerySchema, type GalleryProps } from './schema';

const GRID_COLUMN_CLASSES: Readonly<Record<GalleryProps['columns'], string>> = {
  '2': 'grid-cols-1 @sm:grid-cols-2',
  '3': 'grid-cols-1 @sm:grid-cols-2 @xl:grid-cols-3',
  '4': 'grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-3 @xl:grid-cols-4',
};

const ASPECT_CLASSES: Readonly<Record<GalleryProps['aspect'], string>> = {
  landscape: 'aspect-video',
  square: 'aspect-square',
  portrait: 'aspect-3/4',
};

const FIT_CLASSES: Readonly<Record<GalleryProps['imageFit'], string>> = {
  cover: 'object-cover',
  contain: 'object-contain',
};

function preventCanvasNavigation(event: MouseEvent<HTMLAnchorElement>): void {
  event.preventDefault();
}

/** A responsive editorial gallery built from semantic figures and optional safe full-size links. */
export function Gallery({ node, props, isCanvas }: BlockRenderProps<GalleryProps>) {
  const headingId = `${node.id}-heading`;
  /* Each inner element is a part: addressable on the canvas, stylable per part. */
  const part = blockPartProps({ node, props, isCanvas }, gallerySchema.parts);
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
        data-gallery-content=""
      >
        <header
          className={cx(
            'flex max-w-content-narrow flex-col gap-gap-sm',
            ALIGN_CLASSES[props.align],
          )}
        >
          {props.eyebrow === undefined ? null : (
            <p
              {...part('eyebrow', {
                className:
                  'm-0 inline-flex rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold tracking-wide text-accent uppercase',
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
            <p
              {...part('body', {
                className: cx(
                  'm-0 text-lg leading-relaxed text-pretty',
                  props.tone === 'dark' ? 'text-inherit opacity-80' : 'text-text-muted',
                ),
              })}
            >
              {props.body}
            </p>
          )}
        </header>

        {props.items.length === 0 && isCanvas ? (
          <p className="m-0 grid min-h-64 w-full place-items-center rounded-xl border border-dashed border-current/25 bg-current/5 p-6 text-center text-sm font-semibold">
            Add images to build this gallery.
          </p>
        ) : null}

        {props.items.length === 0 ? null : (
          <ul
            {...part('items', {
              className: cx(
                'm-0 grid w-full list-none items-stretch gap-4 p-0 @lg:gap-6',
                props.layout === 'grid'
                  ? GRID_COLUMN_CLASSES[props.columns]
                  : 'grid-cols-1 @sm:grid-cols-2',
              ),
            })}
            data-gallery-list={props.layout}
          >
            {props.items.map((item, index) => {
              const at = [index];
              const isFeatured =
                props.layout === 'editorial' && (item.featured === true || index === 0);
              const trimmedAlt = item.alt.trim();
              const showCaption = props.showCaptions && item.caption !== undefined;
              const linkId = `${node.id}-image-${String(index)}-link`;
              const captionId = `${node.id}-image-${String(index)}-caption`;
              /*
                The link's name: its label and the alt text; with no alt, its
                label then the visible caption or section heading, read through
                aria-labelledby so a bound value never reaches an attribute.
              */
              const linkName =
                trimmedAlt.length > 0
                  ? { 'aria-label': `${props.linkLabel}: ${trimmedAlt}` }
                  : {
                      id: linkId,
                      'aria-label': `${props.linkLabel}:`,
                      'aria-labelledby': `${linkId} ${showCaption ? captionId : headingId}`,
                    };
              const image = (
                <img
                  {...part('item.image', {
                    index: at,
                    className: cx(
                      'block h-full w-full bg-accent/10',
                      FIT_CLASSES[props.imageFit],
                      props.linkImages
                        ? 'transition duration-500 group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none'
                        : undefined,
                    ),
                  })}
                  src={item.src}
                  alt={item.decorative ? '' : item.alt}
                  loading="lazy"
                  decoding="async"
                />
              );

              return (
                <li
                  key={`${item.src}-${String(index)}`}
                  {...part('item', {
                    index: at,
                    className: cx(isFeatured ? '@sm:col-span-2' : undefined),
                  })}
                  data-gallery-item={isFeatured ? 'featured' : 'standard'}
                >
                  <figure className="relative m-0 flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-text/10 bg-surface text-text shadow-soft">
                    <div
                      className={cx(
                        'relative overflow-hidden bg-accent/10',
                        isFeatured ? 'aspect-video' : ASPECT_CLASSES[props.aspect],
                      )}
                    >
                      {props.linkImages ? (
                        <a
                          className="group block h-full w-full cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                          href={item.href ?? item.src}
                          target={props.newTab ? '_blank' : undefined}
                          rel={props.newTab ? 'noreferrer' : undefined}
                          {...linkName}
                          onClick={isCanvas ? preventCanvasNavigation : undefined}
                        >
                          {image}
                        </a>
                      ) : (
                        image
                      )}
                    </div>

                    {showCaption ? (
                      <figcaption
                        {...part('item.caption', {
                          index: at,
                          id: captionId,
                          className: cx(
                            'text-start text-sm leading-relaxed',
                            props.captionStyle === 'below'
                              ? 'p-4 text-text-muted'
                              : 'absolute inset-x-3 bottom-3 rounded-lg bg-surface-inverse/90 p-3 text-text-inverse shadow-soft',
                          ),
                        })}
                      >
                        {item.caption}
                      </figcaption>
                    ) : null}

                    {isCanvas && !item.decorative && item.alt.trim().length === 0 ? (
                      <p className="m-0 border-t border-text/10 px-4 py-3 text-start text-xs font-semibold text-text-muted">
                        This image needs alt text.
                      </p>
                    ) : null}
                  </figure>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
