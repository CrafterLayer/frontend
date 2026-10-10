import type { BlockRenderProps } from '@craftkit/builder-schema';

import {
  ALIGN_CLASSES,
  DIRECTION_CLASSES,
  GAP_CLASSES,
  JUSTIFY_CLASSES,
  WRAP_CLASSES,
  cx,
  sectionContentClasses,
  sectionShellClasses,
} from '../section-classes';
import { sectionColorStyle } from '../section-color';
import { sectionMotionAttributes } from '../section-motion-attributes';
import { sectionSpacingStyle } from '../section-spacing';

import type { StackProps } from './schema';

/**
 * The layout container: a row or a column that holds other blocks.
 * `row` follows the reading axis, so the same document works in RTL and LTR.
 */
export function Stack({ node, props, slots }: BlockRenderProps<StackProps>) {
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
        motionClassName,
        props.className,
      )}
      data-bldr-stack={node.id}
      style={style}
      {...motionData}
    >
      <div
        className={cx(
          sectionContentClasses(props.width, undefined, props.gutter),
          'flex',
          DIRECTION_CLASSES[props.direction],
          JUSTIFY_CLASSES[props.justify],
          ALIGN_CLASSES[props.align],
          GAP_CLASSES[props.gap],
          WRAP_CLASSES[props.wrap],
          props.direction === 'row' ? '*:min-w-0 *:flex-1' : undefined,
          // The canvas slot is display:contents, but CSS child selectors still
          // see it. Apply the same layout to its real, measurable node wrappers.
          props.direction === 'row'
            ? '[&>[data-bldr-slot]>[data-bldr-node]]:min-w-0 [&>[data-bldr-slot]>[data-bldr-node]]:flex-1'
            : '[&>[data-bldr-slot]>[data-bldr-node]]:w-full [&>[data-bldr-slot]>[data-bldr-node]]:min-w-0',
        )}
      >
        {slots['default']}
      </div>
    </div>
  );
}
