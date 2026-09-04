import '../section-layout.css';

import type { SyntheticEvent } from 'react';

import type { BlockRenderProps } from '@craftkit/builder-schema';

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

import type { ContactProps } from './schema';

const LAYOUT_CLASSES: Record<ContactProps['variant'], string> = {
  split: 'grid-cols-1 @lg:grid-cols-2',
  card: 'grid-cols-1 @lg:grid-cols-5',
  centered: 'mx-auto max-w-content-narrow grid-cols-1',
};

const DETAILS_CLASSES: Record<ContactProps['variant'], string> = {
  split: 'flex min-w-0 flex-col gap-gap',
  card: 'flex min-w-0 flex-col gap-gap @lg:col-span-2',
  centered: 'flex min-w-0 flex-col items-center gap-gap text-center',
};

const FORM_CLASSES: Record<ContactProps['variant'], string> = {
  split: 'rounded-xl border border-text/10 bg-surface p-6 text-text shadow-soft @md:p-8',
  card: 'rounded-xl border border-text/10 bg-surface p-6 text-text shadow-elevated @lg:col-span-3 @lg:p-8',
  centered:
    'rounded-xl border border-text/10 bg-surface p-6 text-start text-text shadow-elevated @md:p-8',
};

function preventCanvasSubmission(event: SyntheticEvent<HTMLFormElement>): void {
  event.preventDefault();
}

/** A complete contact section with direct contact paths and a publishable, labelled form. */
export function Contact({ node, props, isCanvas }: BlockRenderProps<ContactProps>) {
  const headingId = `${node.id}-heading`;
  const formHeadingId = `${node.id}-form-heading`;
  const nameId = `${node.id}-name`;
  const emailId = `${node.id}-email`;
  const messageId = `${node.id}-message`;
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
          'grid text-start',
          LAYOUT_CLASSES[props.variant],
          GAP_CLASSES.lg,
        )}
        data-contact-layout={props.variant}
      >
        <div className={DETAILS_CLASSES[props.variant]}>
          <header
            className={cx(
              'flex max-w-content-narrow flex-col gap-gap-sm',
              ALIGN_CLASSES[props.align],
            )}
          >
            {props.eyebrow === undefined ? null : (
              <p className="m-0 inline-flex rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold tracking-wide text-accent uppercase">
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
                  'm-0 text-lg leading-relaxed',
                  props.tone === 'dark' ? 'text-inherit opacity-80' : 'text-text-muted',
                )}
              >
                {props.body}
              </p>
            )}
          </header>

          {props.email === undefined &&
          props.phone === undefined &&
          props.address === undefined ? null : (
            <address className="flex flex-col gap-gap-sm rounded-xl border border-text/10 bg-surface p-5 text-text not-italic shadow-soft">
              {props.email === undefined ? null : (
                <a
                  className="inline-flex min-h-11 items-center self-start font-semibold text-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                  href={`mailto:${props.email}`}
                >
                  {props.email}
                </a>
              )}
              {props.phone === undefined ? null : (
                <a
                  className="inline-flex min-h-11 items-center self-start font-semibold text-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                  href={`tel:${props.phone.replace(/\s/g, '')}`}
                >
                  {props.phone}
                </a>
              )}
              {props.address === undefined ? null : (
                <p className="m-0 whitespace-pre-line leading-relaxed text-text-muted">
                  {props.address}
                </p>
              )}
            </address>
          )}

          {props.availability === undefined ? null : (
            <p className="m-0 inline-flex items-center gap-gap-sm self-start rounded-full border border-success/30 bg-success/10 px-3 py-2 text-sm font-medium text-text">
              <span aria-hidden="true" className="size-2 rounded-full bg-success" />
              {props.availability}
            </p>
          )}
        </div>

        {!props.showForm ? null : (
          <form
            className={cx('flex min-w-0 flex-col gap-gap', FORM_CLASSES[props.variant])}
            action={props.formAction}
            method={props.method}
            onSubmit={isCanvas ? preventCanvasSubmission : undefined}
            aria-labelledby={formHeadingId}
          >
            <div className="flex flex-col gap-gap-xs">
              <h3
                id={formHeadingId}
                className="m-0 text-2xl leading-tight font-semibold tracking-tight"
              >
                {props.formTitle}
              </h3>
              {props.formBody === undefined ? null : (
                <p className="m-0 leading-relaxed text-text-muted">{props.formBody}</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-gap @md:grid-cols-2">
              <label className="flex min-w-0 flex-col gap-gap-xs font-medium" htmlFor={nameId}>
                {props.nameLabel}
                <input
                  id={nameId}
                  className="box-border min-h-12 w-full rounded-xl border border-text/15 bg-transparent px-control-inline-md py-control-block-sm text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                />
              </label>
              <label className="flex min-w-0 flex-col gap-gap-xs font-medium" htmlFor={emailId}>
                {props.emailLabel}
                <input
                  id={emailId}
                  className="box-border min-h-12 w-full rounded-xl border border-text/15 bg-transparent px-control-inline-md py-control-block-sm text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </label>
            </div>

            <label className="flex min-w-0 flex-col gap-gap-xs font-medium" htmlFor={messageId}>
              {props.messageLabel}
              <textarea
                id={messageId}
                className="box-border min-h-32 w-full resize-y rounded-xl border border-text/15 bg-transparent px-control-inline-md py-control-block-md text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                name="message"
                rows={5}
                required
              />
            </label>

            <button
              className="inline-flex min-h-12 items-center justify-center self-start rounded-xl border border-accent bg-accent px-control-inline-lg py-control-block-md font-semibold text-accent-text shadow-soft transition duration-300 hover:-translate-y-0.5 hover:shadow-elevated focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent motion-reduce:transform-none"
              type="submit"
            >
              {props.submitLabel}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
