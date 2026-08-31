import '../section-layout.css';

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

import type { NewsletterProps } from './schema';

const PANEL_CLASSES: Record<NewsletterProps['variant'], string> = {
  inline: 'flex flex-col',
  card:
    'flex flex-col rounded-xl border border-text-muted/20 bg-surface p-6 text-text shadow-elevated @lg:p-10',
  split:
    'grid grid-cols-1 overflow-hidden rounded-xl border border-text-muted/20 bg-surface text-text shadow-elevated @lg:grid-cols-2',
};

/** A production-shaped email signup section with visible consent context and native validation. */
export function Newsletter({ node, props }: BlockRenderProps<NewsletterProps>) {
  const headingId = `${node.id}-heading`;
  const privacyId = props.privacy === undefined ? undefined : `${node.id}-privacy`;
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);
  const colorStyle = sectionColorStyle(props);
  const spacingStyle = sectionSpacingStyle(props);
  const rootStyle =
    colorStyle === undefined && spacingStyle === undefined
      ? undefined
      : { ...colorStyle, ...spacingStyle };
  const isSplit = props.variant === 'split';

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
      <div className={sectionContentClasses(props.width, props.align, props.gutter)}>
        <div className={cx(PANEL_CLASSES[props.variant], GAP_CLASSES.md)} data-newsletter-panel="">
          <div
            className={cx(
              'flex min-w-0 flex-col',
              ALIGN_CLASSES[props.align],
              GAP_CLASSES.sm,
              isSplit ? 'bg-surface-inverse p-6 text-text-inverse @lg:p-10' : undefined,
            )}
            data-newsletter-copy=""
          >
            {props.eyebrow === undefined ? null : (
              <p
                className={cx(
                  'm-0 text-sm font-semibold tracking-wide uppercase',
                  isSplit || props.tone === 'dark'
                    ? 'text-inherit opacity-70'
                    : 'text-text-muted',
                )}
              >
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
                  'm-0 max-w-content-narrow leading-relaxed text-pretty',
                  isSplit || props.tone === 'dark'
                    ? 'text-inherit opacity-80'
                    : 'text-text-muted',
                )}
              >
                {props.body}
              </p>
            )}
          </div>

          <form
            className={cx(
              'flex min-w-0 flex-col justify-center gap-gap-sm text-start',
              isSplit ? 'p-6 @lg:p-10' : undefined,
            )}
            action={props.action}
            method="post"
            data-newsletter-form=""
          >
            <label className="sr-only" htmlFor={`${node.id}-email`}>
              {props.emailLabel}
            </label>
            <div
              className={cx(
                'flex min-w-0 flex-col gap-gap-sm',
                props.formLayout === 'row' ? '@sm:flex-row' : undefined,
              )}
            >
              <input
                id={`${node.id}-email`}
                className="min-h-12 min-w-0 flex-1 rounded-lg border border-text-muted/30 bg-surface px-control-inline-md py-control-block-md text-text shadow-soft placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                type="email"
                name="email"
                inputMode="email"
                autoComplete="email"
                placeholder={props.placeholder}
                aria-describedby={privacyId}
                required
              />
              <button
                className="min-h-12 shrink-0 cursor-pointer rounded-lg border border-transparent bg-accent px-control-inline-lg py-control-block-md font-semibold text-accent-text shadow-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                type="submit"
              >
                {props.buttonLabel}
              </button>
            </div>
            {props.privacy === undefined ? null : (
              <p id={privacyId} className="m-0 text-xs leading-relaxed text-text-muted">
                {props.privacy}
              </p>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
