import { z } from 'zod';

import {
  defineBlockSchema,
  findRejectedUtilities,
  motionSpecSchema,
} from '@craftkit/builder-schema';

import { dotPatternSurfaceExamples } from './examples';

export const dotPatternDensities = ['sparse', 'balanced', 'dense'] as const;
export const dotPatternSizes = ['fine', 'regular', 'bold'] as const;
export const dotPatternIntensities = ['subtle', 'balanced', 'strong'] as const;
export const dotPatternTones = ['muted', 'accent', 'inverse'] as const;
export const dotPatternFades = ['none', 'soft', 'strong'] as const;
export const dotPatternMaskPositions = [
  'center',
  'inlineStart',
  'inlineEnd',
  'top',
  'bottom',
] as const;
export const dotPatternPaddings = ['none', 'compact', 'regular', 'roomy'] as const;
export const dotPatternRadii = ['none', 'regular', 'large'] as const;

const DOT_PATTERN_CHILDREN = [
  'stack',
  'grid',
  'richText',
  'image',
  'cta',
  'navLinks',
  'announcementBar',
  'hero',
  'logoCloud',
  'features',
  'bento-grid',
  'content-section',
  'stats',
  'processSteps',
  'team',
  'pricing',
  'pricingPlan',
  'testimonials',
  'comparisonTable',
  'table',
  'chart',
  'timeline',
  'menuSection',
  'location',
  'countdown',
  'faq',
  'blogGrid',
  'contact',
  'newsletter',
  'portfolioGrid',
  'productGrid',
  'formSection',
  'gallery',
  'carousel',
  'promoBanner',
  'videoSection',
  'card',
  'badge',
  'button',
  'avatarGroup',
  'separator',
  'progress',
  'breadcrumbs',
  'pagination',
  'shadcnAlert',
  'tabs',
  'dialog',
  'shimmerButton',
  'shineBorder',
  'marquee',
] as const;

export const dotPatternSurfaceSchema = defineBlockSchema({
  type: 'dotPatternSurface',
  description:
    'A compositional surface that places a token-bound dot field behind explicit site and store content, with density, size, intensity, tone, fade, logical mask position, and stillness controls.',
  surfaces: ['site', 'store'],
  props: z.object({
    density: z.enum(dotPatternDensities).default('balanced'),
    size: z.enum(dotPatternSizes).default('fine'),
    intensity: z.enum(dotPatternIntensities).default('balanced'),
    tone: z.enum(dotPatternTones).default('muted'),
    fade: z.enum(dotPatternFades).default('soft'),
    maskPosition: z.enum(dotPatternMaskPositions).default('center'),
    animate: z.boolean().default(false),
    padding: z.enum(dotPatternPaddings).default('regular'),
    radius: z.enum(dotPatternRadii).default('large'),
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
    density: { tab: 'design', section: 'Pattern' },
    size: { tab: 'design', section: 'Pattern' },
    intensity: { tab: 'design', section: 'Pattern' },
    tone: { tab: 'design', section: 'Pattern' },
    fade: { tab: 'design', section: 'Mask' },
    maskPosition: { tab: 'design', section: 'Mask' },
    animate: { tab: 'design', section: 'Pattern' },
    padding: { tab: 'design', section: 'Surface' },
    radius: { tab: 'design', section: 'Surface' },
    motion: { tab: 'design', section: 'Motion', kind: 'motion' },
    className: { tab: 'advanced', section: 'Custom classes', kind: 'utility-classes' },
  },
  slots: { default: { allow: [...DOT_PATTERN_CHILDREN] } },
  examples: dotPatternSurfaceExamples,
});

export type DotPatternSurfaceProps = z.output<typeof dotPatternSurfaceSchema.props>;
