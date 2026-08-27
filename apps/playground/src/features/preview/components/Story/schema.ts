import { z } from 'zod';

import { defineBlockSchema, emptyRichText, richText } from '@craftkit/builder';

/**
 * The B3c inline-editing demo block: a prose passage whose rich content is
 * declared inline-editable. Declaration is DATA on the schema — the canvas
 * resolves the contributed rich editor lazily; this package never touches an
 * editing engine.
 */
export const storySchema = defineBlockSchema({
  type: 'story',
  description: 'A short story passage edited in place with the formatting bubble.',
  props: z.object({
    content: richText().default(emptyRichText() as never),
  }),
  // B3c: the content IS this block's text, so it edits in place on the canvas.
  inlineEditable: 'content',
  examples: [
    {
      prompt: 'فقرة قصصية قصيرة تُحرَّر في مكانها',
      node: { type: 'story', props: {} },
    },
  ],
});

export type StoryProps = z.output<typeof storySchema.props>;
