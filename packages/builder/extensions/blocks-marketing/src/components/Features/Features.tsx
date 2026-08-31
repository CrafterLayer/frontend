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

import type { FeaturesProps } from './schema';

const COLUMN_CLASSES: Record<FeaturesProps['columns'], string> = {
  '1': 'grid-cols-1',
  '2': 'grid-cols-1 @sm:grid-cols-2',
  '3': 'grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-3',
  '4': 'grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-3 @xl:grid-cols-4',
};

const CARD_CLASSES: Record<FeaturesProps['variant'], string> = {
  cards:
    'rounded-xl border border-text/10 bg-surface p-6 text-text shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-elevated',
  bordered: 'border-t-2 border-accent py-6 text-inherit',
  minimal: 'py-4 text-inherit',
};

/** Feature cards from document data — a labelled section over a semantic list. */
export function Features({ node, props }: BlockRenderProps<FeaturesProps>) {
  // The accessible name comes from the visible heading, never a copy of its text.
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
      {...motionData}
      style={rootStyle}
      aria-labelledby={headingId}
    >
      <div
        className={cx(
          sectionContentClasses(props.width, props.align, props.gutter),
          'flex flex-col',
          ALIGN_CLASSES[props.align],
          GAP_CLASSES.md,
        )}
        data-features-content=""
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
            data-features-intro=""
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
          data-features-grid=""
        >
          {props.items.map((item, index) => (
            <li
              key={`${item.title}-${String(index)}`}
              className={cx('group flex min-w-0 flex-col gap-4', CARD_CLASSES[props.variant])}
              data-features-card=""
            >
              <span
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-sm font-bold text-accent"
                aria-hidden="true"
              >
                {item.icon ?? String(index + 1).padStart(2, '0')}
              </span>
              <div className="flex flex-col gap-2">
                {item.kicker === undefined ? null : (
                  <p className="m-0 text-xs font-semibold tracking-wide text-accent uppercase">
                    {item.kicker}
                  </p>
                )}
                <h3 className="m-0 text-xl font-semibold tracking-tight">{item.title}</h3>
                <p className="m-0 leading-relaxed text-text-muted">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
