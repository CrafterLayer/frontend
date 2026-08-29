import '../section-layout.css';
import './Grid.css';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import { sectionColorStyle } from '../section-color';

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

  return (
    <div className={className} data-bldr-grid={node.id} style={sectionColorStyle(props)}>
      <div className={`mkt-section__content mkt-section__content--width-${props.width}`}>
        {slots['default']}
      </div>
    </div>
  );
}
