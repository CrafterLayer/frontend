import '../section-layout.css';
import './Stack.css';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import { sectionColorStyle } from '../section-color';

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
  ].join(' ');

  const children = slots['default'];

  return (
    <div className={className} data-bldr-stack={node.id} style={sectionColorStyle(props)}>
      <div className={`mkt-section__content mkt-section__content--width-${props.width}`}>
        {children}
      </div>
    </div>
  );
}
