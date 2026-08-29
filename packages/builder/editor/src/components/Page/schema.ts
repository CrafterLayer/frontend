import { z } from 'zod';

import { defineBlockSchema } from '@craftkit/builder-schema';

/**
 * The structural document root. Its vocabulary lists every insertable top-level
 * type — including 'announcement', whose RENDERER only arrives at runtime in the
 * playground demo (registering it late is exactly what FR-013 demonstrates).
 *
 * Page-specific settings belong to this root Page block's props, not document
 * metadata. `surface`, `dir`, `rootId`, and `schemaVersion` describe the document
 * itself; changing that contract would require a Law M migration. Block props
 * already pass through the validated, undoable edit door, and each future page
 * document carries its own settings on its root Page. Defaulted additions remain
 * backward-compatible because Zod supplies them when existing props are parsed.
 */
export const pageSchema = defineBlockSchema({
  type: 'page',
  description:
    'The page root. Holds top-level sections in order. Exactly one per document; never nested.',
  props: z.object({
    title: z.string().max(120).default(''),
    description: z.string().max(200).default(''),
    slug: z.string().max(120).default(''),
    socialTitle: z.string().max(120).optional(),
    socialDescription: z.string().max(200).optional(),
    socialImage: z.string().max(2000).optional(),
    contentWidth: z.enum(['narrow', 'standard', 'wide', 'full']).default('standard'),
    noIndex: z.boolean().default(false),
    lang: z.string().max(12).default(''),
  }),
  propertyGroups: {
    title: { tab: 'content', section: 'Identity' },
    description: { tab: 'content', section: 'Identity' },
    slug: { tab: 'content', section: 'Identity' },
    socialTitle: { tab: 'content', section: 'Sharing' },
    socialDescription: { tab: 'content', section: 'Sharing' },
    socialImage: { tab: 'content', section: 'Sharing' },
    contentWidth: { tab: 'design', section: 'Appearance' },
    noIndex: { tab: 'advanced', section: 'Indexing' },
    lang: { tab: 'advanced', section: 'Indexing' },
  },
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
        // The two layout primitives, and pictures. A page holds them directly,
        // not only inside a container — the commonest thing anyone drops.
        'grid',
        'image',
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
