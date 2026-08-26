import { z } from 'zod';

import { defineBlockSchema } from '@craftkit/builder-schema';

import { ctaExamples } from './examples';

export const ctaSchema = defineBlockSchema({
  type: 'cta',
  description:
    'A call-to-action button with a short label and an emphasis level; optionally a small supporting note underneath. Used standalone or inside hero actions.',
  surfaces: ['site', 'store'],
  props: z.object({
    label: z.string().min(1).max(40).default('Get started'),
    emphasis: z.enum(['primary', 'ghost']).default('primary'),
    note: z.string().max(80).optional(),
  }),
  examples: ctaExamples,
});

export type CtaProps = z.output<typeof ctaSchema.props>;
