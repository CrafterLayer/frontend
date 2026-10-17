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

import { menuSectionSchema, type MenuSectionProps } from './schema';

const NBSP = ' ';

/*
  The currency is ONE part shown beside every price. While it is edited in
  place its value is the editor element, which must render once: the first
  dish hosts it, the others show the committed text.
*/
function sharedText(value: ReactNode, host: boolean): ReactNode {
  return host || typeof value === 'string' ? value : null;
}

/**
 * Whether a currency written BEFORE the number sits against it: a symbol
 * ("$4", "£4") does; a word or code ("SAR 4", «ر.س ٤») keeps a no-break
 * space, as every currency written after the number does. Mid-edit (an
 * editor element) it keeps its space.
 */
function tightBefore(currency: ReactNode): boolean {
  return typeof currency === 'string' && !/\p{L}/u.test(currency);
}

/** A menu or price list: categories of dishes with prices, tags and photos. */
export function MenuSection({ node, props, isCanvas }: BlockRenderProps<MenuSectionProps>) {
  const headingId = `${node.id}-heading`;
  /* Each inner element is a part: addressable on the canvas, stylable per part. */
  const part = blockPartProps({ node, props, isCanvas }, menuSectionSchema.parts);
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);
  const colorStyle = sectionColorStyle(props);
  const spacingStyle = sectionSpacingStyle(props);
  const style =
    colorStyle === undefined && spacingStyle === undefined
      ? undefined
      : { ...colorStyle, ...spacingStyle };
  const muted = props.tone === 'dark' ? 'text-inherit opacity-80' : 'text-text-muted';
  /* A currency mid-edit (an element) still shows, so its editor has a place to render. */
  const hasCurrency = typeof props.currency !== 'string' || props.currency.trim() !== '';
  const before = hasCurrency && props.currencyPosition === 'before';
  const after = hasCurrency && props.currencyPosition === 'after';
  const firstDishCategory = props.categories.findIndex((category) => category.items.length > 0);
  const atEnd = props.priceAlign === 'end';

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
        data-menu-content=""
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
          {...part('categories', {
            className: cx(
              'grid w-full grid-cols-1 gap-x-gap-lg gap-y-gap-lg text-start',
              props.columns === '2' ? '@3xl:grid-cols-2' : undefined,
            ),
          })}
          data-menu-columns={props.columns}
        >
          {props.categories.map((category, categoryIndex) => {
            const at = [categoryIndex];
            return (
              /* Keyed by position: a bound value may be an inline editor element. */
              <div key={categoryIndex} {...part('category', { index: at, className: 'min-w-0' })}>
                <h3
                  {...part('category.name', {
                    index: at,
                    className:
                      'm-0 border-b-2 border-current/15 pb-2 text-xl leading-tight font-bold',
                  })}
                >
                  {category.name}
                </h3>
                {category.description === undefined ? null : (
                  <p
                    {...part('category.description', {
                      index: at,
                      className: cx('m-0 mt-2 text-sm leading-relaxed', muted),
                    })}
                  >
                    {category.description}
                  </p>
                )}
                <ul
                  {...part('category.items', {
                    index: at,
                    className: 'm-0 flex list-none flex-col p-0',
                  })}
                >
                  {category.items.map((item, itemIndex) => {
                    const dish = [categoryIndex, itemIndex];
                    const currency = (
                      <span {...part('currency')}>
                        {sharedText(
                          props.currency,
                          categoryIndex === firstDishCategory && itemIndex === 0,
                        )}
                      </span>
                    );
                    const photo = props.showImages && item.imageSrc !== undefined;
                    return (
                      <li
                        key={itemIndex}
                        {...part('dish', {
                          index: dish,
                          className:
                            'flex min-w-0 gap-gap border-b border-current/10 py-3 last:border-b-0',
                        })}
                      >
                        {photo ? (
                          <img
                            {...part('dish.image', {
                              index: dish,
                              className: 'size-16 shrink-0 rounded-lg object-cover @md:size-20',
                            })}
                            src={item.imageSrc}
                            alt={item.imageAlt ?? ''}
                            loading="lazy"
                            decoding="async"
                          />
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <div
                            className={cx(
                              'flex items-baseline',
                              atEnd ? 'gap-gap-sm' : 'flex-wrap gap-x-gap-sm gap-y-1',
                            )}
                          >
                            <span
                              {...part('dish.name', {
                                index: dish,
                                className: cx(
                                  'min-w-0 font-semibold',
                                  atEnd ? undefined : 'shrink',
                                ),
                              })}
                            >
                              {item.name}
                            </span>
                            {atEnd ? (
                              <span
                                aria-hidden="true"
                                className={cx(
                                  'min-w-6 flex-1',
                                  props.leaders
                                    ? 'border-b-2 border-dotted border-current/30'
                                    : undefined,
                                )}
                                data-menu-leader={props.leaders ? 'dotted' : 'none'}
                              />
                            ) : null}
                            {/* A price keeps its own direction: «٤٢ ر.س» and "$3.75" read right on either page. */}
                            <span
                              className="shrink-0 font-semibold whitespace-nowrap tabular-nums"
                              data-menu-price=""
                            >
                              <bdi>
                                {before ? (
                                  <>
                                    {currency}
                                    {tightBefore(props.currency) ? null : NBSP}
                                  </>
                                ) : null}
                                <span {...part('dish.price', { index: dish })}>{item.price}</span>
                                {after ? (
                                  <>
                                    {NBSP}
                                    {currency}
                                  </>
                                ) : null}
                              </bdi>
                            </span>
                          </div>
                          {item.description === undefined ? null : (
                            <p
                              {...part('dish.description', {
                                index: dish,
                                className: cx('m-0 mt-1 text-sm leading-relaxed', muted),
                              })}
                            >
                              {item.description}
                            </p>
                          )}
                          {item.tags.length === 0 ? null : (
                            <ul
                              className="m-0 mt-2 flex list-none flex-wrap gap-gap-xs p-0"
                              data-menu-tags=""
                            >
                              {item.tags.map((tag, tagIndex) => (
                                <li key={tagIndex}>
                                  <span
                                    {...part('dish.tag', {
                                      index: [categoryIndex, itemIndex, tagIndex],
                                      className:
                                        'inline-flex rounded-full border border-current/25 px-2 py-0.5 text-xs font-medium',
                                    })}
                                  >
                                    {tag}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        {props.note === undefined ? null : (
          <p
            {...part('note', {
              className: cx('m-0 max-w-content-narrow text-sm leading-relaxed', muted),
            })}
          >
            {props.note}
          </p>
        )}
      </div>
    </section>
  );
}
