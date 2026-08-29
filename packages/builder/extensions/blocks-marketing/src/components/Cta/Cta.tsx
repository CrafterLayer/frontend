import '../section-layout.css';
import './Cta.css';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import { sectionColorStyle } from '../section-color';
import { sectionSpacingStyle } from '../section-spacing';
import { sectionTypographyClasses } from '../section-typography';

import type { CtaProps } from './schema';

/** A real button element — keyboard-reachable and labelled by its content. */
export function Cta({ props }: BlockRenderProps<CtaProps>) {
  const typographyClassName = sectionTypographyClasses(props);
  const className = ['mkt-cta', `mkt-cta--${props.width}`, typographyClassName]
    .filter(Boolean)
    .join(' ');
  const colorStyle = sectionColorStyle(props);
  const spacingStyle = sectionSpacingStyle(props);
  const style =
    colorStyle === undefined && spacingStyle === undefined
      ? undefined
      : { ...colorStyle, ...spacingStyle };

  return (
    <span className={className} style={style}>
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
