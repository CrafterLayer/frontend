import { z } from 'zod';

import { defineBlockSchema, emptyRichText, richText } from '@craftkit/builder-schema';

import { richTextBlockExamples } from './examples';

export const richTextBlockSchema = defineBlockSchema({
  type: 'richText',
  description:
    'Free-form rich text: headings, bold and italic, links, and lists. The block for prose ' +
    'sections that plain single-line text properties cannot express.',
  surfaces: ['site', 'store'],
  props: z.object({
    content: richText().default(emptyRichText() as never),
  }),
  examples: richTextBlockExamples,
});

export type RichTextBlockProps = z.output<typeof richTextBlockSchema.props>;
