import { z } from 'zod';

import { defineBlockSchema, emptyRichText, richText } from '@craftkit/builder-schema';

import { sectionColorGroups, sectionColorProps } from '../section-color';
import { richTextBlockExamples } from './examples';

export const richTextBlockSchema = defineBlockSchema({
  type: 'richText',
  description:
    'Free-form rich text: headings, bold and italic, links, and lists. The block for prose ' +
    'sections that plain single-line text properties cannot express.',
  surfaces: ['site', 'store'],
  props: z.object({
    content: richText().default(emptyRichText() as never),
    ...sectionColorProps,
  }),
  /*
    The prose block's only non-content properties are its colours, so this is
    the whole of its Design tab. `content` stays out of the groups deliberately:
    it is edited on the canvas, not in a row.
  */
  propertyGroups: { ...sectionColorGroups },
  inlineEditable: 'content',
  examples: richTextBlockExamples,
});

export type RichTextBlockProps = z.output<typeof richTextBlockSchema.props>;
