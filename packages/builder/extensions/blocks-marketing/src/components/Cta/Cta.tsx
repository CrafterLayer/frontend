import './Cta.css';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import type { CtaProps } from './schema';

/** A real button element — keyboard-reachable and labelled by its content. */
export function Cta({ props }: BlockRenderProps<CtaProps>) {
  return (
    <span className="mkt-cta">
      <button type="button" className={`mkt-cta__button mkt-cta__button--${props.emphasis}`}>
        {props.label}
      </button>
      {props.note === undefined ? null : <small className="mkt-cta__note">{props.note}</small>}
    </span>
  );
}
