import '../section-layout.css';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import { cx } from '../section-classes';
import { sectionColorStyle } from '../section-color';
import { sectionMotionAttributes } from '../section-motion';
import { sectionSpacingStyle } from '../section-spacing';
import { sectionTypographyClasses } from '../section-typography';

import type { CtaProps } from './schema';

const ROOT_WIDTH_CLASSES: Record<CtaProps['width'], string> = {
  fit: 'inline-flex',
  full: 'flex w-full',
};

const BUTTON_WIDTH_CLASSES: Record<CtaProps['width'], string | undefined> = {
  fit: undefined,
  full: 'w-full',
};

const EMPHASIS_CLASSES: Record<CtaProps['emphasis'], string> = {
  primary: 'border-accent bg-accent text-accent-text shadow-soft hover:shadow-strong',
  secondary: 'border-text/15 bg-surface text-text shadow-soft hover:border-accent/40',
  ghost: 'border-accent/40 bg-transparent text-accent hover:bg-accent/10',
  link: 'border-transparent bg-transparent px-0 text-accent underline-offset-4 hover:underline',
};

const SIZE_CLASSES: Record<CtaProps['size'], string> = {
  sm: 'px-control-inline-sm py-control-block-sm text-sm',
  md: 'px-control-inline-md py-control-block-md text-base',
  lg: 'px-control-inline-lg py-control-block-lg text-lg',
};

/** A real button element — keyboard-reachable and labelled by its content. */
export function Cta({ props }: BlockRenderProps<CtaProps>) {
  /* Motion arrives as attributes; `class` is pulled out because React spells it `className`. */
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);
  const colorStyle = sectionColorStyle(props);
  const spacingStyle = sectionSpacingStyle(props);
  const style =
    colorStyle === undefined && spacingStyle === undefined
      ? undefined
      : { ...colorStyle, ...spacingStyle };
  const controlClasses = cx(
    'inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border font-semibold transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
    EMPHASIS_CLASSES[props.emphasis],
    SIZE_CLASSES[props.size],
    BUTTON_WIDTH_CLASSES[props.width],
  );
  const label = (
    <>
      <span>{props.label}</span>
      {props.emphasis === 'link' ? (
        <span aria-hidden="true" className="text-lg leading-none">
          ↗
        </span>
      ) : null}
    </>
  );

  return (
    <span
      className={cx(
        'flex-col gap-gap-xs',
        ROOT_WIDTH_CLASSES[props.width],
        sectionTypographyClasses(props),
        motionClassName,
        props.className,
      )}
      data-cta-root=""
      style={style}
      {...motionData}
    >
      {props.href === undefined ? (
        <button type="button" className={controlClasses}>
          {label}
        </button>
      ) : (
        <a
          href={props.href}
          className={controlClasses}
          target={props.newTab ? '_blank' : undefined}
          rel={props.newTab ? 'noreferrer' : undefined}
        >
          {label}
        </a>
      )}
      {props.note === undefined ? null : (
        <small className="text-start text-text-muted">{props.note}</small>
      )}
    </span>
  );
}
