import './RichTextBlock.css';

import type { BlockRenderProps } from '@craftkit/builder-schema';
import { RichText } from '@craftkit/builder-renderer';

import type { RichTextBlockProps } from './schema';

/**
 * Prose through the ZERO-DEPENDENCY read path (008 contract §4): the stored
 * JSON renders via the renderer's RichText — the editing engine never loads
 * here, on the canvas, in preview, or in static output.
 */
export function RichTextBlock({ props }: BlockRenderProps<RichTextBlockProps>) {
  return (
    <section className="mkt-richtext">
      <RichText value={props.content} />
    </section>
  );
}
