import { z } from 'zod';

import {
  defineBlockSchema,
  findRejectedUtilities,
  motionSpecSchema,
} from '@craftkit/builder-schema';

import { marqueeExamples } from './examples';

const safeDestinationSchema = z
  .string()
  .min(1)
  .max(2000)
  .refine(
    (value) =>
      value.startsWith('#') ||
      (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) ||
      /^(https?:\/\/|mailto:|tel:)/i.test(value),
    {
      message: 'URL must be relative or use http, https, mailto, or tel.',
    },
  );

const safeImageUrlSchema = z
  .string()
  .min(1)
  .max(2000)
  .refine(
    (value) =>
      (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) ||
      /^https?:\/\//i.test(value),
    { message: 'Image URL must be a safe root-relative, http, or https URL.' },
  );

export const marqueeItemSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(200).optional(),
  meta: z.string().min(1).max(60).optional(),
  imageUrl: safeImageUrlSchema.optional(),
  imageAlt: z.string().max(140).optional(),
  href: safeDestinationSchema.optional(),
});

const defaultItems = z.array(marqueeItemSchema).parse([
  { title: 'Northstar', meta: 'Strategy' },
  { title: 'Monument', meta: 'Product' },
  { title: 'Fieldwork', meta: 'Research' },
  { title: 'Continuum', meta: 'Technology' },
  { title: 'Afterglow', meta: 'Design' },
]);

export const marqueeSchema = defineBlockSchema({
  type: 'marquee',
  description:
    'A continuously moving, reduced-motion-safe row for logos, testimonials, announcements, partners, or compact content cards. Inspired by Magic UI.',
  surfaces: ['site', 'store'],
  props: z.object({
    label: z.string().min(1).max(100).default('Highlights'),
    pauseLabel: z.string().min(1).max(60).default('Pause animation'),
    resumeLabel: z.string().min(1).max(60).default('Resume animation'),
    items: z.array(marqueeItemSchema).min(2).max(24).default(defaultItems),
    presentation: z.enum(['logos', 'cards', 'compact']).default('logos'),
    direction: z.enum(['forward', 'reverse']).default('forward'),
    speed: z.enum(['slow', 'normal', 'fast']).default('normal'),
    rows: z.enum(['one', 'two']).default('one'),
    pauseOnHover: z.boolean().default(true),
    edgeFade: z.boolean().default(true),
    tone: z.enum(['transparent', 'surface', 'inverse']).default('transparent'),
    radius: z.enum(['small', 'large', 'pill']).default('large'),
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
    label: { tab: 'content', section: 'Accessibility' },
    pauseLabel: { tab: 'content', section: 'Accessibility' },
    resumeLabel: { tab: 'content', section: 'Accessibility' },
    items: { tab: 'content', section: 'Items' },
    presentation: { tab: 'design', section: 'Appearance' },
    direction: { tab: 'design', section: 'Motion' },
    speed: { tab: 'design', section: 'Motion' },
    rows: { tab: 'design', section: 'Layout' },
    pauseOnHover: { tab: 'design', section: 'Motion' },
    edgeFade: { tab: 'design', section: 'Appearance' },
    tone: { tab: 'design', section: 'Colour' },
    radius: { tab: 'design', section: 'Appearance' },
    motion: { tab: 'design', section: 'Motion', kind: 'motion' },
    className: { tab: 'advanced', section: 'Custom classes', kind: 'utility-classes' },
  },
  examples: marqueeExamples,
});

export type MarqueeProps = z.output<typeof marqueeSchema.props>;
export type MarqueeItem = z.output<typeof marqueeItemSchema>;
