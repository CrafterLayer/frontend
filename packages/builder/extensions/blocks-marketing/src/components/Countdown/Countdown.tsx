import '../section-layout.css';

import { useSyncExternalStore, type ReactNode } from 'react';

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

import { formatUnit, formatWall, parseTarget, remainingUntil, summaryOf } from './countdown-time';
import { countdownSchema, type CountdownProps } from './schema';

const UNITS = ['days', 'hours', 'minutes', 'seconds'] as const;
type Unit = (typeof UNITS)[number];
const LABEL_KEYS = {
  days: 'daysLabel',
  hours: 'hoursLabel',
  minutes: 'minutesLabel',
  seconds: 'secondsLabel',
} as const satisfies Record<Unit, keyof CountdownProps>;

/*
  Live (a client render: the canvas, Preview, Storybook) the counter ticks
  through React. Static (the published page, which never hydrates) it renders
  the date as text plus a hidden clock that the `countdown-clock` behaviour
  pack (renderer behaviors/packs/countdown.ts) fills and reveals — the same
  split the Carousel makes.
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

/*
  A clock the render reads through useSyncExternalStore. It holds the time of
  its last tick, so the snapshot is stable between ticks and React never loops;
  subscribing refreshes it, so a clock nobody watched for a while is never stale.
*/
function clockOf(step: number) {
  let current: number | undefined;
  return {
    subscribe: (onTick: () => void): (() => void) => {
      current = Date.now();
      const id = window.setInterval(() => {
        current = Date.now();
        onTick();
      }, step);
      return () => {
        window.clearInterval(id);
      };
    },
    snapshot: (): number => {
      current ??= Date.now();
      return current;
    },
  };
}
const EVERY_SECOND = clockOf(1000);
/* Reduced motion, and the editing canvas: nothing ticks; the minutes move once a minute. */
const EVERY_MINUTE = clockOf(60_000);
function serverNow(): number {
  return 0;
}

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
function subscribeReduced(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => undefined;
  const query = window.matchMedia(REDUCED_QUERY);
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}
function reducedSnapshot(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_QUERY).matches;
}

/*
  The summary reads committed text only: while a unit label is edited in place
  its value is the editor element, which renders once, where the person types.
*/
function committed(value: ReactNode): string {
  return typeof value === 'string' ? value : '';
}

const UNIT_CLASSES: Readonly<Record<CountdownProps['variant'], string>> = {
  cards:
    'flex min-w-20 flex-col items-center gap-gap-xs rounded-xl border border-current/10 bg-surface px-3 py-5 text-text shadow-soft @md:min-w-32 @md:px-5',
  minimal: 'flex min-w-16 flex-col items-center gap-gap-xs px-2 @md:min-w-24',
};

