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

import { faqSchema, type FaqProps } from './schema';

const ITEM_CLASSES: Record<FaqProps['variant'], string> = {
  divided: 'border-b border-text-muted/20 py-gap',
  cards:
    'rounded-xl border border-text-muted/20 bg-surface p-6 text-text shadow-soft open:shadow-elevated @lg:p-8',
};

/** Frequently asked questions rendered as native, keyboard-operable disclosures. */
export function Faq({ node, props, isCanvas }: BlockRenderProps<FaqProps>) {
  const headingId = `${node.id}-heading`;
  /* Each inner element is a part: addressable on the canvas, stylable per part. */
  const part = blockPartProps({ node, props, isCanvas }, faqSchema.parts);
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);
  const colorStyle = sectionColorStyle(props);
  const spacingStyle = sectionSpacingStyle(props);
  const rootStyle =
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
      style={rootStyle}
      aria-labelledby={headingId}
      {...motionData}
    >
      <div
        className={cx(
          sectionContentClasses(props.width, props.align, props.gutter),
          'flex flex-col',
          ALIGN_CLASSES[props.align],
          GAP_CLASSES.lg,
        )}
        data-faq-content=""
      >
        <div className={cx('flex max-w-content-standard flex-col', GAP_CLASSES.sm)}>
          {props.eyebrow === undefined ? null : (
            <p
              {...part('eyebrow', {
                className: cx(
                  'm-0 text-sm font-semibold tracking-wide uppercase',
                  props.tone === 'dark' ? 'text-inherit opacity-70' : 'text-text-muted',
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
        </div>

        <div
          {...part('items', {
            className: cx(
              'grid w-full grid-cols-1 items-start',
              props.layout === 'columns' ? '@lg:grid-cols-2' : undefined,
              GAP_CLASSES[props.variant === 'cards' ? 'md' : 'sm'],
            ),
          })}
          data-faq-list=""
        >
          {props.items.map((item, index) => (
            /* Keyed by position: a bound value may be an inline editor element. */
            <details
              key={index}
              {...part('item', {
                index: [index],
                className: cx('group text-start', ITEM_CLASSES[props.variant]),
              })}
              open={props.openFirst && index === 0 ? true : undefined}
              data-faq-item=""
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-gap text-lg leading-tight font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                <span className="flex min-w-0 items-start gap-gap-sm">
                  {props.showNumbers ? (
                    <span className="shrink-0 text-sm font-semibold text-accent" aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  ) : null}
                  <span {...part('item.question', { index: [index] })}>{item.question}</span>
                </span>
                <span
                  className="shrink-0 text-xl leading-none text-accent group-open:rotate-45"
                  aria-hidden="true"
                >
                  +
                </span>
              </summary>
              <p
                {...part('item.answer', {
                  index: [index],
                  className: cx(
                    'mt-gap-sm mb-0 max-w-content-narrow pe-gap-lg leading-relaxed text-pretty',
                    props.variant === 'cards' || props.tone !== 'dark'
                      ? 'text-text-muted'
                      : 'text-inherit opacity-75',
                  ),
                })}
              >
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
