import '../section-layout.css';

import { isValidElement } from 'react';

import type { BlockRenderProps } from '@craftkit/builder-schema';
import { RichText } from '@craftkit/builder-renderer';

import { cx, sectionContentClasses } from '../section-classes';
import { sectionColorStyle } from '../section-color';
import { sectionMotionAttributes } from '../section-motion-attributes';
import { sectionSpacingStyle } from '../section-spacing';
import { sectionTypographyClasses } from '../section-typography';

import type { RichTextBlockProps } from './schema';

/**
 * Prose through the zero-dependency read path: stored JSON renders through the
 * renderer's RichText. An inline editor element is rendered directly at the
 * edit boundary so reading and static output remain untouched.
 */
export function RichTextBlock({ props }: BlockRenderProps<RichTextBlockProps>) {
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);
  const colorStyle = sectionColorStyle(props);
  const spacingStyle = sectionSpacingStyle(props);
  const style =
    colorStyle === undefined && spacingStyle === undefined
      ? undefined
      : { ...colorStyle, ...spacingStyle };

  return (
    <section
      className={cx(
        sectionContentClasses('narrow', undefined, props.gutter),
        'py-section-sm',
        sectionTypographyClasses(props),
        motionClassName,
        props.className,
      )}
      style={style}
      {...motionData}
    >
      {isValidElement(props.content) ? props.content : <RichText value={props.content} />}
    </section>
  );
}
