import { z } from 'zod';

import {
  defineBlockSchema,
  findRejectedUtilities,
  motionSpecSchema,
} from '@craftkit/builder-schema';

import { cardExamples } from './examples';

/*
  What a card may hold.

  Generous on purpose. A card is a CONTAINER, and the failure this block exists
  to avoid is the one the old Pricing section had: a shape that could express a
  list of strings and nothing else, so the one thing every real card needs — a
  button — was impossible to author.
*/
const CARD_CHILDREN = [
  'richText',
  'image',
  'cta',
  'navLinks',
  'stack',
  'grid',
  'badge',
  'shadcnAlert',
  'accordion',
  'button',
  'separator',
  'avatarGroup',
  'progress',
  'breadcrumbs',
  'dialog',
  'pagination',
  'formSection',
] as const;

export const cardSchema = defineBlockSchema({
  type: 'card',
  description:
    'A surface that groups related content: an optional header, a body, and an optional footer. Put a heading, text, an image, or a button inside any of them. Adapted from shadcn/ui.',
  surfaces: ['site', 'store'],
  props: z.object({
    tone: z.enum(['surface', 'inverse', 'transparent']).default('surface'),
    padding: z.enum(['none', 'compact', 'regular', 'roomy']).default('regular'),
    radius: z.enum(['none', 'small', 'regular', 'large']).default('regular'),
    bordered: z.boolean().default(true),
    /*
      `soft` and `strong` are the two shadow TOKENS this theme defines, so the
      utility resolves to `var(--t-shadow-soft)`. A numeric scale here would
      have needed shadows the design system does not have.
    */
    elevation: z.enum(['none', 'soft', 'strong']).default('none'),
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
    tone: { tab: 'design', section: 'Card' },
    padding: { tab: 'design', section: 'Card' },
    radius: { tab: 'design', section: 'Card' },
    bordered: { tab: 'design', section: 'Card' },
    elevation: { tab: 'design', section: 'Card' },
    motion: { tab: 'design', section: 'Motion', kind: 'motion' },
    className: { tab: 'advanced', section: 'Custom classes', kind: 'utility-classes' },
  },
  slots: {
    header: { allow: [...CARD_CHILDREN] },
    default: { allow: [...CARD_CHILDREN] },
    footer: { allow: [...CARD_CHILDREN] },
  },
  examples: cardExamples,
});

export type CardProps = z.output<typeof cardSchema.props>;
