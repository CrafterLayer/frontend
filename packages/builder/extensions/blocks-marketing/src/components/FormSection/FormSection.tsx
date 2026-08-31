import '../section-layout.css';

import type { ReactNode, SyntheticEvent } from 'react';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import { ALIGN_CLASSES, cx, sectionContentClasses, sectionShellClasses } from '../section-classes';
import { sectionColorStyle } from '../section-color';
import { sectionMotionAttributes } from '../section-motion';
import { sectionSpacingStyle } from '../section-spacing';
import { sectionTypographyClasses } from '../section-typography';

import type { FormSectionField, FormSectionProps } from './schema';

const PANEL_CLASSES: Record<FormSectionProps['variant'], string> = {
  split:
    'grid grid-cols-1 overflow-hidden rounded-xl border border-text/10 bg-surface text-text shadow-elevated @lg:grid-cols-5',
  card: 'mx-auto flex max-w-content-standard flex-col rounded-xl border border-text/10 bg-surface p-6 text-text shadow-elevated @md:p-8 @lg:p-10',
  minimal: 'mx-auto flex max-w-content-standard flex-col',
};

const COPY_CLASSES: Record<FormSectionProps['variant'], string> = {
  split:
    'flex min-w-0 flex-col justify-between gap-gap-lg bg-surface-inverse p-6 text-text-inverse @md:p-8 @lg:col-span-2 @lg:p-10',
  card: 'flex min-w-0 flex-col gap-gap-sm',
  minimal: 'flex min-w-0 flex-col gap-gap-sm',
};

const FORM_CLASSES: Record<FormSectionProps['variant'], string> = {
  split: 'grid min-w-0 grid-cols-1 gap-gap p-6 @md:grid-cols-2 @md:p-8 @lg:col-span-3 @lg:p-10',
  card: 'mt-8 grid min-w-0 grid-cols-1 gap-gap @md:grid-cols-2',
  minimal: 'mt-8 grid min-w-0 grid-cols-1 gap-gap @md:grid-cols-2',
};

const INPUT_TYPES = new Set<FormSectionField['type']>([
  'text',
  'email',
  'tel',
  'url',
  'number',
  'date',
]);

function preventCanvasSubmission(event: SyntheticEvent<HTMLFormElement>): void {
  event.preventDefault();
}

