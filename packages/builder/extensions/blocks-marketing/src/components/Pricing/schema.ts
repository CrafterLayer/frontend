import { z } from 'zod';

import { defineBlockSchema } from '@craftkit/builder-schema';

import { pricingExamples } from './examples';

export const pricingSchema = defineBlockSchema({
  type: 'pricing',
  description:
    'Pricing plans side by side: each plan has a name, price text, billing period, a feature list, and may be highlighted as recommended.',
  surfaces: ['site', 'store'],
  props: z.object({
    heading: z.string().min(1).max(80).default('Pricing'),
    plans: z
      .array(
        z.object({
          name: z.string().min(1).max(40),
          price: z.string().min(1).max(20),
          period: z.enum(['month', 'year']),
          features: z.array(z.string().min(1).max(80)).max(8),
          highlighted: z.boolean().optional(),
        }),
      )
      .max(4)
      .default([]),
  }),
  examples: pricingExamples,
});

export type PricingProps = z.output<typeof pricingSchema.props>;
