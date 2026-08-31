import { z } from 'zod';

import {
  defineBlockSchema,
  findRejectedUtilities,
  motionSpecSchema,
} from '@craftkit/builder-schema';

import { buttonExamples } from './examples';

export const buttonVariants = ['solid', 'outline', 'ghost', 'link'] as const;
export const buttonSizes = ['small', 'medium', 'large'] as const;
export const buttonIcons = ['none', 'arrow', 'external', 'plus', 'play'] as const;

const safeHrefSchema = z
  .string()
  .min(1)
  .max(2000)
  .refine(
    (value) =>
      value.startsWith('#') ||
      (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) ||
      /^(https?:\/\/|mailto:|tel:)/i.test(value),
    {
      message: 'Link must be a relative path, fragment, or an http, https, mailto, or tel URL.',
    },
  );

export const buttonSchema = defineBlockSchema({
  type: 'button',
  description:
    'A primary action control that renders as a safe link when it has a destination and as a native button otherwise. Adapted from shadcn/ui.',
  surfaces: ['site', 'store'],
  props: z.object({
    label: z.string().min(1).max(80).default('Get started'),
    href: safeHrefSchema.optional(),
    openInNewTab: z.boolean().default(false),
    type: z.enum(['button', 'submit', 'reset']).default('button'),
    variant: z.enum(buttonVariants).default('solid'),
    size: z.enum(buttonSizes).default('medium'),
    width: z.enum(['auto', 'full']).default('auto'),
    align: z.enum(['start', 'center', 'end']).default('start'),
    radius: z.enum(['small', 'large', 'pill']).default('large'),
    icon: z.enum(buttonIcons).default('none'),
    iconPosition: z.enum(['start', 'end']).default('end'),
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
    variant: { tab: 'design', section: 'Appearance' },
    size: { tab: 'design', section: 'Appearance' },
    width: { tab: 'design', section: 'Layout' },
    align: { tab: 'design', section: 'Layout' },
    radius: { tab: 'design', section: 'Appearance' },
    icon: { tab: 'design', section: 'Icon' },
    iconPosition: { tab: 'design', section: 'Icon' },
    motion: { tab: 'design', section: 'Motion', kind: 'motion' },
    className: { tab: 'advanced', section: 'Custom classes', kind: 'utility-classes' },
  },
  inlineEditable: 'label',
  examples: buttonExamples,
});

export type ButtonProps = z.output<typeof buttonSchema.props>;
