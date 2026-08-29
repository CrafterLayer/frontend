import './Cta.css';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import { sectionColorStyle } from '../section-color';

import type { CtaProps } from './schema';

/** A real button element — keyboard-reachable and labelled by its content. */
export function Cta({ props }: BlockRenderProps<CtaProps>) {
  return (
    <span className={`mkt-cta mkt-cta--${props.width}`}>
      <button
        type="button"
        className={`mkt-cta__button mkt-cta__button--${props.emphasis} mkt-cta__button--${props.size}`}
        style={sectionColorStyle(props)}
      >
        {props.label}
      </button>
      {props.note === undefined ? null : <small className="mkt-cta__note">{props.note}</small>}
    </span>
  );
}