function fieldControl(
  field: FormSectionField,
  inputId: string,
  helperId: string | undefined,
  controlClassName: string,
): ReactNode {
  if (field.type === 'textarea') {
    return (
      <textarea
        id={inputId}
        className={cx(controlClassName, 'min-h-32 resize-y')}
        name={field.name}
        rows={field.rows}
        placeholder={field.placeholder}
        autoComplete={field.autoComplete}
        aria-describedby={helperId}
        required={field.required}
      />
    );
  }

  if (field.type === 'select') {
    return (
      <select
        id={inputId}
        className={controlClassName}
        name={field.name}
        autoComplete={field.autoComplete}
        aria-describedby={helperId}
        required={field.required}
        defaultValue=""
      >
        {field.placeholder === undefined ? null : (
          <option value="" disabled>
            {field.placeholder}
          </option>
        )}
        {field.options.map((option) => (
          <option key={`${option.value}-${option.label}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <input
        id={inputId}
        className="size-5 shrink-0 rounded border border-text/30 text-accent accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        name={field.name}
        type="checkbox"
        value="yes"
        aria-describedby={helperId}
        required={field.required}
      />
    );
  }

  const type = INPUT_TYPES.has(field.type) ? field.type : 'text';
  const inputMode =
    type === 'email' ? 'email' : type === 'tel' ? 'tel' : type === 'url' ? 'url' : undefined;

  return (
    <input
      id={inputId}
      className={controlClassName}
      name={field.name}
      type={type}
      inputMode={inputMode}
      placeholder={field.placeholder}
      autoComplete={field.autoComplete}
      aria-describedby={helperId}
      required={field.required}
    />
  );
}

/** A configurable native form that stays inert in the canvas and publishable outside it. */
export function FormSection({ node, props, isCanvas }: BlockRenderProps<FormSectionProps>) {
  const headingId = `${node.id}-heading`;
  const successId = props.successHint === undefined ? undefined : `${node.id}-success-hint`;
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);
  const colorStyle = sectionColorStyle(props);
  const spacingStyle = sectionSpacingStyle(props);
  const style =
    colorStyle === undefined && spacingStyle === undefined
      ? undefined
      : { ...colorStyle, ...spacingStyle };
  const controlClassName = cx(
    'box-border w-full border border-text/15 bg-transparent text-text outline-none transition placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/20',
    props.controlDensity === 'compact'
      ? 'min-h-10 px-control-inline-sm py-control-block-sm'
      : 'min-h-12 px-control-inline-md py-control-block-md',
    props.controlRadius === 'small' ? 'rounded' : 'rounded-xl',
  );

  return (
    <section
      className={cx(
        sectionShellClasses(props.tone, props.spacing),
        '@container',
        sectionTypographyClasses(props),
        motionClassName,
        props.className,
      )}
      style={style}
      aria-labelledby={headingId}
      {...motionData}
    >
      <div className={sectionContentClasses(props.width, props.align, props.gutter)}>
        <div className={PANEL_CLASSES[props.variant]} data-form-layout={props.variant}>
          <header className={cx(COPY_CLASSES[props.variant], ALIGN_CLASSES[props.align])}>
            <div className="flex min-w-0 flex-col gap-gap-sm">
              {props.eyebrow === undefined ? null : (
                <p className="m-0 text-sm font-semibold tracking-wide text-accent uppercase">
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
                    'm-0 max-w-content-narrow text-lg leading-relaxed text-pretty',
                    props.variant === 'split' || props.tone === 'dark'
                      ? 'text-inherit opacity-80'
                      : 'text-text-muted',
                  )}
                >
                  {props.body}
                </p>
              )}
            </div>

            {props.footerNote === undefined || props.variant !== 'split' ? null : (
              <p className="m-0 text-sm leading-relaxed text-inherit opacity-70">
                {props.footerNote}
              </p>
            )}
          </header>

          <form
            className={FORM_CLASSES[props.variant]}
            action={props.action}
            method={props.method}
            onSubmit={isCanvas ? preventCanvasSubmission : undefined}
            aria-labelledby={headingId}
            aria-describedby={successId}
          >
            {props.fields.map((field) => {
              const inputId = `${node.id}-${field.id}`;
              const helperId = field.helper === undefined ? undefined : `${inputId}-helper`;
              const isCheckbox = field.type === 'checkbox';
              return (
                <div
                  key={field.id}
                  className={cx(
                    'flex min-w-0 flex-col gap-gap-xs text-start',
                    field.width === 'full' ? '@md:col-span-2' : undefined,
                  )}
                >
                  <label
                    className={cx(
                      'font-medium',
                      isCheckbox
                        ? 'flex min-h-11 cursor-pointer items-start gap-gap-sm leading-relaxed'
                        : 'flex flex-col gap-gap-xs',
                    )}
                    htmlFor={inputId}
                  >
                    {isCheckbox ? fieldControl(field, inputId, helperId, controlClassName) : null}
                    <span>
                      {field.label}
                      {field.required ? (
                        <span className="ms-1 text-accent" aria-hidden="true">
                          *
                        </span>
                      ) : null}
                    </span>
                    {isCheckbox ? null : fieldControl(field, inputId, helperId, controlClassName)}
                  </label>
                  {field.helper === undefined ? null : (
                    <p id={helperId} className="m-0 text-sm leading-relaxed text-text-muted">
                      {field.helper}
                    </p>
                  )}
                </div>
              );
            })}

            <div className="flex min-w-0 flex-col gap-gap-sm @md:col-span-2">
              <button
                className={cx(
                  'inline-flex min-h-12 items-center justify-center rounded-xl border px-control-inline-lg py-control-block-md font-semibold transition duration-300 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent motion-reduce:transform-none',
                  props.buttonVariant === 'solid'
                    ? 'border-accent bg-accent text-accent-text shadow-strong hover:shadow-elevated'
                    : 'border-accent bg-transparent text-accent hover:bg-accent/10',
                  props.buttonWidth === 'full' ? 'w-full' : 'self-start',
                )}
                type="submit"
              >
                {props.submitLabel}
              </button>
              {props.footerNote === undefined || props.variant === 'split' ? null : (
                <p className="m-0 text-sm leading-relaxed text-text-muted">{props.footerNote}</p>
              )}
              {props.successHint === undefined ? null : (
                <p id={successId} className="m-0 text-sm font-medium text-success">
                  {props.successHint}
                </p>
              )}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
