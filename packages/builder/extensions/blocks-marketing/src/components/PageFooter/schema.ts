import { z } from 'zod';

import { defineBlockSchema } from '@craftkit/builder-schema';

import { sectionColorGroups, sectionColorProps } from '../section-color';
import { sectionMotionGroups, sectionMotionProps } from '../section-motion';
import { sectionCustomGroups, sectionCustomProps } from '../section-custom';
import {
  sectionAlignments,
  sectionSpacings,
  sectionTones,
  sectionWidths,
} from '../section-options';
import { pageFooterExamples } from './examples';

/**
 * The page's footer container.
 *
 * Content belongs to slots, never to typed footer properties. That keeps the
 * footer composable: either region may hold text, actions, navigation, or a
 * nested layout, and an author can replace those children without changing the
 * container's schema.
 *
 * Colour remains a ROLE and size remains an ENUM. A footer holding `#111827` is
 * a footer that cannot be re-themed; one holding `surfaceInverse` follows the
 * site wherever the theme goes.
 */

/** How the body and bottom slots are arranged when they share the main flow. */
export const footerLayouts = ['columns', 'centered', 'split'] as const;

export const footerBorders = ['none', 'top'] as const;

export const pageFooterSchema = defineBlockSchema({
  type: 'pageFooter',
  description:
    'A two-region footer container. The body and bottom slots accept text, actions, navigation, and nested layouts without prescribing their content.',
  surfaces: ['site', 'store', 'docs'],
  props: z.object({
    layout: z.enum(footerLayouts).default('columns'),
    border: z.enum(footerBorders).default('none'),
    ...sectionColorProps,
    ...sectionMotionProps,
    ...sectionCustomProps,
    align: z.enum(sectionAlignments).default('start'),
    tone: z.enum(sectionTones).default('transparent'),
    spacing: z.enum(sectionSpacings).default('lg'),
    width: z.enum(sectionWidths).default('wide'),
    /** Draw the bottom slot in its own ruled row instead of the body flow. */
    bottomBar: z.boolean().default(false),
  }),
  propertyGroups: {
    layout: { tab: 'design', section: 'Layout' },
    align: { tab: 'design', section: 'Layout' },
    width: { tab: 'design', section: 'Layout' },
    ...sectionColorGroups,
    ...sectionMotionGroups,
    ...sectionCustomGroups,
    tone: { tab: 'design', section: 'Colour' },
    border: { tab: 'design', section: 'Edge' },
    spacing: { tab: 'design', section: 'Spacing' },
    bottomBar: { tab: 'advanced', section: 'Structure' },
  },
  slots: {
    default: { allow: ['richText', 'cta', 'button', 'navLinks', 'stack'] },
    bottom: { allow: ['richText', 'cta', 'button', 'navLinks', 'stack'] },
  },
  examples: pageFooterExamples,
});

export type PageFooterProps = z.output<typeof pageFooterSchema.props>;
