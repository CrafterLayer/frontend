import '../section-layout.css';
import './Stack.css';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import { sectionColorStyle } from '../section-color';
import { sectionMotionAttributes } from '../section-motion';
import { sectionSpacingStyle } from '../section-spacing';

import type { StackProps } from './schema';

/**
 * The layout container: a row or a column that holds other blocks.
 *
 * Every marketing block before this one was a LEAF — it drew its own content
 * and accepted no children — so a two-column feature area could not be composed
 * at all. The kernel has carried a slots map since B0; this is the first block
 * to use it for arbitrary composition.
 *
 * Nothing here is a physical direction. `row` means "along the reading axis",
 * so the same document lays out correctly in Arabic and in English without a
 * second set of properties, and `justify`/`align` name the axes rather than the
 * sides.
 */
export function Stack({ node, props, slots }: BlockRenderProps<StackProps>) {
  /*
    Motion arrives as ATTRIBUTES, never as inline style: the stylesheet stays
    the one place any timing lives, so a document carries a named step and never
    a duration. `class` is pulled out because React spells it `className`.
  */
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);
  const className = [
    'mkt-section',
    'mkt-stack',
    `mkt-section--tone-${props.tone}`,
    `mkt-section--spacing-${props.spacing}`,
    `mkt-stack--direction-${props.direction}`,
    `mkt-stack--justify-${props.justify}`,
    `mkt-stack--align-${props.align}`,
    `mkt-stack--gap-${props.gap}`,
    `mkt-stack--wrap-${props.wrap}`,
    motionClassName ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const children = slots['default'];
  const colorStyle = sectionColorStyle(props);
  const spacingStyle = sectionSpacingStyle(props);
  const style =
    colorStyle === undefined && spacingStyle === undefined
      ? undefined
      : { ...colorStyle, ...spacingStyle };

  return (
    <div className={className} data-bldr-stack={node.id} style={style} {...motionData}>
      <div className={`mkt-section__content mkt-section__content--width-${props.width}`}>
        {children}
      </div>
    </div>
  );
}
