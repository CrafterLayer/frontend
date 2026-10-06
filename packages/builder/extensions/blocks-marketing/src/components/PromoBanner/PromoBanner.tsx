import '../section-layout.css';

import type { MouseEvent } from 'react';

import { blockPartProps, type BlockRenderProps } from '@craftkit/builder-schema';

import {
  ALIGN_CLASSES,
  GAP_CLASSES,
  JUSTIFY_CLASSES,
  cx,
  sectionContentClasses,
  sectionShellClasses,
} from '../section-classes';
import { sectionColorStyle } from '../section-color';
import { sectionMotionAttributes } from '../section-motion-attributes';
import { sectionSpacingStyle } from '../section-spacing';
import { sectionTypographyClasses } from '../section-typography';

import { promoBannerSchema, type PromoBannerProps } from './schema';

const PANEL_STYLE_CLASSES: Readonly<Record<PromoBannerProps['panelStyle'], string>> = {
  surface: 'border-text/10 bg-surface text-text shadow-strong',
  accent: 'border-accent bg-accent text-accent-text shadow-elevated',
  inverse: 'border-text-inverse/10 bg-surface-inverse text-text-inverse shadow-elevated',
};

const PRIMARY_ACTION_CLASSES: Readonly<Record<PromoBannerProps['panelStyle'], string>> = {
  surface: 'border-accent bg-accent text-accent-text',
  accent: 'border-surface-inverse bg-surface-inverse text-text-inverse',
  inverse: 'border-accent bg-accent text-accent-text',
};

const RADIUS_CLASSES: Readonly<Record<PromoBannerProps['radius'], string>> = {
  none: 'rounded-none',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
};

const PADDING_CLASSES: Readonly<Record<PromoBannerProps['padding'], string>> = {
  compact: 'p-5 @md:p-6',
  comfortable: 'p-6 @md:p-8',
  spacious: 'p-8 @md:p-10 @lg:p-12',
};

const LAYOUT_CLASSES: Readonly<Record<PromoBannerProps['variant'], string>> = {
  centered: 'flex flex-col',
  split: 'grid grid-cols-1 items-stretch @lg:grid-cols-2',
  media: 'grid grid-cols-1',
};

const MEDIA_POSITION_CLASSES: Readonly<Record<PromoBannerProps['mediaPosition'], string>> = {
  start: 'order-first',
  end: 'order-last',
};

const OVERLAY_POSITION_CLASSES: Readonly<Record<PromoBannerProps['mediaPosition'], string>> = {
  start: 'justify-self-start',
  end: 'justify-self-end',
};

const MEDIA_ASPECT_CLASSES: Readonly<Record<PromoBannerProps['mediaAspect'], string>> = {
  wide: 'aspect-video',
  square: 'aspect-square',
  portrait: 'aspect-3/4',
};

function preventCanvasNavigation(event: MouseEvent<HTMLAnchorElement>): void {
  event.preventDefault();
}

