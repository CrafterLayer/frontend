import { z } from 'zod';

import {
  defineBlockSchema,
  findRejectedUtilities,
  motionSpecSchema,
} from '@craftkit/builder-schema';

import { shineBorderExamples } from './examples';

/**
 * What a shine border may frame.
 *
 * Generous on purpose: the effect is a ring around something, and the something
 * is whatever the page needs highlighted — a pricing card, a feature, a call to
 * action. Constraining it would make the block useless for the case people
 * reach for it.
 */
const SHINE_CHILDREN = [
  'stack',
  'grid',
  'richText',
  'cta',
  'image',
  'features',
  'pricingPlan',
  'testimonials',
  'formSection',
  'productGrid',
  'portfolioGrid',
  'card',
  'button',
  'avatarGroup',
  'progress',
] as const;

export const shineBorderSchema = defineBlockSchema({
  type: 'shineBorder',
  description:
    'A travelling highlight around the edge of whatever it contains. Use to draw the eye to one card or one call to action — never to more than one thing on a page.',
  surfaces: ['site', 'store'],
  props: z.object({
    /*
      How long one full travel takes. Named steps rather than seconds: a number
      of seconds is a literal, and "slow" is what a person actually means.
    */
    speed: z.enum(['slow', 'normal', 'brisk']).default('normal'),
    /*
      The ring's weight. Reads a token in the stylesheet, so it matches every
      other edge on the page rather than inventing its own hairline.
    */
    weight: z.enum(['hairline', 'medium', 'heavy']).default('hairline'),
    animate: z.boolean().default(true),
    motion: motionSpecSchema.optional(),
    /*
      Arbitrary Tailwind, checked at the door by the same layer-0 rule every
      other block uses: the numeric scale and colour ROLES pass because both
      resolve through tokens; arbitrary values and Tailwind's own palette are
      refused because the design system cannot reach either.
    */
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
    speed: { tab: 'design', section: 'Shine' },
    weight: { tab: 'design', section: 'Shine' },
    animate: { tab: 'design', section: 'Shine' },
    motion: { tab: 'design', section: 'Motion', kind: 'motion' },
    className: { tab: 'advanced', section: 'Custom classes' },
  },
  slots: { default: { allow: [...SHINE_CHILDREN] } },
  examples: shineBorderExamples,
});

export type ShineBorderProps = z.output<typeof shineBorderSchema.props>;
