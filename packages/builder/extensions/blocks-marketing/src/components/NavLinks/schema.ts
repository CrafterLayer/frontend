import { z } from 'zod';

import { defineBlockSchema } from '@craftkit/builder-schema';

import { sectionColorGroups, sectionColorProps } from '../section-color';
import { sectionMotionGroups, sectionMotionProps } from '../section-motion';
import { sectionCustomGroups, sectionCustomProps } from '../section-custom';
import { sectionDirections, sectionSpacings, sectionWraps } from '../section-options';
import { sectionSpacingGroups, sectionSpacingProps } from '../section-spacing';
import { sectionTypographyGroups, sectionTypographyProps } from '../section-typography';
import { navLinksExamples } from './examples';

const safeHrefSchema = z
  .string()
  .min(1)
  .max(200)
  .refine(
    (href) =>
      (href.startsWith('/') && !href.startsWith('//') && !href.startsWith('/\\')) ||
      href.startsWith('#') ||
      /^(?:https?:|mailto:|tel:)/u.test(href),
    { message: 'Link must be relative or use http, https, mailto, or tel.' },
  );

export const navLinksSchema = defineBlockSchema({
  type: 'navLinks',
  description:
    'An inline list of links that can be composed in a page header, a footer column, or anywhere navigation is needed.',
  surfaces: ['site', 'store', 'docs'],
  props: z.object({
    links: z
      .array(
        z.object({
          label: z.string().min(1).max(24),
          href: safeHrefSchema,
        }),
      )
      .max(10)
      .default([]),
    direction: z.enum(sectionDirections).default('row'),
    style: z.enum(['plain', 'underline', 'pill']).default('plain'),
    gap: z.enum(sectionSpacings).default('md'),
    wrap: z.enum(sectionWraps).default('wrap'),
    ...sectionColorProps,
    ...sectionMotionProps,
    ...sectionCustomProps,
    ...sectionTypographyProps,
    ...sectionSpacingProps,
  }),
  propertyGroups: {
    links: { tab: 'content', section: 'Links' },
    direction: { tab: 'design', section: 'Layout' },
    style: { tab: 'design', section: 'Style' },
    gap: { tab: 'design', section: 'Spacing' },
    wrap: { tab: 'advanced', section: 'Layout' },
    ...sectionColorGroups,
    ...sectionMotionGroups,
    ...sectionCustomGroups,
    ...sectionTypographyGroups,
    ...sectionSpacingGroups,
  },
  /*
    The list's inner elements (block-parts DESIGN §1): the link list, each
    entry, and each entry's link, whose label edits in place and whose
    destination opens in the Link popover.
  */
  parts: {
    links: {
      kind: 'list',
      bind: 'links',
      label: { en: 'Links', ar: 'الروابط' },
      aliases: ['navigation', 'menu', 'nav', 'القائمة', 'التنقل'],
    },
    item: {
      kind: 'item',
      bind: 'links.*',
      list: 'links',
      label: { en: 'Menu entry', ar: 'عنصر القائمة' },
      aliases: ['entry', 'menu item', 'nav item', 'عنصر', 'بند'],
    },
    'item.link': {
      kind: 'link',
      bind: { text: 'links.*.label', href: 'links.*.href' },
      label: { en: 'Link', ar: 'الرابط' },
      aliases: ['link', 'label', 'link text', 'رابط', 'نص الرابط'],
    },
  },
  examples: navLinksExamples,
});

export type NavLinksProps = z.output<typeof navLinksSchema.props>;
