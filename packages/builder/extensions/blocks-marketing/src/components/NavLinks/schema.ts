import { z } from 'zod';

import { defineBlockSchema } from '@craftkit/builder-schema';

import { sectionColorGroups, sectionColorProps } from '../section-color';
import { sectionDirections, sectionSpacings, sectionWraps } from '../section-options';
import { navLinksExamples } from './examples';

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
          href: z.string().min(1).max(200),
        }),
      )
      .max(10)
      .default([]),
    direction: z.enum(sectionDirections).default('row'),
    style: z.enum(['plain', 'underline', 'pill']).default('plain'),
    textCase: z.enum(['normal', 'uppercase']).default('normal'),
    weight: z.enum(['regular', 'medium', 'semibold']).default('medium'),
    gap: z.enum(sectionSpacings).default('md'),
    wrap: z.enum(sectionWraps).default('wrap'),
    ...sectionColorProps,
  }),
  propertyGroups: {
    links: { tab: 'content', section: 'Links' },
    direction: { tab: 'design', section: 'Layout' },
    style: { tab: 'design', section: 'Style' },
    textCase: { tab: 'design', section: 'Typography' },
    weight: { tab: 'design', section: 'Typography' },
    gap: { tab: 'design', section: 'Spacing' },
    wrap: { tab: 'advanced', section: 'Layout' },
    ...sectionColorGroups,
  },
  examples: navLinksExamples,
});

export type NavLinksProps = z.output<typeof navLinksSchema.props>;
