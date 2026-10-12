import '../section-layout.css';

import type { ReactNode } from 'react';

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

import { mailHref, mapEmbedSrc, mapsHref, telHref, whatsappHref } from './location-links';
import { locationSchema, type LocationProps } from './schema';

/*
  Links are built from committed text only: while a number is edited in place
  its value is the editor element, and an href must never read "[object Object]".
*/
function committed(value: ReactNode): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

const LINK_CLASSES =
  'inline-flex min-h-11 items-center gap-gap-sm rounded-xl border px-control-inline-sm py-control-block-sm font-semibold transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent motion-reduce:transform-none';
const SECONDARY_LINK = 'border-current/20 bg-transparent text-inherit hover:border-accent';
const PRIMARY_LINK = 'border-accent bg-accent text-accent-text';
const LABEL_CLASSES = 'm-0 text-sm font-semibold tracking-wide uppercase';

/** Where to find a business: address and maps link, opening hours, and contact links. */
export function Location({ node, props, isCanvas }: BlockRenderProps<LocationProps>) {
  const headingId = `${node.id}-heading`;
  /* Each inner element is a part: addressable on the canvas, stylable per part. */
  const part = blockPartProps({ node, props, isCanvas }, locationSchema.parts);
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);
  const colorStyle = sectionColorStyle(props);
  const spacingStyle = sectionSpacingStyle(props);
  const style =
    colorStyle === undefined && spacingStyle === undefined
      ? undefined
      : { ...colorStyle, ...spacingStyle };
  const muted = props.tone === 'dark' ? 'text-inherit opacity-80' : 'text-text-muted';

  const address = committed(props.address) ?? '';
  const phoneHref = telHref(committed(props.phone));
  const emailHref = mailHref(committed(props.email));
  const chatHref = whatsappHref(committed(props.whatsapp), props.whatsappMessage);
  const embed = props.embedMap ? mapEmbedSrc(props.latitude, props.longitude) : undefined;
  const hasContact = phoneHref !== undefined || emailHref !== undefined || chatHref !== undefined;
  const aside = hasContact || embed !== undefined;

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
        data-location-content=""
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

        <div
          className={cx(
            'grid w-full grid-cols-1 gap-gap-lg text-start',
            aside && props.layout === 'split' ? '@3xl:grid-cols-2' : undefined,
          )}
          data-location-layout={props.layout}
        >
          <div className="flex min-w-0 flex-col gap-gap-lg">
            <div className="flex flex-col items-start gap-gap-sm" data-location-address="">
              <h3 {...part('addressLabel', { className: cx(LABEL_CLASSES, muted) })}>
                {props.addressLabel}
              </h3>
              <address
                {...part('address', {
                  className: 'm-0 text-lg leading-relaxed whitespace-pre-line not-italic',
                })}
              >
                {props.address}
              </address>
              <a
                className={cx(LINK_CLASSES, SECONDARY_LINK, 'mt-gap-xs')}
                href={mapsHref(address, props.latitude, props.longitude)}
                data-location-maps=""
              >
                <span {...part('mapsLabel')}>{props.mapsLabel}</span>
              </a>
            </div>

            <div className="flex flex-col gap-gap-sm" data-location-hours="">
              <h3 {...part('hoursLabel', { className: cx(LABEL_CLASSES, muted) })}>
                {props.hoursLabel}
              </h3>
              <dl {...part('hours', { className: 'm-0 flex flex-col' })}>
                {props.hours.map((row, index) => (
                  /* Keyed by position: a bound value may be an inline editor element. */
                  <div
                    key={index}
                    {...part('hour', {
                      index: [index],
                      className:
                        'flex items-baseline justify-between gap-gap border-b border-current/10 py-2 last:border-b-0',
                    })}
                  >
                    <dt
                      {...part('hour.days', { index: [index], className: 'min-w-0 font-medium' })}
                    >
                      {row.days}
                    </dt>
                    <dd
                      {...part('hour.time', {
                        index: [index],
                        className: 'm-0 shrink-0 text-end whitespace-nowrap tabular-nums',
                      })}
                    >
                      {row.time}
                    </dd>
                  </div>
                ))}
              </dl>
              {props.hoursNote === undefined ? null : (
                <p {...part('hoursNote', { className: cx('m-0 text-sm leading-relaxed', muted) })}>
                  {props.hoursNote}
                </p>
              )}
            </div>
          </div>

          {aside ? (
            <div className="flex min-w-0 flex-col gap-gap-lg">
              {hasContact ? (
                <div className="flex flex-col items-start gap-gap-sm" data-location-contact="">
                  <h3 {...part('contactLabel', { className: cx(LABEL_CLASSES, muted) })}>
                    {props.contactLabel}
                  </h3>
                  <ul className="m-0 flex list-none flex-wrap gap-gap-sm p-0">
                    {chatHref === undefined ? null : (
                      <li>
                        <a
                          className={cx(LINK_CLASSES, PRIMARY_LINK)}
                          href={chatHref}
                          data-location-link="whatsapp"
                        >
                          <span {...part('whatsappLabel')}>{props.whatsappLabel}</span>{' '}
                          {/* A number reads left to right on any page, so it overrides the part's automatic direction. */}
                          <bdi {...part('whatsapp', { className: 'font-regular' })} dir="ltr">
                            {props.whatsapp}
                          </bdi>
                        </a>
                      </li>
                    )}
                    {phoneHref === undefined ? null : (
                      <li>
                        <a
                          className={cx(LINK_CLASSES, SECONDARY_LINK)}
                          href={phoneHref}
                          data-location-link="phone"
                        >
                          <span {...part('phoneLabel')}>{props.phoneLabel}</span>{' '}
                          <bdi {...part('phone', { className: 'font-regular' })} dir="ltr">
                            {props.phone}
                          </bdi>
                        </a>
                      </li>
                    )}
                    {emailHref === undefined ? null : (
                      <li>
                        <a
                          className={cx(LINK_CLASSES, SECONDARY_LINK)}
                          href={emailHref}
                          data-location-link="email"
                        >
                          <span {...part('emailLabel')}>{props.emailLabel}</span>{' '}
                          <bdi
                            {...part('email', { className: 'font-regular break-all' })}
                            dir="ltr"
                          >
                            {props.email}
                          </bdi>
                        </a>
                      </li>
                    )}
                  </ul>
                </div>
              ) : null}
              {embed === undefined ? null : (
                /*
                  Off by default: an embed loads a third party's page. It is
                  lazy, sends no referrer, and on the canvas it lets a click
                  through so the section can be selected.
                */
                <iframe
                  className={cx(
                    'aspect-video w-full rounded-xl border border-current/10 bg-surface',
                    isCanvas ? 'pointer-events-none' : undefined,
                  )}
                  src={embed}
                  title={props.mapTitle}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  sandbox="allow-scripts allow-same-origin allow-popups"
                  data-location-map=""
                />
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
