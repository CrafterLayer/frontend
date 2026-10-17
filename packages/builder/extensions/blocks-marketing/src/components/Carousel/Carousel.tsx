import '../section-layout.css';

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';

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

import { carouselSchema, type CarouselProps } from './schema';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const AUTOPLAY_DELAYS: Readonly<Record<CarouselProps['autoplayInterval'], number>> = {
  slow: 8000,
  normal: 5000,
  fast: 3000,
};

const SLIDE_CLASSES: Readonly<Record<CarouselProps['variant'], string>> = {
  card: 'flex flex-col bg-surface text-text',
  split: 'grid grid-cols-1 bg-surface text-text @lg:grid-cols-2',
  media: 'grid grid-cols-1 bg-surface text-text',
};

const MEDIA_POSITION_CLASSES: Readonly<Record<CarouselProps['mediaPosition'], string>> = {
  start: 'order-first',
  end: 'order-last',
};

const OVERLAY_POSITION_CLASSES: Readonly<Record<CarouselProps['mediaPosition'], string>> = {
  start: 'justify-self-start',
  end: 'justify-self-end',
};

const ASPECT_CLASSES: Readonly<Record<CarouselProps['mediaAspect'], string>> = {
  wide: 'aspect-video',
  square: 'aspect-square',
  portrait: 'aspect-3/4',
};

function subscribeReducedMotion(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => undefined;
  }
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}

