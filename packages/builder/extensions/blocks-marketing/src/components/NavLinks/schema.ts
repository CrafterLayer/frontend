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
      href.startsWith('/') || href.startsWith('#') || /^(?:https?:|mailto:|tel:)/u.test(href),
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
  examples: navLinksExamples,
});

export type NavLinksProps = z.output<typeof navLinksSchema.props>;
