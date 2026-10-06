import { z } from 'zod';

import {
  defineBlockSchema,
  findRejectedUtilities,
  motionSpecSchema,
  partStylesProp,
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
    /* Per-part classes and direction (block-parts DESIGN §2.2), under the tokens law. */
    partStyles: partStylesProp(),
  }),
  propertyGroups: {
    title: { tab: 'content' },
    variant: { tab: 'design', section: 'Alert' },
    motion: { tab: 'design', section: 'Motion', kind: 'motion' },
    className: { tab: 'advanced', section: 'Custom classes', kind: 'utility-classes' },
    partStyles: { tab: 'advanced', section: 'Custom classes', kind: 'part-styles' },
  },
  inlineEditable: 'title',
  /* The callout's own elements (block-parts DESIGN §1); its body is composed from slot children. */
  parts: {
    icon: {
      kind: 'box',
      label: { en: 'Icon', ar: 'الأيقونة' },
      aliases: ['glyph', 'symbol', 'أيقونة', 'الرمز'],
    },
    title: {
      kind: 'text',
      bind: 'title',
      label: { en: 'Title', ar: 'العنوان' },
      aliases: ['heading', 'headline', 'message', 'عنوان', 'الرسالة'],
    },
  },
  slots: {
    default: { allow: ['richText', 'cta', 'button', 'shimmerButton', 'navLinks'] },
  },
  examples: shadcnAlertExamples,
});

export type ShadcnAlertProps = z.output<typeof shadcnAlertSchema.props>;
