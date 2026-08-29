import '../section-layout.css';
import './Grid.css';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import { sectionColorStyle } from '../section-color';
import { sectionSpacingStyle } from '../section-spacing';

import type { GridProps } from './schema';

/** A container that lays its slot children out on a responsive CSS grid. */
export function Grid({ node, props, slots }: BlockRenderProps<GridProps>) {
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
  ].join(' ');
  const colorStyle = sectionColorStyle(props);
  const spacingStyle = sectionSpacingStyle(props);
  const style =
    colorStyle === undefined && spacingStyle === undefined
      ? undefined
      : { ...colorStyle, ...spacingStyle };

  return (
    <div className={className} data-bldr-grid={node.id} style={style}>
      <div className={`mkt-section__content mkt-section__content--width-${props.width}`}>
        {slots['default']}
      </div>
    </div>
  );
}
