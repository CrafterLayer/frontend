import { z } from 'zod';

import { defineBlockSchema } from '@craftkit/builder-schema';

import { featuresExamples } from './examples';

export const featuresSchema = defineBlockSchema({
  type: 'features',
  description:
    'A grid of product feature cards, each with a short title and one-sentence body. Two or three columns.',
  surfaces: ['site', 'store'],
  props: z.object({
    heading: z.string().min(1).max(80).default('Features'),
    columns: z.enum(['2', '3']).default('3'),
    items: z
      .array(
        z.object({
          title: z.string().min(1).max(60),
          body: z.string().min(1).max(160),
        }),
      )
      .default([]),
  }),
  inlineEditable: 'heading',
  examples: featuresExamples,
});

export type FeaturesProps = z.output<typeof featuresSchema.props>;
