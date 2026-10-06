import '../section-layout.css';

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

import { processStepsSchema, type ProcessStepsProps } from './schema';

const COLUMN_CLASSES: Readonly<Record<ProcessStepsProps['columns'], string>> = {
  auto: 'grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-4',
  '2': 'grid-cols-1 @sm:grid-cols-2',
  '3': 'grid-cols-1 @sm:grid-cols-3',
  '4': 'grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-4',
};

const ITEM_CLASSES: Readonly<Record<ProcessStepsProps['variant'], string>> = {
  cards: 'h-full rounded-xl border border-text/10 bg-surface p-6 text-text shadow-soft',
  minimal: 'border-s-2 border-accent py-4 ps-5',
  accented: 'h-full rounded-xl bg-accent p-6 text-accent-text shadow-elevated',
};

/** An ordered workflow that makes a service, onboarding flow, or methodology easy to scan. */
export function ProcessSteps({ node, props, isCanvas }: BlockRenderProps<ProcessStepsProps>) {
  const headingId = `${node.id}-heading`;
  /* Each inner element is a part: addressable on the canvas, stylable per part. */
  const part = blockPartProps({ node, props, isCanvas }, processStepsSchema.parts);
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
          'flex flex-col',
          ALIGN_CLASSES[props.align],
          GAP_CLASSES.lg,
        )}
        data-process-content=""
      >
        <header className={cx('flex max-w-content-narrow flex-col', GAP_CLASSES.sm)}>
          <p
            {...part('eyebrow', {
              className: 'm-0 text-xs font-semibold uppercase tracking-wide text-accent',
            })}
          >
            {props.eyebrow}
          </p>
          <h2
            {...part('heading', {
              id: headingId,
              className:
                'm-0 text-3xl font-bold leading-tight tracking-tight text-balance @md:text-4xl',
            })}
          >
            {props.heading}
          </h2>
          <p
            {...part('body', {
              className: cx(
                'm-0 text-base leading-relaxed',
                props.tone === 'dark' ? 'text-inherit opacity-80' : 'text-text-muted',
              ),
            })}
          >
            {props.body}
          </p>
        </header>
        <ol
          {...part('steps', {
            className: cx(
              'm-0 w-full list-none p-0',
              props.layout === 'horizontal'
                ? cx('grid gap-4', COLUMN_CLASSES[props.columns])
                : 'flex max-w-content-standard flex-col gap-4',
            ),
          })}
          data-process-list={props.layout}
        >
          {props.steps.map((step, index) => (
            /* Keyed by position: a bound value may be an inline editor element. */
            <li
              key={index}
              {...part('step', {
                index: [index],
                className: cx('group relative flex min-w-0 flex-col', ITEM_CLASSES[props.variant]),
              })}
              data-process-step=""
            >
              <div className="mb-5 flex items-center justify-between gap-3">
                {props.showNumbers ? (
                  <span
                    aria-hidden="true"
                    className={cx(
                      'grid size-12 shrink-0 place-items-center rounded-full border text-sm font-bold',
                      props.variant === 'accented'
                        ? 'border-current/20 bg-current/15 text-inherit'
                        : 'border-accent/15 bg-accent/10 text-accent',
                    )}
                    data-process-number=""
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                ) : (
                  <span
                    aria-hidden="true"
                    className="size-3 shrink-0 rounded-full bg-accent"
                    data-process-marker=""
                  />
                )}
                {step.meta === undefined ? null : (
                  <span
                    {...part('step.meta', {
                      index: [index],
                      className: cx(
                        'text-xs font-semibold uppercase tracking-wide',
                        props.variant === 'accented'
                          ? 'text-inherit opacity-75'
                          : 'text-text-muted',
                      ),
                    })}
                  >
                    {step.meta}
                  </span>
                )}
              </div>
              <h3
                {...part('step.title', {
                  index: [index],
                  className: 'm-0 text-xl font-bold leading-tight tracking-tight',
                })}
              >
                {step.title}
              </h3>
              <p
                {...part('step.body', {
                  index: [index],
                  className: cx(
                    'm-0 mt-3 text-sm leading-relaxed',
                    props.variant === 'accented' || props.tone === 'dark'
                      ? 'text-inherit opacity-80'
                      : 'text-text-muted',
                  ),
                })}
              >
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
