import type { BlockRenderProps } from '@craftkit/builder-schema';

import {
  ALIGN_CLASSES,
  GAP_CLASSES,
  cx,
  sectionContentClasses,
  sectionShellClasses,
} from '../section-classes';
import { sectionColorStyle } from '../section-color';
import { sectionMotionAttributes } from '../section-motion-attributes';
import { sectionSpacingStyle } from '../section-spacing';

import type { GridProps } from './schema';

const COLUMN_CLASSES: Record<GridProps['columns'], string> = {
  '1': 'grid-cols-1',
  '2': 'grid-cols-1 @sm:grid-cols-2',
  '3': 'grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-3',
  '4': 'grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-3 @xl:grid-cols-4',
  '6': 'grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-3 @2xl:grid-cols-6',
};

const GRID_JUSTIFY_CLASSES: Record<GridProps['justify'], string> = {
  start: 'justify-items-start',
  center: 'justify-items-center',
  end: 'justify-items-end',
};

const FLOW_CLASSES: Record<GridProps['flow'], string> = {
  row: 'grid-flow-row',
  dense: 'grid-flow-dense',
};

/** A container that lays its slot children out on a responsive CSS grid. */
export function Grid({ node, props, slots }: BlockRenderProps<GridProps>) {
  /* Motion arrives as attributes; `class` is pulled out because React spells it `className`. */
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);
  const colorStyle = sectionColorStyle(props);
  const spacingStyle = sectionSpacingStyle(props);
  const style =
    colorStyle === undefined && spacingStyle === undefined
      ? undefined
      : { ...colorStyle, ...spacingStyle };

  return (
    <div
      className={cx(
        sectionShellClasses(props.tone, props.spacing),
        '@container',
        motionClassName,
        props.className,
      )}
      data-bldr-grid={node.id}
      style={style}
      {...motionData}
    >
      <div
        className={cx(
          sectionContentClasses(props.width, undefined, props.gutter),
          'grid *:min-w-0',
          COLUMN_CLASSES[props.columns],
          GAP_CLASSES[props.gap],
          ALIGN_CLASSES[props.align],
          GRID_JUSTIFY_CLASSES[props.justify],
          FLOW_CLASSES[props.flow],
        )}
      >
        {slots['default']}
      </div>
    </div>
  );
}
