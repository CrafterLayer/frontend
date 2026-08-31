import '../section-layout.css';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import { GAP_CLASSES, cx, sectionContentClasses, sectionShellClasses } from '../section-classes';
import { sectionColorStyle } from '../section-color';
import { sectionMotionAttributes } from '../section-motion';
import { sectionSpacingStyle } from '../section-spacing';
import { sectionTypographyClasses } from '../section-typography';

import type { AnnouncementBarProps } from './schema';

const EMPHASIS_CLASSES: Readonly<Record<AnnouncementBarProps['emphasis'], string>> = {
  subtle: 'border-y border-text/10 bg-surface text-text',
  accent: 'border-y border-accent/20 bg-accent text-accent-text shadow-soft',
  inverse: 'border-y border-text-inverse/10 bg-surface-inverse text-text-inverse',
};

const DENSITY_CLASSES: Readonly<Record<AnnouncementBarProps['density'], string>> = {
  compact: 'py-3',
  regular: 'py-4',
};

const LAYOUT_CLASSES: Readonly<Record<AnnouncementBarProps['layout'], string>> = {
  inline: 'items-center justify-center text-center',
  split: 'items-stretch justify-between text-start @sm:items-center',
};

/** A concise, semantic announcement with an optional destination link. */
export function AnnouncementBar({ node, props }: BlockRenderProps<AnnouncementBarProps>) {
  const messageId = `${node.id}-message`;
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);
  const colorStyle = sectionColorStyle(props);
  const spacingStyle = sectionSpacingStyle(props);
  const style =
    colorStyle === undefined && spacingStyle === undefined
      ? undefined
      : { ...colorStyle, ...spacingStyle };

  return (
    <aside
      className={cx(
        sectionShellClasses(props.tone, props.spacing),
        '@container relative overflow-hidden border-0 border-solid',
        EMPHASIS_CLASSES[props.emphasis],
        sectionTypographyClasses(props),
        motionClassName,
        props.className,
      )}
      {...motionData}
      style={style}
      aria-labelledby={messageId}
    >
      <div
        className={cx(
          sectionContentClasses(props.width, props.align, props.gutter),
          'flex flex-col @sm:flex-row',
          DENSITY_CLASSES[props.density],
          GAP_CLASSES.sm,
          LAYOUT_CLASSES[props.layout],
        )}
        data-announcement-content=""
      >
        <div className="flex min-w-0 items-center justify-center gap-3 @sm:justify-start">
          {props.showLabel ? (
            <span
              className="shrink-0 rounded-full border border-current/20 bg-current/10 px-3 py-1 text-xs font-bold uppercase tracking-wide"
              data-announcement-label=""
            >
              {props.label}
            </span>
          ) : null}
          <span id={messageId} className="text-sm font-semibold text-balance @sm:text-base">
            {props.message}
          </span>
        </div>
        {props.showLink ? (
          <a
            className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-current/20 px-3 py-1 text-sm font-bold text-inherit transition-colors duration-200 hover:bg-current/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current motion-reduce:transition-none"
            href={props.href}
          >
            {props.linkLabel}
            <span
              aria-hidden="true"
              className="transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none rtl:group-hover:-translate-x-1"
            >
              →
            </span>
          </a>
        ) : null}
      </div>
    </aside>
  );
}