function reducedMotionSnapshot(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function serverReducedMotionSnapshot(): boolean {
  return false;
}

function preventCanvasNavigation(event: MouseEvent<HTMLAnchorElement>): void {
  event.preventDefault();
}

// media-motion (2026-10-06): whether React is running this render. A client
// render reads `true`; `renderToStaticMarkup` — the static export, which never
// hydrates — reads the server snapshot, `false`. The static render hands the
// carousel to the `carousel` behaviour pack instead of React state.
function subscribeNever(): () => void {
  return () => undefined;
}

function liveSnapshot(): boolean {
  return true;
}

function staticSnapshot(): boolean {
  return false;
}

/** An accessible, keyboard-operable carousel with opt-in and user-controllable autoplay. */
export function Carousel({ node, props, isCanvas }: BlockRenderProps<CarouselProps>) {
  const headingId = `${node.id}-heading`;
  const slideId = `${node.id}-slide`;
  /* Each inner element is a part: addressable on the canvas, stylable per part. */
  const part = blockPartProps({ node, props, isCanvas }, carouselSchema.parts);
  /* Each slide's title id: the slide and its indicator read their names through it. */
  const titleIdOf = (index: number) => `${node.id}-slide-${String(index)}-title`;
  const isLive = useSyncExternalStore(subscribeNever, liveSnapshot, staticSnapshot);
  const [requestedIndex, setRequestedIndex] = useState(0);
  const [pausedByUser, setPausedByUser] = useState(false);
  const [isPointerInside, setIsPointerInside] = useState(false);
  const [isFocusInside, setIsFocusInside] = useState(false);
  const [reducedMotionOverride, setReducedMotionOverride] = useState(false);
  const prefersReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    reducedMotionSnapshot,
    serverReducedMotionSnapshot,
  );
  const itemCount = props.items.length;
  const maximumIndex = Math.max(0, itemCount - 1);
  const activeIndex = Math.min(requestedIndex, maximumIndex);
  const activeItem = props.items[activeIndex];
  const isTerminalSlide = !props.loop && activeIndex === maximumIndex;
  const playbackEnabled =
    props.autoplay && !pausedByUser && (!prefersReducedMotion || reducedMotionOverride);
  const shouldPauseForInteraction = isFocusInside || (props.pauseOnInteraction && isPointerInside);
  const shouldAdvance =
    playbackEnabled && itemCount > 1 && !isTerminalSlide && !shouldPauseForInteraction;
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);
  const colorStyle = sectionColorStyle(props);
  const spacingStyle = sectionSpacingStyle(props);
  const rootStyle =
    colorStyle === undefined && spacingStyle === undefined
      ? undefined
      : { ...colorStyle, ...spacingStyle };

  useEffect(() => {
    if (!shouldAdvance) return undefined;
    const timer = window.setInterval(() => {
      setRequestedIndex((current) => {
        const safeCurrent = Math.min(current, maximumIndex);
        if (safeCurrent === maximumIndex) return props.loop ? 0 : safeCurrent;
        return safeCurrent + 1;
      });
    }, AUTOPLAY_DELAYS[props.autoplayInterval]);
    return () => {
      window.clearInterval(timer);
    };
  }, [maximumIndex, props.autoplayInterval, props.loop, shouldAdvance]);

  const selectSlide = (index: number, manual = true) => {
    if (itemCount === 0) return;
    setRequestedIndex(Math.min(Math.max(index, 0), maximumIndex));
    if (manual && props.autoplay) setPausedByUser(true);
  };

  const moveSlide = (delta: -1 | 1, manual = true) => {
    if (itemCount < 2) return;
    setRequestedIndex((current) => {
      const safeCurrent = Math.min(current, maximumIndex);
      const next = safeCurrent + delta;
      if (props.loop) return (next + itemCount) % itemCount;
      return Math.min(Math.max(next, 0), maximumIndex);
    });
    if (manual && props.autoplay) setPausedByUser(true);
  };

  const togglePlayback = () => {
    if (playbackEnabled) {
      setPausedByUser(true);
      return;
    }
    if (isTerminalSlide) setRequestedIndex(0);
    if (prefersReducedMotion) setReducedMotionOverride(true);
    setPausedByUser(false);
  };

  const handleKeyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget || itemCount < 2) return;
    const isRtl = window.getComputedStyle(event.currentTarget).direction === 'rtl';
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      moveSlide(isRtl ? -1 : 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      moveSlide(isRtl ? 1 : -1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      selectSlide(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      selectSlide(maximumIndex);
    }
  };

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsFocusInside(false);
    }
  };

  /*
    The published page never hydrates, so its markup must work without React:
    every slide sits in one scroll-snap track, the prev/next buttons sit
    outside it, and the `carousel` behaviour pack (renderer
    behaviors/packs/carousel.ts) derives them, builds the dots and drives
    autoplay. A live render keeps its React state and shows the active slide;
    the other slides stay in the DOM, hidden.
  */
  const staticBehavior: Record<string, string> = isLive
    ? {}
    : {
        'data-ck-behavior': 'carousel',
        'data-ck-indicator': props.showIndicators ? 'dots' : 'none',
        ...(props.autoplay
          ? { 'data-ck-autoplay': 'true', 'data-ck-speed': props.autoplayInterval }
          : {}),
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
      style={rootStyle}
      aria-labelledby={headingId}
      aria-roledescription="carousel"
      aria-keyshortcuts={isLive && itemCount > 1 ? 'ArrowLeft ArrowRight Home End' : undefined}
      tabIndex={isLive && itemCount > 1 ? 0 : undefined}
      onKeyDown={handleKeyboard}
      onMouseEnter={() => {
        setIsPointerInside(true);
      }}
      onMouseLeave={() => {
        setIsPointerInside(false);
      }}
      onFocusCapture={() => {
        setIsFocusInside(true);
      }}
      onBlurCapture={handleBlur}
      {...motionData}
    >
      <div
        className={cx(
          sectionContentClasses(props.width, props.align, props.gutter),
          'flex flex-col',
          ALIGN_CLASSES[props.align],
          GAP_CLASSES.lg,
        )}
        data-carousel-content=""
      >
        <header className={cx('flex max-w-content-standard flex-col', GAP_CLASSES.sm)}>
          {props.eyebrow === undefined ? null : (
            <p
              {...part('eyebrow', {
                className: cx(
                  'm-0 text-sm font-semibold tracking-wide uppercase',
                  props.tone === 'dark' ? 'text-inherit opacity-70' : 'text-accent',
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
          {props.body === undefined ? null : (
            <p
              {...part('body', {
                className: cx(
                  'm-0 max-w-content-narrow text-lg leading-relaxed text-pretty',
                  props.tone === 'dark' ? 'text-inherit opacity-80' : 'text-text-muted',
                ),
              })}
            >
              {props.body}
            </p>
          )}
        </header>

        {activeItem === undefined ? (
          isCanvas ? (
            <p className="m-0 w-full rounded-xl border border-dashed border-text-muted/30 bg-text-muted/10 p-8 text-center text-text-muted">
              Add carousel slides in the inspector.
            </p>
          ) : null
        ) : (
          <div
            className={cx('flex w-full min-w-0 flex-col', GAP_CLASSES.md)}
            data-carousel-viewport=""
            {...staticBehavior}
          >
            <div
              {...part('items', {
                id: slideId,
                className: cx(
                  'flex w-full min-w-0 snap-x snap-mandatory overflow-x-auto',
                  GAP_CLASSES.md,
                ),
              })}
              data-carousel-track=""
            >
              {props.items.map((item, index) => {
                const hasMediaOverlay = props.variant === 'media' && item.imageSrc !== undefined;
                const isHidden = isLive && index !== activeIndex;
                const at = [index];
                const slideItemId = `${node.id}-slide-${String(index)}`;
                return (
                  /*
                    Keyed by position: a bound value may be an inline editor
                    element. The slide is named "1 / 3:" followed by its title,
                    read through aria-labelledby rather than a copy of the text.
                  */
                  <article
                    key={index}
                    {...part('item', {
                      index: at,
                      id: slideItemId,
                      className: cx(
                        'relative w-full min-w-0 shrink-0 snap-start overflow-hidden rounded-xl border border-text/10 shadow-elevated',
                        SLIDE_CLASSES[props.variant],
                        props.variant === 'split' && item.imageSrc === undefined
                          ? '@lg:grid-cols-1'
                          : undefined,
                      ),
                    })}
                    role="group"
                    aria-roledescription="slide"
                    aria-label={`${String(index + 1)} / ${String(itemCount)}:`}
                    aria-labelledby={`${slideItemId} ${titleIdOf(index)}`}
                    hidden={isHidden}
                    style={isHidden ? { display: 'none' } : undefined}
                    data-carousel-slide=""
                  >
                    {item.imageSrc === undefined ? null : (
                      <figure
                        className={cx(
                          /*
                            `w-full` so the TRACK decides the width and the aspect ratio
                            decides the height — the same trap `PromoBanner` had, found
                            by the same Chromium gate. `min-h-96` (384px) run through an
                            aspect ratio the other way forces a 683px figure, which on a
                            360px phone is nearly twice the screen.
                          */
                          'm-0 w-full min-w-0 overflow-hidden bg-text-muted/10',
                          hasMediaOverlay
                            ? 'col-start-1 row-start-1 min-h-64 @md:min-h-96'
                            : undefined,
                          ASPECT_CLASSES[props.mediaAspect],
                          !hasMediaOverlay
                            ? MEDIA_POSITION_CLASSES[props.mediaPosition]
                            : undefined,
                        )}
                        data-carousel-media=""
                      >
                        <img
                          {...part('item.image', {
                            index: at,
                            className: cx(
                              'block h-full min-h-64 w-full object-cover',
                              hasMediaOverlay ? 'min-h-96' : undefined,
                            ),
                          })}
                          src={item.imageSrc}
                          alt={item.imageAlt}
                          loading="lazy"
                          decoding="async"
                        />
                      </figure>
                    )}

                    <div
                      className={cx(
                        'relative z-10 flex min-w-0 flex-col p-6 text-start @md:p-8 @lg:p-10',
                        GAP_CLASSES.md,
                        hasMediaOverlay
                          ? 'col-start-1 row-start-1 m-4 max-w-content-narrow self-end rounded-lg bg-surface-inverse/90 text-text-inverse shadow-strong @md:m-8'
                          : undefined,
                        hasMediaOverlay ? OVERLAY_POSITION_CLASSES[props.mediaPosition] : undefined,
                      )}
                      data-carousel-copy=""
                    >
                      {item.label === undefined ? null : (
                        <span
                          {...part('item.label', {
                            index: at,
                            className:
                              'self-start rounded-full border border-current/20 bg-current/10 px-3 py-1 text-xs font-semibold tracking-wide uppercase',
                          })}
                        >
                          {item.label}
                        </span>
                      )}
                      <h3
                        {...part('item.title', {
                          index: at,
                          id: titleIdOf(index),
                          className:
                            'm-0 text-2xl leading-tight font-bold tracking-tight text-balance @md:text-3xl',
                        })}
                      >
                        {item.title}
                      </h3>
                      {item.body === undefined ? null : (
                        <p
                          {...part('item.body', {
                            index: at,
                            className: cx(
                              'm-0 max-w-content-narrow text-lg leading-relaxed text-pretty',
                              hasMediaOverlay ? 'text-inherit opacity-85' : 'text-text-muted',
                            ),
                          })}
                        >
                          {item.body}
                        </p>
                      )}
                      {item.action === undefined ? null : (
                        <a
                          {...part('item.action', {
                            index: at,
                            className:
                              'inline-flex min-h-11 items-center justify-center self-start rounded-lg bg-accent px-control-inline-md py-control-block-md font-semibold text-accent-text shadow-strong focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent',
                          })}
                          href={item.action.href}
                          onClick={isCanvas ? preventCanvasNavigation : undefined}
                        >
                          {item.action.label}
                        </a>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            {!isLive && props.showControls && itemCount > 1 ? (
              <div
                className="flex items-center justify-center gap-gap-sm"
                data-carousel-static-controls=""
              >
                <button
                  className="inline-grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-full border border-text-muted/30 bg-surface text-xl text-text shadow-soft"
                  type="button"
                  aria-label={props.previousLabel}
                  aria-controls={slideId}
                >
                  <span aria-hidden="true" className="rtl:rotate-180">
                    ‹
                  </span>
                </button>
                <button
                  className="inline-grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-full border border-text-muted/30 bg-surface text-xl text-text shadow-soft"
                  type="button"
                  aria-label={props.nextLabel}
                  aria-controls={slideId}
                >
                  <span aria-hidden="true" className="rtl:rotate-180">
                    ›
                  </span>
                </button>
              </div>
            ) : null}
          </div>
        )}

        {isLive && itemCount > 1 ? (
          <div
            className="flex w-full flex-col items-center justify-between gap-gap @sm:flex-row"
            aria-label={props.controlsLabel}
            role="group"
            data-carousel-controls=""
          >
            {props.showControls || props.autoplay ? (
              <div className="flex items-center gap-gap-sm">
                {props.showControls ? (
                  <>
                    <button
                      className="inline-grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-full border border-text-muted/30 bg-surface text-xl text-text shadow-soft disabled:cursor-not-allowed disabled:opacity-40"
                      type="button"
                      aria-label={props.previousLabel}
                      aria-controls={slideId}
                      disabled={!props.loop && activeIndex === 0}
                      onClick={() => {
                        moveSlide(-1);
                      }}
                    >
                      <span aria-hidden="true" className="rtl:rotate-180">
                        ‹
                      </span>
                    </button>
                    <button
                      className="inline-grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-full border border-text-muted/30 bg-surface text-xl text-text shadow-soft disabled:cursor-not-allowed disabled:opacity-40"
                      type="button"
                      aria-label={props.nextLabel}
                      aria-controls={slideId}
                      disabled={!props.loop && activeIndex === maximumIndex}
                      onClick={() => {
                        moveSlide(1);
                      }}
                    >
                      <span aria-hidden="true" className="rtl:rotate-180">
                        ›
                      </span>
                    </button>
                  </>
                ) : null}
                {props.autoplay ? (
                  <button
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-text-muted/30 bg-surface px-control-inline-sm text-sm font-semibold text-text shadow-soft"
                    type="button"
                    aria-pressed={playbackEnabled}
                    onClick={togglePlayback}
                  >
                    {/*
                      Both labels stay rendered, one hidden, so each is a part
                      the canvas can reach whichever state the button is in.
                    */}
                    <span {...part('pauseLabel')} hidden={!playbackEnabled}>
                      {props.pauseLabel}
                    </span>
                    <span {...part('playLabel')} hidden={playbackEnabled}>
                      {props.playLabel}
                    </span>
                  </button>
                ) : null}
              </div>
            ) : null}

            {props.showIndicators ? (
              <div className="flex flex-wrap items-center justify-center gap-gap-sm">
                {props.items.map((_item, index) => (
                  /* Named "Go to slide 1:" then the slide title, through aria-labelledby. */
                  <button
                    key={index}
                    id={`${node.id}-dot-${String(index)}`}
                    className="inline-grid size-6 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    type="button"
                    aria-label={`${props.goToLabel} ${String(index + 1)}:`}
                    aria-labelledby={`${node.id}-dot-${String(index)} ${titleIdOf(index)}`}
                    aria-current={index === activeIndex ? 'true' : undefined}
                    aria-controls={slideId}
                    onClick={() => {
                      selectSlide(index);
                    }}
                  >
                    <span
                      className={cx(
                        'h-2 rounded-full',
                        index === activeIndex ? 'w-4 bg-accent' : 'w-2 bg-text-muted/30',
                      )}
                      data-carousel-indicator-dot=""
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
            ) : null}

            <span className="text-sm font-semibold tabular-nums" dir="ltr" aria-hidden="true">
              {String(activeIndex + 1).padStart(2, '0')} / {String(itemCount).padStart(2, '0')}
            </span>
          </div>
        ) : null}

        {/*
          The live status repeats the active title for screen readers. The
          canvas is an editing surface, where a second copy of the title would
          be a second home for its inline editor, so only a page shows it.
        */}
        {!isLive || isCanvas || activeItem === undefined ? null : (
          <p
            className="sr-only"
            role="status"
            aria-live={shouldAdvance ? 'off' : 'polite'}
            aria-atomic="true"
          >
            {activeItem.title}. {String(activeIndex + 1)} / {String(itemCount)}.
          </p>
        )}
      </div>
    </section>
  );
}
