import '../section-layout.css';
import './PageFooter.css';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import { sectionColorStyle } from '../section-color';
import { sectionMotionAttributes } from '../section-motion';

import type { PageFooterProps } from './schema';

/*
  Empty slots are the RENDERER's affordance, not each block's.

  A block used to render its own "drop here" hint when a slot came through
  empty. That stopped being possible the moment the renderer began wrapping
  every slot so the drop resolver could measure it: the slot is now always a
  single wrapper element, never undefined, so the branch could not fire. It also
  should not — one dashed, labelled, measurable box emitted in one place beats
  the same idea re-implemented per block and drifting.
*/

/** A two-slot page footer whose children remain fully author-composable. */
export function PageFooter({ props, slots }: BlockRenderProps<PageFooterProps>) {
  const body = slots['default'];
  const bottom = slots['bottom'];

  /*
    Motion arrives as ATTRIBUTES, never as inline style: the stylesheet stays
    the one place any timing lives, so a document carries a named step and never
    a duration. `class` is pulled out because React spells it `className`.
  */
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);
  const className = [
    'mkt-section',
    'mkt-footer',
    `mkt-footer--layout-${props.layout}`,
    `mkt-footer--border-${props.border}`,
    `mkt-section--tone-${props.tone}`,
    `mkt-section--spacing-${props.spacing}`,
    motionClassName ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <footer className={className} style={sectionColorStyle(props)} {...motionData}>
      <div
        className={`mkt-section__content mkt-section__content--width-${props.width} mkt-section__content--align-${props.align} mkt-footer__content`}
      >
        <div className="mkt-footer__body">
          <div
            className="mkt-footer__slot mkt-footer__slot--default"
            data-page-footer-slot="default"
          >
            {body}
          </div>

          {props.bottomBar ? null : (
            <div
              className="mkt-footer__slot mkt-footer__slot--bottom"
              data-page-footer-slot="bottom"
            >
              {bottom}
            </div>
          )}
        </div>

        {props.bottomBar ? (
          <div className="mkt-footer__bottom">
            <div
              className="mkt-footer__slot mkt-footer__slot--bottom"
              data-page-footer-slot="bottom"
            >
              {bottom}
            </div>
          </div>
        ) : null}
      </div>
    </footer>
  );
}
