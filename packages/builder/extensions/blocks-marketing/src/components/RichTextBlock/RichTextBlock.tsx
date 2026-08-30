import '../section-layout.css';
import './RichTextBlock.css';

import { isValidElement } from 'react';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import { sectionColorStyle } from '../section-color';
import { sectionMotionAttributes } from '../section-motion';
import { sectionSpacingStyle } from '../section-spacing';
import { sectionTypographyClasses } from '../section-typography';
import { RichText } from '@craftkit/builder-renderer';

import type { RichTextBlockProps } from './schema';

/**
 * Prose through the ZERO-DEPENDENCY read path (008 contract §4): the stored
 * JSON renders via the renderer's RichText — the editing engine never loads
 * here, on the canvas, in preview, or in static output.
 *
 * The one exception is the EDIT BOUNDARY (009 §12). This block declares
 * `content` inline-editable, and in edit mode the canvas replaces that value
 * with the editor's own element. `RichText` reads a stored document, not an
 * element, so the element is rendered directly — which is also what puts the
 * editor exactly where the prose is drawn. Reading mode is untouched.
 */
export function RichTextBlock({ props }: BlockRenderProps<RichTextBlockProps>) {
  const typographyClassName = sectionTypographyClasses(props);
  /*
    Motion arrives as ATTRIBUTES, never as inline style: the stylesheet stays
    the one place any timing lives, so a document carries a named step and never
    a duration. `class` is pulled out because React spells it `className`.
  */
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);
  const className = ['mkt-richtext', typographyClassName, motionClassName]
    .filter(Boolean)
    .join(' ');
  const colorStyle = sectionColorStyle(props);
  const spacingStyle = sectionSpacingStyle(props);
  const style =
    colorStyle === undefined && spacingStyle === undefined
      ? undefined
      : { ...colorStyle, ...spacingStyle };

  return (
    <section className={className} style={style} {...motionData}>
      {isValidElement(props.content) ? props.content : <RichText value={props.content} />}
    </section>
  );
}
