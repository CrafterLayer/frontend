import { z } from 'zod';

import { defineBlockSchema } from '@craftkit/builder-schema';

import { testimonialsExamples } from './examples';

export const testimonialsSchema = defineBlockSchema({
  type: 'testimonials',
  description:
    'Customer quotes with author names and optional roles, presented as cards under a section heading.',
  surfaces: ['site', 'store'],
  props: z.object({
    heading: z.string().min(1).max(80).default('Loved by teams'),
    items: z
      .array(
        z.object({
          quote: z.string().min(1).max(240),
          author: z.string().min(1).max(60),
          role: z.string().max(60).optional(),
        }),
      )
      .max(6)
      .default([]),
  }),
  examples: testimonialsExamples,
});

export type TestimonialsProps = z.output<typeof testimonialsSchema.props>;
