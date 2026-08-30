import '../section-layout.css';
import './Grid.css';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import { sectionColorStyle } from '../section-color';
import { sectionMotionAttributes } from '../section-motion';
import { sectionSpacingStyle } from '../section-spacing';

import type { GridProps } from './schema';

/** A container that lays its slot children out on a responsive CSS grid. */
export function Grid({ node, props, slots }: BlockRenderProps<GridProps>) {
  /*
    Motion arrives as ATTRIBUTES, never as inline style: the stylesheet stays
    the one place any timing lives, so a document carries a named step and never
    a duration. `class` is pulled out because React spells it `className`.
  */
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);
  const className = [
    'mkt-section',
    'mkt-grid',
    `mkt-section--tone-${props.tone}`,
    `mkt-section--spacing-${props.spacing}`,
    `mkt-grid--columns-${props.columns}`,
    `mkt-grid--gap-${props.gap}`,
    `mkt-grid--align-${props.align}`,
    `mkt-grid--justify-${props.justify}`,
    `mkt-grid--flow-${props.flow}`,
    motionClassName ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  const colorStyle = sectionColorStyle(props);
  const spacingStyle = sectionSpacingStyle(props);
  const style =
    colorStyle === undefined && spacingStyle === undefined
      ? undefined
      : { ...colorStyle, ...spacingStyle };

  return (
    <div className={className} data-bldr-grid={node.id} style={style} {...motionData}>
      <div className={`mkt-section__content mkt-section__content--width-${props.width}`}>
        {slots['default']}
      </div>
    </div>
  );
}