/** A launch or event countdown: the date as text everywhere, a live d/h/m/s counter where scripts run. */
export function Countdown({ node, props, isCanvas }: BlockRenderProps<CountdownProps>) {
  const headingId = `${node.id}-heading`;
  /* Each inner element is a part: addressable on the canvas, stylable per part. */
  const part = blockPartProps({ node, props, isCanvas }, countdownSchema.parts);
  const isLive = useSyncExternalStore(subscribeNever, liveSnapshot, staticSnapshot);
  const reduced = useSyncExternalStore(subscribeReduced, reducedSnapshot, staticSnapshot);
  const clock = isCanvas || reduced ? EVERY_MINUTE : EVERY_SECOND;
  const now = useSyncExternalStore(clock.subscribe, clock.snapshot, serverNow);
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);
  const colorStyle = sectionColorStyle(props);
  const spacingStyle = sectionSpacingStyle(props);
  const style =
    colorStyle === undefined && spacingStyle === undefined
      ? undefined
      : { ...colorStyle, ...spacingStyle };
  const muted = props.tone === 'dark' ? 'text-inherit opacity-80' : 'text-text-muted';
  const language = props.dateLanguage;

  /* An impossible target (the door refuses one, a stale document may still hold one) draws no date and no clock. */
  const target = parseTarget(props.target);
  const left = isLive && target !== undefined ? remainingUntil(target.instant, now) : undefined;
  const ended = left?.ended === true;
  const showClock = left !== undefined && !ended;
  const units = UNITS.filter(
    (unit) => unit !== 'seconds' || (props.showSeconds && !(isLive && reduced)),
  );
  /*
    The polite summary repeats the unit labels, so on the canvas it stays
    empty: there it would be a second, unbound copy of a label the person
    edits in place. Preview and the published page announce it.
  */
  const summary =
    left === undefined || isCanvas
      ? ''
      : summaryOf(
          left,
          {
            remaining: props.remainingLabel,
            days: committed(props.daysLabel),
            hours: committed(props.hoursLabel),
            minutes: committed(props.minutesLabel),
          },
          language,
        );
  const behavior =
    isLive || target === undefined
      ? {}
      : {
          'data-ck-behavior': 'countdown-clock',
          'data-ck-target': props.target,
          'data-ck-lang': language,
          'data-ck-remaining': props.remainingLabel,
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
      {...motionData}
      {...behavior}
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
        data-countdown-content=""
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
                'm-0 text-3xl leading-tight font-bold tracking-tight text-balance @md:text-5xl',
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

        {/* The digits are for the eye; a screen reader gets the coarse summary below instead. */}
        <div
          className={cx('flex w-full flex-wrap gap-gap', JUSTIFY_CLASSES[props.align])}
          aria-hidden="true"
          hidden={!showClock}
          data-ck-countdown-clock=""
        >
          {units.map((unit) => (
            <div key={unit} className={UNIT_CLASSES[props.variant]} data-ck-countdown-unit={unit}>
              <span
                className={cx(
                  'text-4xl leading-none font-bold tracking-tight tabular-nums @md:text-6xl',
                  /* A card's digits carry the card's ink themselves: a dark section's slab rules recolour the card, not its children. */
                  props.variant === 'cards' ? 'text-text' : undefined,
                )}
                data-ck-countdown-value={unit}
              >
                {formatUnit(left?.[unit] ?? 0, language, unit !== 'days')}
              </span>
              <span
                {...part(LABEL_KEYS[unit], {
                  className: cx(
                    'text-xs font-semibold tracking-wide uppercase',
                    props.variant === 'cards' ? 'text-text-muted' : muted,
                  ),
                })}
                data-ck-countdown-label={unit}
              >
                {props[LABEL_KEYS[unit]]}
              </span>
            </div>
          ))}
        </div>

        {target === undefined ? null : (
          <p
            className={cx('m-0 text-base leading-relaxed', muted)}
            hidden={ended}
            data-ck-countdown-when=""
          >
            <span {...part('startsLabel')}>{props.startsLabel}</span>{' '}
            <time className="font-semibold text-inherit" dateTime={props.target}>
              {formatWall(target.wall, language)}
            </time>
            {props.timezoneLabel === undefined ? null : (
              <>
                {' · '}
                <span {...part('timezoneLabel')}>{props.timezoneLabel}</span>
              </>
            )}
          </p>
        )}
        <p className="sr-only" aria-live="polite" aria-atomic="true" data-ck-countdown-summary="">
          {summary}
        </p>
        <p
          className="m-0 text-2xl leading-tight font-bold text-balance"
          role="status"
          data-ck-countdown-ended=""
        >
          <span {...part('endedMessage')} hidden={!ended}>
            {props.endedMessage}
          </span>
        </p>

        {props.actionLabel === undefined || props.actionHref === undefined ? null : (
          <a
            {...part('action', {
              className:
                'inline-flex min-h-11 items-center justify-center rounded-xl border border-accent bg-accent px-control-inline-md py-control-block-sm font-semibold text-accent-text shadow-soft transition hover:-translate-y-0.5 hover:shadow-elevated focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent motion-reduce:transform-none',
            })}
            href={props.actionHref}
          >
            {props.actionLabel}
          </a>
        )}
      </div>
    </section>
  );
}
