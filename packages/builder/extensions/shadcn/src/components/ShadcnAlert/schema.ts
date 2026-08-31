import { z } from 'zod';

import {
  defineBlockSchema,
  findRejectedUtilities,
  motionSpecSchema,
} from '@craftkit/builder-schema';

import { shadcnAlertExamples } from './examples';

export const shadcnAlertSchema = defineBlockSchema({
  type: 'shadcnAlert',
  description:
    'A callout that says something the reader needs to notice. The body takes blocks, so it can hold a link to whatever fixes it. Adapted from shadcn/ui.',
  surfaces: ['site', 'store'],
  props: z.object({
    title: z.string().min(1).max(120).default('Heads up'),
    /*
      Severity, and it is not only a colour: `critical` also makes the element
      `role="alert"` so it announces itself, where the others wait their turn.
      A severity carried by colour alone is a severity some readers never
      receive.
    */
    variant: z.enum(['info', 'attention', 'critical']).default('info'),
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
    title: { tab: 'content' },
    variant: { tab: 'design', section: 'Alert' },
    motion: { tab: 'design', section: 'Motion', kind: 'motion' },
    className: { tab: 'advanced', section: 'Custom classes', kind: 'utility-classes' },
  },
  inlineEditable: 'title',
  slots: { default: { allow: ['richText', 'cta', 'button', 'navLinks'] } },
  examples: shadcnAlertExamples,
});

export type ShadcnAlertProps = z.output<typeof shadcnAlertSchema.props>;
