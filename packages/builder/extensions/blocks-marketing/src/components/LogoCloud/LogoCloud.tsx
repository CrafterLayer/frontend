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

import type { LogoCloudProps } from './schema';

const COLUMN_CLASSES: Readonly<Record<LogoCloudProps['columns'], string>> = {
  '3': 'grid-cols-1 @sm:grid-cols-2 @xl:grid-cols-3',
  '4': 'grid-cols-1 @sm:grid-cols-2 @3xl:grid-cols-4',
  '5': 'grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-3 @4xl:grid-cols-5',
  '6': 'grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-3 @5xl:grid-cols-6',
};

const ITEM_CLASSES: Readonly<Record<LogoCloudProps['variant'], string>> = {
  minimal: 'border-y border-current/10 bg-transparent px-3 py-4 @md:px-4 @md:py-5',
  cards:
    'rounded-xl border border-text/10 bg-surface px-3 py-5 text-text shadow-soft @md:px-5 @md:py-6',
  framed: 'rounded-base bg-surface/80 px-3 py-5 text-text @md:px-5 @md:py-6',
};

/** A semantic collection of text-first brand marks that remains useful without external assets. */
export function LogoCloud({ node, props }: BlockRenderProps<LogoCloudProps>) {
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
          GAP_CLASSES.lg,
        )}
        data-logo-cloud-content=""
      >
        <div
          className={cx(
            'flex max-w-content-narrow flex-col',
            ALIGN_CLASSES[props.align],
            GAP_CLASSES.sm,
          )}
        >
          <p className="m-0 text-xs font-semibold uppercase tracking-wide text-accent">
            {props.eyebrow}
          </p>
          <h2
            id={headingId}
            className="m-0 text-3xl font-bold leading-tight tracking-tight text-balance @md:text-4xl"
          >
            {props.heading}
          </h2>
          {props.body === undefined ? null : (
            <p
              className={cx(
                'm-0 text-base leading-relaxed',
                props.tone === 'dark' ? 'text-inherit opacity-80' : 'text-text-muted',
              )}
            >
              {props.body}
            </p>
          )}
        </div>
        <ul
          className={cx(
            'm-0 grid w-full list-none p-0',
            COLUMN_CLASSES[props.columns],
            props.variant === 'framed'
              ? 'gap-2 rounded-xl border border-current/10 bg-current/5 p-2 shadow-soft'
              : 'gap-4',
          )}
          data-logo-cloud-grid=""
        >
          {props.items.map((item) => {
            const monogram = item.name
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part.slice(0, 1))
              .join('')
              .toUpperCase();

            return (
              <li
                key={item.name}
                className={cx(
                  'flex min-h-20 min-w-0 items-center gap-gap-sm',
                  ITEM_CLASSES[props.variant],
                )}
                data-logo-cloud-item=""
              >
                <span
                  aria-hidden="true"
                  className="grid size-10 shrink-0 place-items-center rounded-xl border border-accent/15 bg-accent/10 text-sm font-bold text-accent @md:size-12"
                >
                  {monogram}
                </span>
                <span className="flex min-w-0 flex-col text-start">
                  <span className="break-words text-base leading-tight font-bold tracking-tight @md:text-lg">
                    {item.name}
                  </span>
                  {item.descriptor === undefined ? null : (
                    <span
                      className={cx(
                        'break-words text-xs leading-snug',
                        props.variant === 'minimal' && props.tone === 'dark'
                          ? 'text-inherit opacity-70'
                          : 'text-text-muted',
                      )}
                    >
                      {item.descriptor}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
