import { z } from 'zod';

import { defineBlockSchema, findRejectedUtilities } from '@craftkit/builder-schema';

import { badgeExamples } from './examples';

export const badgeSchema = defineBlockSchema({
  type: 'badge',
  description:
    'A small label: "New", "Most popular", "Beta". Sits beside a heading or inside a card. Adapted from shadcn/ui.',
  surfaces: ['site', 'store'],
  props: z.object({
    /*
      Short by contract. A badge is read at a glance, and one that wraps to two
      lines has stopped being a badge — 32 characters is roughly where that
      happens at every size this offers.
    */
    label: z.string().min(1).max(32).default('New'),
    variant: z.enum(['accent', 'success', 'neutral', 'outline']).default('accent'),
    size: z.enum(['small', 'regular']).default('regular'),
    className: z
      .string()
      .max(400)
      .refine((value) => findRejectedUtilities(value).length === 0, {
        error: (issue) =>
          findRejectedUtilities(String(issue.input))
            .map((rejection) => rejection.message)
            .join(' '),
      })
      .optional(),
  }),
  propertyGroups: {
    label: { tab: 'content' },
    variant: { tab: 'design', section: 'Badge' },
    size: { tab: 'design', section: 'Badge' },
    className: { tab: 'advanced', section: 'Custom classes', kind: 'utility-classes' },
  },
  /* `label` is the visible text, so it edits in place on the canvas. */
  inlineEditable: 'label',
  examples: badgeExamples,
});

export type BadgeProps = z.output<typeof badgeSchema.props>;
