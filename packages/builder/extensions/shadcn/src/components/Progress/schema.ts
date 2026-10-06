import { z } from 'zod';

import {
  defineBlockSchema,
  findRejectedUtilities,
  motionSpecSchema,
  partStylesProp,
} from '@craftkit/builder-schema';

import { progressExamples } from './examples';

export const progressSizes = ['small', 'medium', 'large'] as const;
export const progressVariants = ['accent', 'success', 'neutral'] as const;
export const progressRadii = ['none', 'small', 'large', 'pill'] as const;

export const progressSchema = defineBlockSchema({
  type: 'progress',
  description:
    'An accessible determinate progress indicator with a visible label, optional percentage, token-bound appearance, and safe motion controls. Adapted from shadcn/ui.',
  surfaces: ['site', 'store', 'docs'],
  props: z.object({
    label: z.string().min(1).max(100).default('Project progress'),
    value: z.number().min(0).max(1_000_000).default(64),
    max: z.number().positive().max(1_000_000).default(100),
    showValue: z.boolean().default(true),
    size: z.enum(progressSizes).default('medium'),
    variant: z.enum(progressVariants).default('accent'),
    radius: z.enum(progressRadii).default('pill'),
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
    label: { tab: 'content', section: 'Progress' },
    value: { tab: 'content', section: 'Progress' },
    max: { tab: 'content', section: 'Progress' },
    showValue: { tab: 'design', section: 'Value label' },
    size: { tab: 'design', section: 'Track' },
    variant: { tab: 'design', section: 'Track' },
    radius: { tab: 'design', section: 'Track' },
    motion: { tab: 'design', section: 'Motion', kind: 'motion' },
    className: { tab: 'advanced', section: 'Custom classes', kind: 'utility-classes' },
    partStyles: { tab: 'advanced', section: 'Custom classes', kind: 'part-styles' },
  },
  inlineEditable: 'label',
  /* The label, the percentage readout and the bar (block-parts DESIGN §1). */
  parts: {
    label: {
      kind: 'text',
      bind: 'label',
      label: { en: 'Label', ar: 'التسمية' },
      aliases: ['title', 'text', 'العنوان', 'النص', 'تسمية'],
    },
    value: {
      kind: 'box',
      label: { en: 'Percentage', ar: 'النسبة' },
      aliases: ['percent', 'number', 'readout', 'نسبة', 'الرقم'],
    },
    track: {
      kind: 'box',
      label: { en: 'Track', ar: 'المسار' },
      aliases: ['bar background', 'rail', 'مسار', 'خلفية الشريط'],
    },
    indicator: {
      kind: 'box',
      label: { en: 'Bar', ar: 'الشريط' },
      aliases: ['fill', 'bar', 'progress bar', 'شريط', 'التعبئة'],
    },
  },
  examples: progressExamples,
});

export type ProgressProps = z.output<typeof progressSchema.props>;
