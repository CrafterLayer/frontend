import { z } from 'zod';

import { defineBlockSchema } from '@craftkit/builder-schema';

import { heroExamples } from './examples';

export const heroSchema = defineBlockSchema({
  type: 'hero',
  description:
    'Opening section at the top of a page: a large heading, optional supporting body, and up to two call-to-action buttons. Use once per page.',
  surfaces: ['site', 'store'],
  props: z.object({
    tone: z.enum(['light', 'dark']).default('light'),
    align: z.enum(['start', 'center']).default('center'),
    heading: z.string().min(1).max(80).default('Your headline'),
    body: z.string().max(200).optional(),
  }),
  inlineEditable: 'heading',
  slots: { actions: { allow: ['cta'], max: 2 } },
  examples: heroExamples,
});

export type HeroProps = z.output<typeof heroSchema.props>;
