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
import { sectionMotionAttributes } from '../section-motion-attributes';
import { sectionSpacingStyle } from '../section-spacing';
import { sectionTypographyClasses } from '../section-typography';

import type { TestimonialsProps } from './schema';

const COLUMN_CLASSES: Record<TestimonialsProps['columns'], string> = {
  auto: 'grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-3',
  '1': 'grid-cols-1',
  '2': 'grid-cols-1 @sm:grid-cols-2',
  '3': 'grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-3',
};

const CARD_CLASSES: Record<TestimonialsProps['variant'], string> = {
  cards: 'rounded-xl border border-text/10 bg-surface p-6 text-text shadow-soft',
  spotlight:
    'rounded-xl border border-text/10 bg-surface p-6 text-text shadow-soft first:@lg:col-span-2 first:@lg:p-10',
  wall: 'border-t border-text/15 py-6 text-inherit',
};

/** Customer quotes as semantic figures with attributed captions. */
export function Testimonials({ node, props }: BlockRenderProps<TestimonialsProps>) {
  // The accessible name comes from the visible heading, never a copy of its text.
  const headingId = `${node.id}-heading`;
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
          GAP_CLASSES.md,
        )}
        data-testimonials-content=""
      >
        <header className={cx('flex max-w-content-narrow flex-col gap-3', ALIGN_CLASSES[props.align])}>
          {props.eyebrow === undefined ? null : (
            <p className="m-0 text-xs font-semibold tracking-wide text-accent uppercase">
              {props.eyebrow}
            </p>
          )}
          <h2 id={headingId} className="m-0 text-3xl leading-tight font-bold tracking-tight text-balance @md:text-4xl">
            {props.heading}
          </h2>
        {props.body === undefined ? null : (
          <p
            className={cx(
              'm-0 max-w-content-narrow',
              props.tone === 'dark' ? 'text-inherit opacity-85' : 'text-text-muted',
            )}
            data-testimonials-intro=""
          >
            {props.body}
          </p>
        )}
        </header>
        <ul
          className={cx(
            'm-0 grid w-full list-none p-0',
            COLUMN_CLASSES[props.columns],
            GAP_CLASSES.md,
          )}
          data-testimonials-grid=""
        >
          {props.items.map((item, index) => (
            <li key={`${item.author}-${item.quote.slice(0, 16)}-${String(index)}`}>
              <figure
                className={cx('m-0 flex h-full flex-col gap-5', CARD_CLASSES[props.variant])}
                data-testimonials-card=""
              >
                {item.rating === undefined ? null : (
                  <p className="m-0 tracking-wide text-accent" aria-label={`${String(item.rating)} out of 5 stars`}>
                    <span aria-hidden="true">{'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}</span>
                  </p>
                )}
                <blockquote className="m-0 flex-1 text-lg leading-relaxed text-pretty">
                  “{item.quote}”
                </blockquote>
                <figcaption className="flex items-center gap-3 font-semibold">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-sm text-accent" aria-hidden="true">
                    {item.author.slice(0, 1).toLocaleUpperCase()}
                  </span>
                  <span className="flex flex-col">
                    <span>{item.author}</span>
                    {item.role === undefined && item.company === undefined ? null : (
                      <span className="font-regular text-sm text-text-muted">
                        {[item.role, item.company].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
