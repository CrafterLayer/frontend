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

import { videoSectionSchema, type VideoSectionProps } from './schema';

const MEDIA_POSITION_CLASSES: Readonly<Record<VideoSectionProps['mediaPosition'], string>> = {
  start: '@lg:order-first',
  end: '@lg:order-last',
};

const VIDEO_FIT_CLASSES: Readonly<Record<VideoSectionProps['videoFit'], string>> = {
  cover: 'object-cover',
  contain: 'object-contain',
};

function preventCanvasNavigation(event: MouseEvent<HTMLAnchorElement>): void {
  event.preventDefault();
}

/** A native-video storytelling section with safe media sources and an accessible text fallback. */
export function VideoSection({ node, props, isCanvas }: BlockRenderProps<VideoSectionProps>) {
  const headingId = `${node.id}-heading`;
  /* Each inner element is a part: addressable on the canvas, stylable per part. */
  const part = blockPartProps({ node, props, isCanvas }, videoSectionSchema.parts);
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);
  const colorStyle = sectionColorStyle(props);
  const spacingStyle = sectionSpacingStyle(props);
  const style =
    colorStyle === undefined && spacingStyle === undefined
      ? undefined
      : { ...colorStyle, ...spacingStyle };
  const showMedia = props.src !== undefined || isCanvas;

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
          props.layout === 'split'
            ? cx('grid grid-cols-1 items-center', showMedia ? '@lg:grid-cols-2' : '@lg:grid-cols-1')
            : 'flex flex-col',
          props.layout === 'centered' ? ALIGN_CLASSES[props.align] : undefined,
          GAP_CLASSES.lg,
        )}
        data-video-section-layout={props.layout}
      >
        <div
          className={cx(
            'flex min-w-0 max-w-content-narrow flex-col gap-gap',
            ALIGN_CLASSES[props.align],
            props.layout === 'centered' ? 'mx-auto' : undefined,
          )}
          data-video-section-copy=""
        >
          <header
            className={cx(
              'flex flex-col gap-gap-sm',
              ALIGN_CLASSES[props.align],
              props.layout === 'centered' ? 'text-center' : undefined,
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

          {props.cta === undefined ? null : (
            <a
              {...part('cta', {
                className:
                  'inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 self-start rounded-xl border border-accent bg-accent px-control-inline-lg py-control-block-md font-semibold text-accent-text shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-elevated focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent motion-reduce:transform-none motion-reduce:transition-none',
              })}
              href={props.cta.href}
              target={props.cta.newTab ? '_blank' : undefined}
              rel={props.cta.newTab ? 'noreferrer' : undefined}
              onClick={isCanvas ? preventCanvasNavigation : undefined}
            >
              {props.cta.label}
              <span aria-hidden="true" className="text-lg leading-none">
                ↗
              </span>
            </a>
          )}
        </div>

        {showMedia ? (
          <figure
            className={cx(
              'm-0 w-full min-w-0 overflow-hidden rounded-xl border border-text/10 bg-surface p-2 text-text shadow-elevated',
              props.layout === 'centered' ? 'mx-auto max-w-content-standard' : undefined,
              props.layout === 'split' ? MEDIA_POSITION_CLASSES[props.mediaPosition] : undefined,
            )}
            data-video-section-media=""
          >
            {props.src === undefined ? (
              <div
                className="grid aspect-video w-full place-items-center rounded-lg bg-surface-inverse p-6 text-center text-text-inverse"
                role="status"
              >
                <span className="flex flex-col items-center gap-gap-sm">
                  <svg
                    aria-hidden="true"
                    className="size-12 text-accent"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M10 8.75v6.5L15 12l-5-3.25Z" fill="currentColor" />
                  </svg>
                  <span className="text-sm font-semibold">Add a safe video URL.</span>
                </span>
              </div>
            ) : (
              <video
                className={cx(
                  'block aspect-video w-full rounded-lg bg-surface-inverse',
                  VIDEO_FIT_CLASSES[props.videoFit],
                )}
                src={props.src}
                poster={props.poster}
                {...(props.videoLabel === undefined
                  ? { 'aria-labelledby': headingId }
                  : { 'aria-label': props.videoLabel })}
                controls
                playsInline
                preload={props.preload}
                muted={props.muted}
                loop={props.loop}
              >
                {props.captionsSrc === undefined ? null : (
                  <track
                    kind="captions"
                    src={props.captionsSrc}
                    srcLang={props.captionsLanguage ?? 'en'}
                    label={props.captionsLabel ?? 'Captions'}
                    default
                  />
                )}
                Your browser does not support HTML video.
              </video>
            )}

            {isCanvas && props.src !== undefined && props.captionsSrc === undefined ? (
              <p className="m-0 border-t border-text/10 px-3 py-3 text-start text-xs font-semibold text-text-muted">
                Add a captions track for video with speech or meaningful sound.
              </p>
            ) : null}

            {props.caption === undefined ? null : (
              <figcaption
                {...part('caption', {
                  className: 'px-3 pt-3 pb-2 text-start text-sm leading-relaxed text-text-muted',
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
