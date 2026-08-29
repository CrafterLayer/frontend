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
      /*
        `richText` was missing, and every fixture that put a rich-text block on
        a page had been INVALID against this very registry without anyone
        noticing: the door validates each CHANGE, so a document authored before
        the list was written is never re-checked as a whole. The assistant's
        preflight found it on its first real run — it validates the resulting
        document, not just the step, and refused to act on a page it could not
        leave valid.
      */
      allow: [
        'hero',
        'features',
        'pricing',
        'testimonials',
        'cta',
        'announcement',
        'richText',
        'navLinks',
        // The layout container, so a page can hold columns rather than only
        // a vertical run of sections.
        'stack',
        // Page chrome. Root-only by design: a header nested inside a layout
        // container is a <header> inside a flex row, which is a structural
        // mistake no inspector control can undo.
        'pageHeader',
        'pageFooter',
      ],
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
