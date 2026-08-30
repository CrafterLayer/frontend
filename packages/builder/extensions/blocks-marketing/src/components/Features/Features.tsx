import '../section-layout.css';
import './Features.css';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import { sectionColorStyle } from '../section-color';
import { sectionMotionAttributes } from '../section-motion';
import { sectionSpacingStyle } from '../section-spacing';
import { sectionTypographyClasses } from '../section-typography';

import type { FeaturesProps } from './schema';

/** Feature cards from document data — a labelled section over a semantic list. */
export function Features({ node, props }: BlockRenderProps<FeaturesProps>) {
  // The accessible name comes from the VISIBLE heading, never a copy of
  // its text: inline editing swaps that property for an editor element, and
  // an element in aria-label stringifies to "[object Object]" (009 §12).
  const headingId = `${node.id}-heading`;
  const typographyClassName = sectionTypographyClasses(props);
  /*
    Motion arrives as ATTRIBUTES, never as inline style: the stylesheet stays
    the one place any timing lives, so a document carries a named step and never
    a duration. `class` is pulled out because React spells it `className`.
  */
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);
  const rootClassName = [
    `mkt-section mkt-features mkt-section--tone-${props.tone} mkt-section--spacing-${props.spacing}`,
    typographyClassName,
    motionClassName ?? '',
  ]
    .filter((className) => className !== '')
    .join(' ');
  const colorStyle = sectionColorStyle(props);
  const spacingStyle = sectionSpacingStyle(props);
  const rootStyle =
    colorStyle === undefined && spacingStyle === undefined
      ? undefined
      : { ...colorStyle, ...spacingStyle };
  return (
    <section
      className={rootClassName}
      {...motionData}
      style={rootStyle}
      aria-labelledby={headingId}
    >
      <div
        className={`mkt-section__content mkt-features__content mkt-section__content--align-${props.align} mkt-section__content--width-${props.width}`}
      >
        <h2 id={headingId} className="mkt-features__heading">
          {props.heading}
        </h2>
        {props.body === undefined ? null : (
          <p className="mkt-section__intro mkt-features__intro">{props.body}</p>
        )}
        <ul className={`mkt-features__grid mkt-features__grid--${props.columns}`}>
          {props.items.map((item) => (
            <li key={item.title} className="mkt-features__card">
              <h3 className="mkt-features__title">{item.title}</h3>
              <p className="mkt-features__body">{item.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
