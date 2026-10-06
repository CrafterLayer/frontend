import { z } from 'zod';

import {
  defineBlockSchema,
  findRejectedUtilities,
  motionSpecSchema,
  partStylesProp,
} from '@craftkit/builder-schema';

import { separatorExamples } from './examples';

export const separatorOrientations = ['horizontal', 'vertical'] as const;
export const separatorTones = ['subtle', 'accent', 'inverse'] as const;
export const separatorStyles = ['solid', 'dashed', 'dotted'] as const;
export const separatorSpacings = ['none', 'compact', 'regular', 'roomy'] as const;
export const separatorThicknesses = ['hairline', 'medium', 'strong'] as const;

export const separatorSchema = defineBlockSchema({
  type: 'separator',
  description:
    'A semantic horizontal or vertical divider with an optional visible label and token-bound tone, line style, spacing, thickness, motion, and utility controls. Adapted from shadcn/ui.',
  surfaces: ['site', 'store', 'docs'],
  props: z.object({
    label: z.string().min(1).max(40).optional(),
    orientation: z.enum(separatorOrientations).default('horizontal'),
    tone: z.enum(separatorTones).default('subtle'),
    style: z.enum(separatorStyles).default('solid'),
    spacing: z.enum(separatorSpacings).default('regular'),
    thickness: z.enum(separatorThicknesses).default('hairline'),
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
    label: { tab: 'content', section: 'Label' },
    orientation: { tab: 'design', section: 'Direction' },
    tone: { tab: 'design', section: 'Line' },
    style: { tab: 'design', section: 'Line' },
    spacing: { tab: 'design', section: 'Spacing' },
    thickness: { tab: 'design', section: 'Line' },
    motion: { tab: 'design', section: 'Motion', kind: 'motion' },
    className: { tab: 'advanced', section: 'Custom classes', kind: 'utility-classes' },
    partStyles: { tab: 'advanced', section: 'Custom classes', kind: 'part-styles' },
  },
  inlineEditable: 'label',
  /* The optional visible label is the divider's one part (block-parts DESIGN §1). */
  parts: {
    label: {
      kind: 'text',
      bind: 'label',
      label: { en: 'Label', ar: 'التسمية' },
      aliases: ['text', 'caption', 'النص', 'تسمية'],
    },
  },
  examples: separatorExamples,
});

export type SeparatorProps = z.output<typeof separatorSchema.props>;
