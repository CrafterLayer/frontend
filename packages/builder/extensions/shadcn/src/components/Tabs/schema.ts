import { z } from 'zod';

import {
  defineBlockSchema,
  findRejectedUtilities,
  motionSpecSchema,
} from '@craftkit/builder-schema';

import { tabsExamples } from './examples';

export const tabsSchema = defineBlockSchema({
  type: 'tabs',
  description:
    'A row of tabs over swappable panels. Add tabPanel blocks inside it; each panel owns its own label and can hold any content. Built on Radix, adapted from shadcn/ui.',
  surfaces: ['site', 'store'],
  props: z.object({
    align: z.enum(['start', 'center', 'end']).default('start'),
    motion: motionSpecSchema.optional(),
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
    align: { tab: 'design', section: 'Tabs' },
    motion: { tab: 'design', section: 'Motion', kind: 'motion' },
    className: { tab: 'advanced', section: 'Custom classes', kind: 'utility-classes' },
  },
  /*
    Panels only. A tab strip whose children are arbitrary blocks has no labels
    to build triggers from, so the constraint is what makes the block work
    rather than a restriction on it.
  */
  slots: { default: { allow: ['tabPanel'] } },
  examples: tabsExamples,
});

export type TabsProps = z.output<typeof tabsSchema.props>;
