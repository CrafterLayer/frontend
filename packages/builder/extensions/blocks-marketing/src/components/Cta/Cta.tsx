import '../section-layout.css';
import './Cta.css';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import { sectionColorStyle } from '../section-color';
import { sectionMotionAttributes } from '../section-motion';
import { sectionSpacingStyle } from '../section-spacing';
import { sectionTypographyClasses } from '../section-typography';

import type { CtaProps } from './schema';

/** A real button element — keyboard-reachable and labelled by its content. */
export function Cta({ props }: BlockRenderProps<CtaProps>) {
  const typographyClassName = sectionTypographyClasses(props);
  /*
    Motion arrives as ATTRIBUTES, never as inline style: the stylesheet stays
    the one place any timing lives, so a document carries a named step and never
    a duration. `class` is pulled out because React spells it `className`.
  */
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);
  const className = ['mkt-cta', `mkt-cta--${props.width}`, typographyClassName, motionClassName]
    .filter(Boolean)
    .join(' ');
  const colorStyle = sectionColorStyle(props);
  const spacingStyle = sectionSpacingStyle(props);
  const style =
    colorStyle === undefined && spacingStyle === undefined
      ? undefined
      : { ...colorStyle, ...spacingStyle };

  return (
    <span className={className} style={style} {...motionData}>
      <button
        type="button"
        className={`mkt-cta__button mkt-cta__button--${props.emphasis} mkt-cta__button--${props.size}`}
      >
        {props.label}
      </button>
      {props.note === undefined ? null : <small className="mkt-cta__note">{props.note}</small>}
    </span>
  );
}
