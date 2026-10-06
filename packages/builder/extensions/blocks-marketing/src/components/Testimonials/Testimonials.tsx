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

import { testimonialsSchema, type TestimonialsProps } from './schema';

/*
  The avatar letter is decoration derived from the author's name. While the
  name is being edited in place it is an editor element, not a string, so
  there is no letter to derive and the avatar stays empty for that moment.
*/
function initialOf(name: unknown): string {
  return typeof name === 'string' ? name.slice(0, 1).toLocaleUpperCase() : '';
}

/* A stored optional line counts only when it holds text (or an editor element). */
function shows(value: unknown): boolean {
  return value !== undefined && value !== '';
}

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
export function Testimonials({ node, props, isCanvas }: BlockRenderProps<TestimonialsProps>) {
  // The accessible name comes from the visible heading, never a copy of its text.
  const headingId = `${node.id}-heading`;
  /* Each inner element is a part: addressable on the canvas, stylable per part. */
  const part = blockPartProps({ node, props, isCanvas }, testimonialsSchema.parts);
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
        <header
          className={cx('flex max-w-content-narrow flex-col gap-3', ALIGN_CLASSES[props.align])}
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
            <p
              {...part('body', {
                className: cx(
                  'm-0 max-w-content-narrow',
                  props.tone === 'dark' ? 'text-inherit opacity-85' : 'text-text-muted',
                ),
              })}
              data-testimonials-intro=""
            >
              {props.body}
            </p>
          )}
        </header>
        <ul
          {...part('items', {
            className: cx(
              'm-0 grid w-full list-none p-0',
              COLUMN_CLASSES[props.columns],
              GAP_CLASSES.md,
            ),
          })}
          data-testimonials-grid=""
        >
          {props.items.map((item, index) => {
            const at = [index];
            const showsRole = shows(item.role);
            const showsCompany = shows(item.company);
            return (
              /* Keyed by position: a bound value may be an inline editor element. */
              <li key={index}>
                <figure
                  {...part('item', {
                    index: at,
                    className: cx('m-0 flex h-full flex-col gap-5', CARD_CLASSES[props.variant]),
                  })}
                  data-testimonials-card=""
                >
                  {item.rating === undefined ? null : (
                    <p
                      className="m-0 tracking-wide text-accent"
                      aria-label={`${String(item.rating)} out of 5 stars`}
                    >
                      <span aria-hidden="true">
                        {'★'.repeat(item.rating)}
                        {'☆'.repeat(5 - item.rating)}
                      </span>
                    </p>
                  )}
                  <blockquote
                    {...part('item.quote', {
                      index: at,
                      className: 'm-0 flex-1 text-lg leading-relaxed text-pretty',
                    })}
                  >
                    “{item.quote}”
                  </blockquote>
                  <figcaption className="flex items-center gap-3 font-semibold">
                    <span
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-sm text-accent"
                      aria-hidden="true"
                    >
                      {initialOf(item.author)}
                    </span>
                    <span className="flex flex-col">
                      <span {...part('item.author', { index: at })}>{item.author}</span>
                      {/*
                      Role and company are separate parts on one line, so each
                      edits in place; the separator is drawn only between two.
                    */}
                      {!showsRole && !showsCompany ? null : (
                        <span className="font-regular text-sm text-text-muted">
                          {showsRole ? (
                            <span {...part('item.role', { index: at })}>{item.role}</span>
                          ) : null}
                          {showsRole && showsCompany ? ' · ' : null}
                          {showsCompany ? (
                            <span {...part('item.company', { index: at })}>{item.company}</span>
                          ) : null}
                        </span>
                      )}
                    </span>
                  </figcaption>
                </figure>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
