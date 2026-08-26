import { z } from 'zod';

import { defineBlockSchema } from '@craftkit/builder-schema';

/**
 * The structural document root. Its vocabulary lists every insertable top-level
 * type — including 'announcement', whose RENDERER only arrives at runtime in the
 * playground demo (registering it late is exactly what FR-013 demonstrates).
 */
export const pageSchema = defineBlockSchema({
  type: 'page',
  description:
    'The page root. Holds top-level sections in order. Exactly one per document; never nested.',
  props: z.object({
    title: z.string().max(120).default(''),
  }),
  slots: {
    default: {
      allow: ['hero', 'features', 'pricing', 'testimonials', 'cta', 'announcement'],
    },
  },
  examples: [
    {
      prompt: 'صفحة هبوط لمتجر عطور',
      node: { type: 'page', props: { title: 'الرئيسية' } },
    },
    {
      prompt: 'landing page for a SaaS analytics tool',
      node: { type: 'page', props: { title: 'Home' } },
    },
  ],
});
