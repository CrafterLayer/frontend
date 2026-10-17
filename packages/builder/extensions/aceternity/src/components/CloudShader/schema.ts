import { z } from 'zod';

import {
  defineBlockSchema,
  findRejectedUtilities,
  motionSpecSchema,
} from '@craftkit/builder-schema';

import { CLOUD_ROLES } from './colors';
import { cloudShaderExamples } from './examples';

/** What a sky may frame. Generous, because a background goes behind things. */
const CLOUD_CHILDREN = [
  'hero',
  'promoBanner',
  'carousel',
  'videoSection',
  'gallery',
  'stack',
  'grid',
  'richText',
  'cta',
  'image',
  'features',
  'pricing',
  'testimonials',
  'portfolioGrid',
  'productGrid',
  'formSection',
  'newsletter',
  'marquee',
  'card',
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

/*
  Colour as a ROLE, never a value.

  Upstream takes `cloudColor="#fbf8f2"`, `skyTopColor="#3876ba"`,
  `skyBottomColor="#8cbfe8"`. Stored in a document those are three literals the
  design system can never reach — a blue sky on a terracotta brand, forever.
  The role name is stored and resolved against the element at paint time, so
  re-pointing one token moves the sky.
*/
const colorRole = z.enum(CLOUD_ROLES);

export const cloudShaderSchema = defineBlockSchema({
  type: 'cloudShader',
  description:
    'Soft procedural clouds drifting across a sky, drawn on the GPU. Put a hero or any other block inside it. The sky and cloud colours are design-system roles, so the weather follows the brand.',
  surfaces: ['site', 'store'],
  props: z.object({
    /*
      Octaves of noise, named. `detail: 'intricate'` costs real GPU time on a
      phone, so the choice is exposed rather than hidden behind one setting
      that has to be wrong somewhere.
    */
    detail: z.enum(['soft', 'normal', 'intricate']).default('normal'),
    coverage: z.enum(['clear', 'scattered', 'overcast']).default('scattered'),
    speed: z.enum(['still', 'drifting', 'brisk']).default('drifting'),
    /* Off is a real choice — a page with three moving backgrounds is unreadable. */
    animate: z.boolean().default(true),
    cloudColor: colorRole.default('textInverse'),
    skyTopColor: colorRole.default('accent'),
    skyBottomColor: colorRole.default('surface'),
    /*
      `half` by default. A shader block whose slot is empty has no content to
      take its height from, and a 48px strip does not read as a sky.
    */
    minHeight: z.enum(['none', 'half', 'screen']).default('half'),
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
    detail: { tab: 'design', section: 'Sky' },
    coverage: { tab: 'design', section: 'Sky' },
    speed: { tab: 'design', section: 'Sky' },
    animate: { tab: 'design', section: 'Sky' },
    skyTopColor: { tab: 'design', section: 'Colours' },
    skyBottomColor: { tab: 'design', section: 'Colours' },
    cloudColor: { tab: 'design', section: 'Colours' },
    minHeight: { tab: 'design', section: 'Layout' },
    motion: { tab: 'design', section: 'Motion', kind: 'motion' },
    className: { tab: 'advanced', section: 'Custom classes', kind: 'utility-classes' },
  },
  slots: { default: { allow: [...CLOUD_CHILDREN] } },
  examples: cloudShaderExamples,
});

export type CloudShaderProps = z.output<typeof cloudShaderSchema.props>;
