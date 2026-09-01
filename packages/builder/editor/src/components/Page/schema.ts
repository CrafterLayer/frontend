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
    /*
      Full-bleed by default. Sections already own their content column and
      their gutter, so a page-level ceiling clamped them a second time and made
      an edge-to-edge hero impossible to author. The measure stays available —
      it is just a CHOICE made here now, not a floor nobody opted into.
    */
    contentWidth: z.enum(['narrow', 'standard', 'wide', 'full']).default('full'),
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
        'announcementBar',
        'promoBanner',
        'carousel',
        'videoSection',
        'gallery',
        'logoCloud',
        'features',
        'bento-grid',
        'content-section',
        'stats',
        'processSteps',
        'team',
        'portfolioGrid',
        'productGrid',
        'pricing',
        'testimonials',
        'comparisonTable',
        'faq',
        'blogGrid',
        'contact',
        'formSection',
        'newsletter',
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
        // The animated backdrop containers (aceternity). The playground's own
        // default document mounts one on the page root; a list that refuses
        // what the fixtures already do makes every assistant plan invalid.
        // Both are page-level BACKGROUNDS — they take a section as a child, so
        // omitting one from this list is the same as not shipping it: the
        // palette offers a block the root will not accept.
        'auroraBackground',
        'cloudShader',
        'spotlightSurface',
        // The travelling-border container (magic ui). Same argument: it is a
        // wrapper, and a wrapper the page root refuses can never be used.
        'shineBorder',
        'marquee',
        'dotPatternSurface',
        'shimmerButton',
        // shadcn containers. `card` and `tabs` are page-level structures in
        // their own right — a FAQ is a page of tabs, a feature row is a page
        // of cards — so refusing them at the root would leave both reachable
        // only from inside something else.
        'card',
        'tabs',
        'shadcnAlert',
        // Primary building blocks are valid at the root as intentional, small
        // compositions and remain more useful inside Stack/Grid/Card.
        'button',
        'separator',
        'avatarGroup',
        'progress',
        'breadcrumbs',
        'dialog',
        'pagination',
        'accordion',
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
