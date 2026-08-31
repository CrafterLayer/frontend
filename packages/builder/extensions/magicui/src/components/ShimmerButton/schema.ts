import { z } from 'zod';

import {
  defineBlockSchema,
  findRejectedUtilities,
  motionSpecSchema,
} from '@craftkit/builder-schema';

import { shimmerButtonExamples } from './examples';

export const shimmerButtonTones = ['accent', 'inverse', 'surface'] as const;
export const shimmerButtonSizes = ['small', 'medium', 'large'] as const;
export const shimmerButtonRadii = ['small', 'large', 'pill'] as const;
export const shimmerButtonSpeeds = ['slow', 'normal', 'brisk'] as const;
export const shimmerButtonIntensities = ['subtle', 'balanced', 'strong'] as const;

const safeHrefSchema = z
  .string()
  .min(1)
  .max(2000)
  .refine((value) => /^(#|\/(?!\/)|https?:\/\/|mailto:|tel:)/i.test(value), {
    message: 'Link must be a relative path, fragment, or an http, https, mailto, or tel URL.',
  });

export const shimmerButtonSchema = defineBlockSchema({
  type: 'shimmerButton',
  description:
    'A semantic link or native button with one restrained Magic UI-inspired shimmer, token roles, a reduced-motion fallback, and full action controls.',
  surfaces: ['site', 'store'],
  props: z.object({
    label: z.string().min(1).max(80).default('Get started'),
    href: safeHrefSchema.optional(),
    openInNewTab: z.boolean().default(false),
    type: z.enum(['button', 'submit', 'reset']).default('button'),
    tone: z.enum(shimmerButtonTones).default('accent'),
    size: z.enum(shimmerButtonSizes).default('medium'),
    width: z.enum(['auto', 'full']).default('auto'),
    align: z.enum(['start', 'center', 'end']).default('start'),
    radius: z.enum(shimmerButtonRadii).default('pill'),
    speed: z.enum(shimmerButtonSpeeds).default('normal'),
    intensity: z.enum(shimmerButtonIntensities).default('balanced'),
    animate: z.boolean().default(true),
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
    label: { tab: 'content', section: 'Action' },
    href: { tab: 'content', section: 'Action' },
    openInNewTab: { tab: 'content', section: 'Action' },
    type: { tab: 'advanced', section: 'Button semantics' },
    tone: { tab: 'design', section: 'Appearance' },
    size: { tab: 'design', section: 'Appearance' },
    width: { tab: 'design', section: 'Layout' },
    align: { tab: 'design', section: 'Layout' },
    radius: { tab: 'design', section: 'Appearance' },
    speed: { tab: 'design', section: 'Shimmer' },
    intensity: { tab: 'design', section: 'Shimmer' },
    animate: { tab: 'design', section: 'Shimmer' },
    motion: { tab: 'design', section: 'Motion', kind: 'motion' },
    className: { tab: 'advanced', section: 'Custom classes', kind: 'utility-classes' },
  },
  inlineEditable: 'label',
  examples: shimmerButtonExamples,
});

export type ShimmerButtonProps = z.output<typeof shimmerButtonSchema.props>;