/** A campaign banner with token-bound surface, responsive media, and safe primary actions. */
export function PromoBanner({ node, props, isCanvas }: BlockRenderProps<PromoBannerProps>) {
  const headingId = `${node.id}-heading`;
  const part = blockPartProps({ node, props, isCanvas }, promoBannerSchema.parts);
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);
  const colorStyle = sectionColorStyle(props);
  const spacingStyle = sectionSpacingStyle(props);
  const rootStyle =
    colorStyle === undefined && spacingStyle === undefined
      ? undefined
      : { ...colorStyle, ...spacingStyle };
  const hasMedia = props.showMedia && props.imageSrc !== undefined;
  const isMediaOverlay = props.variant === 'media' && hasMedia;

  return (
    <aside
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
      <div className={sectionContentClasses(props.width, props.align, props.gutter)}>
        <div
          {...part('panel', {
            className: cx(
              'relative w-full min-w-0 overflow-hidden border',
              RADIUS_CLASSES[props.radius],
              LAYOUT_CLASSES[props.variant],
              props.variant === 'split' && !hasMedia ? '@lg:grid-cols-1' : undefined,
              isMediaOverlay
                ? 'border-text/10 bg-surface shadow-elevated'
                : PANEL_STYLE_CLASSES[props.panelStyle],
            ),
          })}
          data-promo-panel=""
          data-promo-variant={props.variant}
        >
          {hasMedia ? (
            <figure
              className={cx(
                /*
                  `w-full` so the TRACK decides the width and the aspect ratio
                  decides the height. Without it the overlay's `min-h-96`
                  (384px) ran through the aspect ratio the other way and forced
                  a 683px figure — which on a 360px phone is nearly twice the
                  screen. The Chromium overflow gate measured it; no amount of
                  reading the class list would have.
                */
                'm-0 w-full min-w-0 overflow-hidden bg-text-muted/10',
                isMediaOverlay ? 'col-start-1 row-start-1 min-h-64 @md:min-h-96' : undefined,
                MEDIA_ASPECT_CLASSES[props.mediaAspect],
                !isMediaOverlay ? MEDIA_POSITION_CLASSES[props.mediaPosition] : undefined,
              )}
              data-promo-media=""
            >
              <img
                {...part('image', {
                  className: cx(
                    'block h-full min-h-64 w-full object-cover',
                    isMediaOverlay ? 'min-h-96' : undefined,
                  ),
                })}
                src={props.imageSrc}
                alt={props.imageAlt}
                loading="lazy"
                decoding="async"
              />
            </figure>
          ) : null}

          <div
            className={cx(
              'relative z-10 flex min-w-0 flex-col',
              ALIGN_CLASSES[props.align],
              GAP_CLASSES.md,
              isMediaOverlay
                ? cx(
                    'col-start-1 row-start-1 m-4 max-w-content-narrow self-end border @md:m-8',
                    RADIUS_CLASSES[props.radius === 'none' ? 'lg' : props.radius],
                    PADDING_CLASSES[props.padding],
                    PANEL_STYLE_CLASSES[props.panelStyle],
                  )
                : PADDING_CLASSES[props.padding],
              isMediaOverlay ? OVERLAY_POSITION_CLASSES[props.mediaPosition] : undefined,
            )}
            data-promo-copy=""
          >
            <div className={cx('flex max-w-content-standard flex-col', GAP_CLASSES.sm)}>
              {props.label === undefined ? null : (
                <span
                  {...part('label', {
                    className:
                      'self-start rounded-full border border-current/20 bg-current/10 px-3 py-1 text-xs font-bold tracking-wide uppercase',
                  })}
                >
                  {props.label}
                </span>
              )}
              <h2
                {...part('headline', {
                  id: headingId,
                  className:
                    'm-0 text-3xl leading-tight font-bold tracking-tight text-balance @md:text-4xl',
                })}
              >
                {props.headline}
              </h2>
              {props.body === undefined ? null : (
                <p
                  {...part('body', {
                    className:
                      'm-0 max-w-content-narrow text-lg leading-relaxed text-inherit opacity-80 text-pretty',
                  })}
                >
                  {props.body}
                </p>
              )}
            </div>

            {props.actions.length === 0 ? null : (
              <div
                {...part('actions', {
                  className: cx(
                    'flex w-full flex-wrap items-center',
                    GAP_CLASSES.sm,
                    JUSTIFY_CLASSES[props.align],
                  ),
                })}
                data-promo-actions=""
              >
                {props.actions.map((action, index) => (
                  <a
                    /*
                      Keyed by position only: the label is a bound value, and
                      inline editing swaps it for an editor element.
                    */
                    key={String(index)}
                    {...part('action', {
                      index: [index],
                      className: cx(
                        'inline-flex min-h-11 items-center justify-center rounded-lg border px-control-inline-md py-control-block-md font-semibold shadow-soft focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current',
                        action.emphasis === 'primary'
                          ? PRIMARY_ACTION_CLASSES[props.panelStyle]
                          : 'border-current/25 bg-transparent text-inherit',
                      ),
                    })}
                    href={action.href}
                    onClick={isCanvas ? preventCanvasNavigation : undefined}
                  >
                    <span {...part('action.link', { index: [index] })}>{action.label}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
