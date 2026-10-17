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

import { logoCloudSchema, type LogoCloudProps } from './schema';

/*
  The monogram is decoration derived from the brand name. While the name is
  being edited in place it is an editor element, not a string, so there is
  nothing to derive and the tile shows no letters for that moment.
*/
function monogramOf(name: unknown): string {
  if (typeof name !== 'string') return '';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.slice(0, 1))
    .join('')
    .toUpperCase();
}

/*
  Never one logo per row (blocks-polish 2026-10-08): six logos stacked into six
  rows on a phone read as a list, not a cloud. Two columns from the smallest
  container, three from 32rem (the nearest container step to 480px), and the
  chosen count once there is room for it. Four logos skip three columns,
  which would leave one alone on a second row.
*/
const COLUMN_CLASSES: Readonly<Record<LogoCloudProps['columns'], string>> = {
  '3': 'grid-cols-2 @lg:grid-cols-3',
  '4': 'grid-cols-2 @3xl:grid-cols-4',
  '5': 'grid-cols-2 @lg:grid-cols-3 @4xl:grid-cols-5',
  '6': 'grid-cols-2 @lg:grid-cols-3 @5xl:grid-cols-6',
};

const ITEM_CLASSES: Readonly<Record<LogoCloudProps['variant'], string>> = {
  minimal: 'border-y border-current/10 bg-transparent px-3 py-4 @md:px-4 @md:py-5',
  cards:
    'rounded-xl border border-text/10 bg-surface px-3 py-5 text-text shadow-soft @md:px-5 @md:py-6',
  framed: 'rounded-base bg-surface/80 px-3 py-5 text-text @md:px-5 @md:py-6',
};

/** A semantic collection of brand marks: a logo image when the brand has one, else a monogram from its name. */
export function LogoCloud({ node, props, isCanvas }: BlockRenderProps<LogoCloudProps>) {
  const headingId = `${node.id}-heading`;
  /* Each inner element is a part: addressable on the canvas, stylable per part. */
  const part = blockPartProps({ node, props, isCanvas }, logoCloudSchema.parts);
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
          {props.body === undefined ? null : (
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
          )}
        </div>
        <ul
          {...part('items', {
            className: cx(
              'm-0 grid w-full list-none p-0',
              COLUMN_CLASSES[props.columns],
              props.variant === 'framed'
                ? 'gap-2 rounded-xl border border-current/10 bg-current/5 p-2 shadow-soft'
                : 'gap-4',
            ),
          })}
          data-logo-cloud-grid=""
        >
          {props.items.map((item, index) => {
            const at = [index];
            const monogram = monogramOf(item.name);

            return (
              /* Keyed by position: a bound value may be an inline editor element. */
              <li
                key={index}
                {...part('item', {
                  index: at,
                  className: cx(
                    'flex min-h-20 min-w-0 items-center gap-gap-sm',
                    ITEM_CLASSES[props.variant],
                  ),
                })}
                data-logo-cloud-item=""
              >
                {item.logo === undefined ? (
                  <span
                    aria-hidden="true"
                    className="grid size-10 shrink-0 place-items-center rounded-xl border border-accent/15 bg-accent/10 text-sm font-bold text-accent @md:size-12"
                  >
                    {monogram}
                  </span>
                ) : (
                  /* The name is the visible text beside it, so the logo is decorative (alt=''). */
                  <img
                    {...part('item.logo', {
                      index: at,
                      className: 'size-10 shrink-0 object-contain @md:size-12',
                    })}
                    src={item.logo}
                    alt=""
                    width={48}
                    height={48}
                    loading="lazy"
                    decoding="async"
                    data-logo-cloud-logo=""
                  />
                )}
                <span className="flex min-w-0 flex-col text-start">
                  <span
                    {...part('item.name', {
                      index: at,
                      className:
                        'break-words text-base leading-tight font-bold tracking-tight @md:text-lg',
                    })}
                  >
                    {item.name}
                  </span>
                  {item.descriptor === undefined ? null : (
                    <span
                      {...part('item.descriptor', {
                        index: at,
                        className: cx(
                          'break-words text-xs leading-snug',
                          props.variant === 'minimal' && props.tone === 'dark'
                            ? 'text-inherit opacity-70'
                            : 'text-text-muted',
                        ),
                      })}
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
