import '../section-layout.css';

import { useState, useSyncExternalStore, type CSSProperties } from 'react';

import { blockPartProps, type BlockRenderProps } from '@craftkit/builder-schema';

import { ALIGN_CLASSES, GAP_CLASSES, cx, sectionContentClasses } from '../section-classes';
import { ICON_PATHS, ICON_SVG_PROPS } from '../section-icons';
import { mutedTextClasses, sectionRootAttributes } from '../section-root';
import { committedText } from '../section-text';

import { beforeAfterSchema, type BeforeAfterProps } from './schema';

/*
  Live (a client render: the canvas, Preview, Storybook) React owns the slider.
  Static (the published page, which never hydrates) the frame carries
  `data-ck-behavior="compare"` and the renderer's `compare` pack appends the
  native range — the split Countdown and Carousel make.
*/
function subscribeNever(): () => void {
  return () => undefined;
}
function liveSnapshot(): boolean {
  return true;
}
function staticSnapshot(): boolean {
  return false;
}

const ASPECT_CLASSES: Readonly<Record<BeforeAfterProps['aspect'], string>> = {
  wide: 'aspect-video',
  landscape: 'aspect-4/3 max-w-content-standard',
  square: 'aspect-square max-w-2xl',
  portrait: 'aspect-3/4 max-w-xl',
};

/*
  The divider sits `--ck-compare` from the INLINE start. `clip-path: inset()`
  has no logical form, so the after photo is clipped from the left in LTR and
  from the right in RTL: "before" is always on the inline-start side, exactly
  where the native range (which mirrors under RTL) puts its minimum.
*/
const AFTER_CLIP =
  '[clip-path:inset(0_0_0_var(--ck-compare))] rtl:[clip-path:inset(0_var(--ck-compare)_0_0)]';
const LAYER = 'col-start-1 row-start-1 size-full';
const BADGE =
  'absolute top-3 z-1 rounded-full bg-surface/90 px-3 py-1 text-xs font-semibold tracking-wide text-text uppercase shadow-soft';

/** Two photos of one subject and a slider between them: a renovation, a treatment, a retouch. */
export function BeforeAfter({ node, props, isCanvas }: BlockRenderProps<BeforeAfterProps>) {
  const headingId = `${node.id}-heading`;
  /* Each inner element is a part: addressable on the canvas, stylable per part. */
  const part = blockPartProps({ node, props, isCanvas }, beforeAfterSchema.parts);
  const root = sectionRootAttributes(props);
  const muted = mutedTextClasses(props.tone);
  const isLive = useSyncExternalStore(subscribeNever, liveSnapshot, staticSnapshot);
  /* The person's own position, until the Inspector moves the start. */
  const [moved, setMoved] = useState<{ readonly from: number; readonly value: number }>();
  const position = moved?.from === props.start ? moved.value : props.start;
  const bothPhotos = props.beforeSrc !== undefined && props.afterSrc !== undefined;
  const behavior =
    isLive || !bothPhotos
      ? {}
      : {
          'data-ck-behavior': 'compare',
          'data-ck-compare-label': props.sliderLabel,
          'data-ck-compare-start': String(props.start),
        };
  /* A photo without alt text is named by its corner label (committed text only, never an editor). */
  const beforeAlt = props.beforeAlt !== '' ? props.beforeAlt : committedText(props.beforeLabel);
  const afterAlt = props.afterAlt !== '' ? props.afterAlt : committedText(props.afterLabel);

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
        data-before-after-content=""
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

        <figure className={cx('m-0 flex w-full flex-col gap-gap-sm', ALIGN_CLASSES[props.align])}>
          <div
            className={cx(
              'relative isolate grid w-full overflow-hidden rounded-2xl bg-current/5 shadow-soft',
              ASPECT_CLASSES[props.aspect],
              isCanvas ? undefined : 'select-none',
            )}
            style={{ '--ck-compare': `${String(position)}%` } as CSSProperties}
            data-before-after-frame=""
            {...behavior}
          >
            {props.beforeSrc === undefined ? (
              <div
                aria-hidden="true"
                className={cx(LAYER, 'grid place-items-center bg-current/10 text-current/40')}
                data-before-after-placeholder="before"
              >
                <svg {...ICON_SVG_PROPS} className="size-10">
                  {ICON_PATHS.image.map((d) => (
                    <path key={d} d={d} />
                  ))}
                </svg>
              </div>
            ) : (
              <img
                {...part('beforeImage', { className: cx(LAYER, 'object-cover') })}
                src={props.beforeSrc}
                alt={beforeAlt}
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            )}
            {props.afterSrc === undefined ? (
              <div
                aria-hidden="true"
                className={cx(
                  LAYER,
                  AFTER_CLIP,
                  'grid place-items-center bg-accent/20 text-accent',
                )}
                data-before-after-placeholder="after"
              >
                <svg {...ICON_SVG_PROPS} className="size-10">
                  {ICON_PATHS.image.map((d) => (
                    <path key={d} d={d} />
                  ))}
                </svg>
              </div>
            ) : (
              <img
                {...part('afterImage', { className: cx(LAYER, AFTER_CLIP, 'object-cover') })}
                src={props.afterSrc}
                alt={afterAlt}
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            )}

            {isLive ? (
              /*
                The native range IS the control: arrow keys, Home/End and Page
                keys, its value read as a percentage. It is invisible and spans
                the photo, so a drag anywhere moves the divider. On the editing
                canvas it is inert, so a click selects instead.
              */
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={position}
                onChange={(event) => {
                  setMoved({ from: props.start, value: Number(event.currentTarget.value) });
                }}
                aria-label={props.sliderLabel}
                aria-valuetext={`${String(position)}%`}
                tabIndex={isCanvas ? -1 : undefined}
                className={cx(
                  'peer absolute inset-0 z-2 m-0 size-full cursor-ew-resize appearance-none opacity-0',
                  isCanvas ? 'pointer-events-none' : undefined,
                )}
                data-before-after-range=""
              />
            ) : null}
            {/* The compare pack draws its own line once it mounts; one line, never two. */}
            {isLive || !bothPhotos ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 start-(--ck-compare) z-1 -ms-px w-0.5 bg-surface shadow-soft"
                data-before-after-divider=""
              />
            ) : null}
            {isLive ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 start-(--ck-compare) z-1 grid size-10 -translate-y-1/2 -ms-5 place-items-center rounded-full border-2 border-surface bg-accent text-accent-text shadow-elevated transition-transform peer-hover:scale-105 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent motion-reduce:transition-none"
                data-before-after-handle=""
              >
                <svg {...ICON_SVG_PROPS} className="size-5">
                  {ICON_PATHS.chevronsInline.map((d) => (
                    <path key={d} d={d} />
                  ))}
                </svg>
              </span>
            ) : null}
            {props.showLabels ? (
              <>
                <span {...part('beforeLabel', { className: cx(BADGE, 'start-3') })}>
                  {props.beforeLabel}
                </span>
                <span {...part('afterLabel', { className: cx(BADGE, 'end-3') })}>
                  {props.afterLabel}
                </span>
              </>
            ) : null}
          </div>
          {props.caption === undefined ? null : (
            <figcaption
              {...part('caption', { className: cx('m-0 text-sm leading-relaxed', muted) })}
            >
              {props.caption}
            </figcaption>
          )}
        </figure>
      </div>
    </section>
  );
}
