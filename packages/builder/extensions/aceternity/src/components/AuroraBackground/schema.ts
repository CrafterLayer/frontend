import { z } from 'zod';

import {
  defineBlockSchema,
  findRejectedUtilities,
  motionSpecSchema,
} from '@craftkit/builder-schema';

import { auroraExamples } from './examples';

/**
 * What an aurora may frame.
 *
 * Deliberately generous: the point of a decorative background is that it goes
 * BEHIND something, and constraining what that something may be would make the
 * block useless for the case people actually reach for it — a hero.
 */
const AURORA_CHILDREN = [
  'hero',
  'stack',
  'grid',
  'richText',
  'cta',
  'image',
  'features',
  'pricing',
] as const;

export const auroraBackgroundSchema = defineBlockSchema({
  type: 'auroraBackground',
  description:
    'A slow, drifting gradient behind a section. Put a hero or any other block inside it. The colours come from the site design system, so the aurora follows the brand rather than fighting it.',
  surfaces: ['site', 'store'],
  props: z.object({
    /*
      How far the effect reads. Named steps rather than an opacity number: a
      person choosing "subtle" is expressing intent, and the exact value is a
      design decision the stylesheet should be free to revise.
    */
    intensity: z.enum(['subtle', 'normal', 'bold']).default('normal'),
    /*
      Whether the aurora drifts at all. Off is a real choice — a page with three
      moving backgrounds is a page nobody can read.
    */
    animate: z.boolean().default(true),
    minHeight: z.enum(['none', 'half', 'screen']).default('none'),
    motion: motionSpecSchema.optional(),
    /*
      Arbitrary Tailwind, validated at the door by the same layer-0 rule every
      other block uses: the numeric scale and colour ROLES are allowed because
      both resolve through tokens; arbitrary values and Tailwind's own palette
      are refused because the design system cannot reach either.

      This is what "the AI can customise it" means concretely — the planner may
      write any layout, spacing, or responsive utility here and the door checks
      it before it is stored.
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
    intensity: { tab: 'design', section: 'Aurora' },
    animate: { tab: 'design', section: 'Aurora' },
    minHeight: { tab: 'design', section: 'Layout' },
    motion: { tab: 'design', section: 'Motion', kind: 'motion' },
    className: { tab: 'advanced', section: 'Custom classes' },
  },
  slots: { default: { allow: [...AURORA_CHILDREN] } },
  examples: auroraExamples,
});

export type AuroraBackgroundProps = z.output<typeof auroraBackgroundSchema.props>;
