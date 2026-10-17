import './Story.css';

import { isValidElement } from 'react';

import { RichText, type BlockRenderProps } from '@craftkit/builder';

import type { StoryProps } from './schema';

/**
 * The B3c inline-editing demo block: prose through the zero-dependency read
 * path. While the canvas edits the content in place it SWAPS the prop for the
 * live editor element — rendering the prop as a child is what makes the edit
 * appear exactly where the text lives.
 */
export function Story({ props }: BlockRenderProps<StoryProps>) {
  return (
    <section className="pg-story">
      {isValidElement(props.content) ? props.content : <RichText value={props.content} />}
    </section>
  );
}
