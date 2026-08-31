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

import type { BentoGridProps } from './schema';

const MOSAIC_SPAN_CLASSES: Record<BentoGridProps['items'][number]['size'], string> = {
  small: '@md:col-span-3 @xl:col-span-4',
  wide: '@md:col-span-6 @xl:col-span-8',
  tall: '@md:col-span-3 @xl:col-span-4 @xl:row-span-2',
  featured: '@md:col-span-6 @xl:col-span-8 @xl:row-span-2',
};

const EMPHASIS_CLASSES: Record<BentoGridProps['items'][number]['emphasis'], string> = {
  neutral: 'border-text-muted/20 bg-surface text-text',
  accent: 'border-accent bg-accent text-accent-text',
  inverse: 'border-surface-inverse bg-surface-inverse text-text-inverse',
};

const MUTED_CLASSES: Record<BentoGridProps['items'][number]['emphasis'], string> = {
  neutral: 'text-text-muted',
  accent: 'text-inherit opacity-80',
  inverse: 'text-inherit opacity-75',
};

const CARD_HEIGHT_CLASSES: Record<BentoGridProps['items'][number]['size'], string> = {
  small: 'min-h-56',
  wide: 'min-h-56',
  tall: 'min-h-80',
  featured: 'min-h-72',
};

/** A responsive editorial grid whose hierarchy is controlled by explicit item intent. */
export function BentoGrid({ node, props }: BlockRenderProps<BentoGridProps>) {
  const headingId = `${node.id}-heading`;
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
        data-bento-content=""
      >
        <div className={cx('flex max-w-content-standard flex-col', GAP_CLASSES.sm)}>
          {props.eyebrow === undefined ? null : (
            <p
              className={cx(
                'm-0 text-sm font-semibold tracking-wide uppercase',
                props.tone === 'dark' ? 'text-inherit opacity-70' : 'text-text-muted',
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
                'm-0 max-w-content-narrow text-lg leading-relaxed text-pretty',
                props.tone === 'dark' ? 'text-inherit opacity-80' : 'text-text-muted',
              )}
            >
              {props.body}
            </p>
          )}
        </div>

        <ul
          className={cx(
            'm-0 grid w-full list-none grid-cols-1 p-0 @md:grid-cols-6 @xl:grid-cols-12',
            GAP_CLASSES.md,
          )}
          data-bento-grid=""
        >
          {props.items.map((item, index) => (
            <li
              key={`${item.title}-${String(index)}`}
              className={cx(
                'group relative overflow-hidden rounded-xl border p-6 shadow-soft hover:shadow-elevated @lg:p-8',
                CARD_HEIGHT_CLASSES[item.size],
                props.layout === 'equal'
                  ? '@md:col-span-3 @xl:col-span-4'
                  : MOSAIC_SPAN_CLASSES[item.size],
                EMPHASIS_CLASSES[item.emphasis],
              )}
              data-bento-card=""
              data-bento-size={item.size}
            >
              <article className="flex h-full min-h-0 flex-col justify-between gap-gap-lg text-start">
                <div className="flex items-start justify-between gap-gap">
                  <span
                    className={cx(
                      'text-xs font-semibold tracking-wide uppercase',
                      MUTED_CLASSES[item.emphasis],
                    )}
                  >
                    {item.kicker ?? String(index + 1).padStart(2, '0')}
                  </span>
                  {item.metric === undefined ? null : (
                    <strong
                      className="text-3xl leading-none font-bold tracking-tight"
                      data-bento-metric=""
                    >
                      {item.metric}
                    </strong>
                  )}
                </div>
                <div className="flex flex-col gap-gap-sm">
                  <h3
                    className={cx(
                      'm-0 leading-tight font-semibold tracking-tight text-balance',
                      item.size === 'small' ? 'text-xl' : 'text-2xl @lg:text-3xl',
                    )}
                  >
                    {item.title}
                  </h3>
                  <p
                    className={cx('m-0 leading-relaxed text-pretty', MUTED_CLASSES[item.emphasis])}
                  >
                    {item.body}
                  </p>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
