import './RichTextBlock.css';

import { isValidElement } from 'react';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import { sectionColorStyle } from '../section-color';
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
  return (
    <section className="mkt-richtext" style={sectionColorStyle(props)}>
      {isValidElement(props.content) ? props.content : <RichText value={props.content} />}
    </section>
  );
}
