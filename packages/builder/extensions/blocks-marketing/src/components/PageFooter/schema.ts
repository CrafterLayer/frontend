import { z } from 'zod';

import { defineBlockSchema } from '@craftkit/builder-schema';

import { sectionColorGroups, sectionColorProps } from '../section-color';
import { sectionAlignments, sectionSpacings, sectionTones, sectionWidths } from '../section-options';
import { pageFooterExamples } from './examples';

/**
 * The page's footer.
 *
 * Deliberately the header's mirror in vocabulary — the same colour roles, the
 * same width and spacing scales, the same `layout`-decides-structure rule — so
 * that a person who has learned one has learned the other. Where they differ is
 * what they hold: a footer carries columns of links, social destinations and a
 * legal line, and it never sticks.
 *
 * As in the header, colour is a ROLE and size is an ENUM. A footer holding
 * `#111827` is a footer that cannot be re-themed; one holding `surfaceInverse`
 * follows the site wherever the theme goes.
 */

/** How the regions are arranged. `minimal` is one line: legal only. */
export const footerLayouts = ['columns', 'centered', 'split', 'minimal'] as const;

/** A cap, not a promise — the grid drops columns before it crushes them. */
export const footerColumnCounts = ['auto', '2', '3', '4'] as const;

export const footerBorders = ['none', 'top'] as const;
export const textCases = ['normal', 'uppercase'] as const;
export const linkStyles = ['plain', 'underline'] as const;

const link = z.object({
  label: z.string().min(1).max(24),
  href: z.string().min(1).max(200),
});

export const pageFooterSchema = defineBlockSchema({
  type: 'pageFooter',
  description:
    'The bar at the foot of a page: a short statement, columns of links, social destinations and a legal line. One per page, below everything else.',
  surfaces: ['site', 'store', 'docs'],
  props: z.object({
    // ── What it says ────────────────────────────────────────────────────────
    brand: z.string().max(40).optional(),
    statement: z.string().max(160).optional(),
    columns: z
      .array(z.object({ heading: z.string().min(1).max(24), links: z.array(link).max(8) }))
      .max(5)
      .default([]),
    social: z.array(link).max(8).default([]),
    legal: z.string().max(160).optional(),

    // ── What it looks like ──────────────────────────────────────────────────
    layout: z.enum(footerLayouts).default('columns'),
    columnCount: z.enum(footerColumnCounts).default('auto'),
    headingCase: z.enum(textCases).default('uppercase'),
    linkStyle: z.enum(linkStyles).default('plain'),
    /*
      A separate row for the legal line and the social links. Off by default
      because a footer with three links does not need one, and a divider across
      an otherwise short block reads as an empty region rather than a structure.
    */
    bottomBar: z.boolean().default(false),
    border: z.enum(footerBorders).default('none'),
    ...sectionColorProps,
    align: z.enum(sectionAlignments).default('start'),
    tone: z.enum(sectionTones).default('transparent'),
    spacing: z.enum(sectionSpacings).default('lg'),
    width: z.enum(sectionWidths).default('wide'),
  }),
  propertyGroups: {
    brand: { tab: 'content', section: 'Brand' },
    statement: { tab: 'content', section: 'Brand' },
    columns: { tab: 'content', section: 'Links' },
    social: { tab: 'content', section: 'Social' },
    legal: { tab: 'content', section: 'Legal' },

    layout: { tab: 'design', section: 'Layout' },
    columnCount: { tab: 'design', section: 'Layout' },
    align: { tab: 'design', section: 'Layout' },
    width: { tab: 'design', section: 'Layout' },
    headingCase: { tab: 'design', section: 'Links' },
    linkStyle: { tab: 'design', section: 'Links' },
    ...sectionColorGroups,
    tone: { tab: 'design', section: 'Colour' },
    border: { tab: 'design', section: 'Edge' },
    spacing: { tab: 'design', section: 'Spacing' },

    bottomBar: { tab: 'advanced', section: 'Structure' },
  },
  examples: pageFooterExamples,
});

export type PageFooterProps = z.output<typeof pageFooterSchema.props>;
