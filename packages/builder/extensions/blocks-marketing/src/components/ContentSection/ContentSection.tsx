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

import { contentSectionSchema, type ContentSectionProps } from './schema';

const MEDIA_POSITION_CLASSES: Record<ContentSectionProps['mediaPosition'], string> = {
  start: 'order-first',
  end: 'order-last',
};

const IMAGE_FIT_CLASSES: Record<ContentSectionProps['imageFit'], string> = {
  cover: 'object-cover',
  contain: 'object-contain',
};

/** Long-form marketing copy paired with optional media and concise supporting proof. */
export function ContentSection({ node, props, isCanvas }: BlockRenderProps<ContentSectionProps>) {
  const headingId = `${node.id}-heading`;
  /* Each inner element is a part: addressable on the canvas, stylable per part. */
  const part = blockPartProps({ node, props, isCanvas }, contentSectionSchema.parts);
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);
  const colorStyle = sectionColorStyle(props);
  const spacingStyle = sectionSpacingStyle(props);
  const rootStyle =
    colorStyle === undefined && spacingStyle === undefined
      ? undefined
      : { ...colorStyle, ...spacingStyle };
  const hasMedia = props.imageSrc !== undefined;

  return (
    <section
      className={cx(
        sectionShellClasses(props.tone, props.spacing),
        '@container',
        sectionTypographyClasses(props),
        motionClassName,
        props.className,
      )}
      style={rootStyle}
      aria-labelledby={headingId}
      {...motionData}
    >
      <div
        className={cx(
          sectionContentClasses(props.width, props.align, props.gutter),
          'grid grid-cols-1 items-center',
          hasMedia && props.layout !== 'stacked' ? '@lg:grid-cols-2' : undefined,
          GAP_CLASSES.lg,
        )}
        data-content-section-layout={props.layout}
      >
        <div
          className={cx(
            'flex min-w-0 flex-col',
            ALIGN_CLASSES[props.align],
            GAP_CLASSES.md,
            props.layout === 'editorial' ? 'border-s-4 border-accent ps-gap-lg' : undefined,
          )}
          data-content-section-copy=""
        >
          <div className={cx('flex max-w-content-standard flex-col', GAP_CLASSES.sm)}>
            {props.eyebrow === undefined ? null : (
              <p
                {...part('eyebrow', {
                  className: cx(
                    'm-0 text-sm font-semibold tracking-wide uppercase',
                    props.tone === 'dark' ? 'text-inherit opacity-70' : 'text-text-muted',
                  ),
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
            <p
              {...part('body', {
                className: cx(
                  'm-0 max-w-content-narrow text-lg leading-relaxed text-pretty',
                  props.tone === 'dark' ? 'text-inherit opacity-85' : 'text-text-muted',
                ),
              })}
            >
              {props.body}
            </p>
          </div>

          {props.highlights.length === 0 ? null : (
            <ul
              {...part('highlights', {
                className: 'm-0 grid w-full list-none gap-gap p-0 @sm:grid-cols-2',
              })}
              data-content-highlights=""
            >
              {props.highlights.map((highlight, index) => (
                /* Keyed by position: a bound value may be an inline editor element. */
                <li
                  key={index}
                  {...part('highlight', {
                    index: [index],
                    className: 'border-s border-accent ps-gap text-start',
                  })}
                >
                  <h3
                    {...part('highlight.title', {
                      index: [index],
                      className: 'm-0 text-base font-semibold',
                    })}
                  >
                    {highlight.title}
                  </h3>
                  <p
                    {...part('highlight.body', {
                      index: [index],
                      className: cx(
                        'mt-gap-xs mb-0 text-sm leading-relaxed',
                        props.tone === 'dark' ? 'text-inherit opacity-75' : 'text-text-muted',
                      ),
                    })}
                  >
                    {highlight.body}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {props.link === undefined ? null : (
            <a
              {...part('link', {
                className:
                  'inline-flex min-h-11 items-center justify-center self-start rounded-lg bg-accent px-control-inline-md py-control-block-md font-semibold text-accent-text shadow-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              })}
              href={props.link.href}
            >
              {props.link.label}
            </a>
          )}
        </div>

        {hasMedia ? (
          <figure
            className={cx(
              'm-0 min-w-0 overflow-hidden rounded-xl border border-text-muted/20 bg-surface p-gap-sm text-text shadow-elevated',
              MEDIA_POSITION_CLASSES[props.mediaPosition],
            )}
            data-content-section-media=""
          >
            <img
              {...part('image', {
                className: cx(
                  'block aspect-video h-full min-h-64 w-full rounded-lg bg-surface',
                  IMAGE_FIT_CLASSES[props.imageFit],
                ),
              })}
              src={props.imageSrc}
              alt={props.imageAlt}
              loading="lazy"
              decoding="async"
            />
            {props.caption === undefined ? null : (
              <figcaption
                {...part('caption', {
                  className: 'px-gap-sm pt-gap-sm pb-gap-xs text-start text-sm text-text-muted',
                })}
              >
                {props.caption}
              </figcaption>
            )}
          </figure>
        ) : null}
      </div>
    </section>
  );
}
