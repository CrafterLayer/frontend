import '../section-layout.css';

import { blockPartProps, type BlockRenderProps } from '@craftkit/builder-schema';

import {
  ALIGN_CLASSES,
  GAP_CLASSES,
  JUSTIFY_CLASSES,
  cx,
  sectionContentClasses,
} from '../section-classes';
import { ICON_PATHS, ICON_SVG_PROPS, type IconName } from '../section-icons';
import { mutedTextClasses, sectionRootAttributes } from '../section-root';

import { appDownloadSchema, type AppDownloadProps } from './schema';

const STORE_ICONS: Readonly<Record<AppDownloadProps['stores'][number]['icon'], IconName>> = {
  phone: 'smartphone',
  play: 'play',
  globe: 'globe',
  monitor: 'monitor',
  download: 'download',
};

/** A mobile app's promotion: benefits, generic store buttons, a rating note and a framed screenshot. */
export function AppDownload({ node, props, isCanvas }: BlockRenderProps<AppDownloadProps>) {
  const headingId = `${node.id}-heading`;
  /* Each inner element is a part: addressable on the canvas, stylable per part. */
  const part = blockPartProps({ node, props, isCanvas }, appDownloadSchema.parts);
  const root = sectionRootAttributes(props);
  const muted = mutedTextClasses(props.tone);
  const split = props.layout === 'split';
  const align = split ? props.align : 'center';
  const hasMedia = props.showDevice || props.imageSrc !== undefined;
  /* The buttons are a dark slab on a light section and a light card on a dark one. */
  const buttonInk =
    props.tone === 'dark' ? 'bg-surface text-text' : 'bg-surface-inverse text-text-inverse';

  return (
    <section
      className={root.className}
      {...root.motion}
      style={root.style}
      aria-labelledby={headingId}
    >
      <div
        className={cx(
          sectionContentClasses(props.width, align, props.gutter),
          'grid items-center',
          GAP_CLASSES.lg,
          split && hasMedia ? '@3xl:grid-cols-2 @5xl:gap-16' : 'grid-cols-1 justify-items-center',
        )}
        data-app-download-content=""
        data-app-download-layout={props.layout}
      >
        <div className={cx('flex min-w-0 flex-col', GAP_CLASSES.md, ALIGN_CLASSES[align])}>
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
                'm-0 max-w-content-narrow text-3xl leading-tight font-bold tracking-tight text-balance @md:text-5xl',
            })}
          >
            {props.heading}
          </h2>
          {props.body === undefined ? null : (
            <p
              {...part('body', {
                className: cx('m-0 max-w-content-narrow text-lg leading-relaxed', muted),
              })}
            >
              {props.body}
            </p>
          )}
          {props.features.length === 0 ? null : (
            <ul
              {...part('features', {
                className: cx(
                  'm-0 flex list-none flex-col gap-gap-sm p-0 text-start',
                  ALIGN_CLASSES[align],
                ),
              })}
            >
              {props.features.map((feature, index) => (
                /* Keyed by position: a bound value may be an inline editor element. */
                <li key={index} className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-accent text-accent-text"
                  >
                    <svg {...ICON_SVG_PROPS} strokeWidth={3} className="size-3.5">
                      {ICON_PATHS.check.map((d) => (
                        <path key={d} d={d} />
                      ))}
                    </svg>
                  </span>
                  <span {...part('feature', { index: [index], className: 'leading-relaxed' })}>
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {props.stores.length === 0 ? null : (
            <ul
              {...part('stores', {
                className: cx(
                  'm-0 mt-gap-xs flex list-none flex-wrap gap-3 p-0',
                  JUSTIFY_CLASSES[align],
                ),
              })}
            >
              {props.stores.map((store, index) => {
                /*
                  A button is a row (glyph, lead-in, store name), not a line of
                  text, so it follows the page direction: a Latin store name on
                  an Arabic page does not flip it. A stored `dir` still wins.
                */
                const button = part('store', {
                  index: [index],
                  className: cx(
                    'inline-flex min-h-14 items-center gap-3 rounded-xl px-4 py-2 text-start shadow-soft ring-1 ring-current/10 transition hover:-translate-y-0.5 hover:shadow-elevated focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent motion-reduce:transform-none',
                    buttonInk,
                  ),
                });
                return (
                  <li key={index}>
                    <a
                      {...button}
                      dir={button.dir === 'auto' ? undefined : button.dir}
                      href={store.href}
                      data-app-download-store={store.icon}
                    >
                      <svg {...ICON_SVG_PROPS} className="size-7 shrink-0">
                        {ICON_PATHS[STORE_ICONS[store.icon]].map((d) => (
                          <path key={d} d={d} />
                        ))}
                      </svg>
                      <span className="flex flex-col leading-tight">
                        {store.kicker === undefined ? null : (
                          <span
                            {...part('store.kicker', {
                              index: [index],
                              className: 'text-xs font-medium opacity-80',
                            })}
                          >
                            {store.kicker}
                          </span>
                        )}
                        {/* A space, so the link's name reads "Get it on Google Play", not "onGoogle". */}{' '}
                        <span className="text-lg font-semibold tracking-tight">{store.label}</span>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
          {props.note === undefined ? null : (
            <p className={cx('m-0 flex items-center gap-2 text-sm', muted)}>
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
                focusable="false"
                className="size-4 shrink-0 text-accent"
              >
                {ICON_PATHS.star.map((d) => (
                  <path key={d} d={d} />
                ))}
              </svg>
              <span {...part('note')}>{props.note}</span>
            </p>
          )}
        </div>

        {hasMedia ? (
          <div
            className={cx(
              'relative isolate flex w-full justify-center',
              split && props.mediaPosition === 'start' ? '@3xl:order-first' : undefined,
            )}
            data-app-download-media=""
          >
            {/* A soft accent glow behind the device: decoration in the theme's own colour. */}
            <span
              aria-hidden="true"
              className="absolute inset-x-8 inset-y-12 -z-10 rounded-full bg-accent/20 blur-3xl"
            />
            {props.showDevice ? (
              <div
                className="relative aspect-9/19 w-full max-w-64 overflow-hidden rounded-4xl border-8 border-surface-inverse bg-surface-inverse shadow-elevated ring-1 ring-current/15 @md:max-w-72"
                data-app-download-device=""
              >
                {props.imageSrc === undefined ? (
                  /* A drawn screen until a screenshot is chosen. */
                  <div
                    aria-hidden="true"
                    className="flex size-full flex-col gap-3 rounded-3xl bg-surface p-4 pt-10"
                    data-app-download-placeholder=""
                  >
                    <span className="h-28 rounded-2xl bg-accent/80" />
                    <span className="h-3 w-3/4 rounded-full bg-text/15" />
                    <span className="h-3 w-1/2 rounded-full bg-text/10" />
                    <span className="mt-2 grid grid-cols-2 gap-3">
                      <span className="h-20 rounded-xl bg-accent/15" />
                      <span className="h-20 rounded-xl bg-text/10" />
                    </span>
                    <span className="h-3 w-2/3 rounded-full bg-text/10" />
                  </div>
                ) : (
                  <img
                    {...part('image', { className: 'size-full rounded-3xl object-cover' })}
                    src={props.imageSrc}
                    alt={props.imageAlt}
                    loading="lazy"
                    decoding="async"
                  />
                )}
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-2 mx-auto h-5 w-20 rounded-full bg-surface-inverse"
                />
              </div>
            ) : (
              <img
                {...part('image', {
                  className: 'w-full max-w-content-narrow rounded-2xl object-cover shadow-elevated',
                })}
                src={props.imageSrc}
                alt={props.imageAlt}
                loading="lazy"
                decoding="async"
              />
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
