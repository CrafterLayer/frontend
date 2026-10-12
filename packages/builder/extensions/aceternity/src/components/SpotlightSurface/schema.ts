import { z } from 'zod';

import {
  defineBlockSchema,
  findRejectedUtilities,
  motionSpecSchema,
} from '@craftkit/builder-schema';

import { spotlightSurfaceExamples } from './examples';

const SPOTLIGHT_CHILDREN = [
  'stack',
  'grid',
  'hero',
  'content-section',
  'features',
  'bento-grid',
  'stats',
  'table',
  'chart',
  'testimonials',
  'pricing',
  'cta',
  'newsletter',
  'formSection',
  'carousel',
  'promoBanner',
  'gallery',
  'videoSection',
  'portfolioGrid',
  'productGrid',
  'marquee',
  'card',
  'shineBorder',
  'badge',
  'shadcnAlert',
  'tabs',
  'separator',
  'avatarGroup',
  'progress',
  'breadcrumbs',
  'dialog',
  'pagination',
  'button',
  'shimmerButton',
] as const;

export const spotlightSurfaceSchema = defineBlockSchema({
  type: 'spotlightSurface',
  description:
    'A token-bound spotlight backdrop for one high-priority section. Inspired by Aceternity UI and designed to remain readable, themeable, and reduced-motion safe.',
  surfaces: ['site', 'store'],
  props: z.object({
    variant: z.enum(['soft', 'focused', 'dual']).default('soft'),
    position: z.enum(['start', 'center', 'end']).default('center'),
    intensity: z.enum(['subtle', 'balanced', 'strong']).default('balanced'),
    tone: z.enum(['light', 'dark']).default('dark'),
    minHeight: z.enum(['auto', 'compact', 'viewport']).default('auto'),
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
    variant: { tab: 'design', section: 'Spotlight' },
    position: { tab: 'design', section: 'Spotlight' },
    intensity: { tab: 'design', section: 'Spotlight' },
    tone: { tab: 'design', section: 'Colour' },
    minHeight: { tab: 'design', section: 'Layout' },
    animate: { tab: 'design', section: 'Motion' },
    motion: { tab: 'design', section: 'Motion', kind: 'motion' },
    className: { tab: 'advanced', section: 'Custom classes', kind: 'utility-classes' },
  },
  slots: { default: { allow: [...SPOTLIGHT_CHILDREN] } },
  examples: spotlightSurfaceExamples,
});

export type SpotlightSurfaceProps = z.output<typeof spotlightSurfaceSchema.props>;
