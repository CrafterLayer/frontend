import { z } from 'zod';

import { defineBlockSchema } from '@craftkit/builder-schema';

import { sectionColorGroups, sectionColorProps } from '../section-color';
import { sectionMotionGroups, sectionMotionProps } from '../section-motion';
// block-parts (2026-10-06): containers declare no parts, so they take no partStyles.
import { containerCustomGroups, containerCustomProps } from '../section-custom';
import {
  sectionAlignments,
  sectionSpacings,
  sectionTones,
  sectionWidths,
} from '../section-options';
import { pageHeaderExamples } from './examples';

/** How the start, center, and end slots are arranged. */
export const headerLayouts = ['split', 'centered', 'stacked', 'navStart'] as const;

/** The slot container's vertical generosity. */
export const headerDensities = ['compact', 'regular', 'tall'] as const;

export const headerBorders = ['none', 'bottom'] as const;
export const headerShadows = ['none', 'soft', 'strong'] as const;

/**
 * A page-level slot container rather than a prescribed masthead.
 *
 * The header owns only presentation. Its three regions accept composable
 * blocks, so authors can replace a wordmark, navigation row, action, or any
 * other content without changing this schema.
 */
export const pageHeaderSchema = defineBlockSchema({
  type: 'pageHeader',
  description:
    'A page header container with start, center, and end slots. Each slot holds composable content rather than prescribed branding, navigation, or actions.',
  surfaces: ['site', 'store', 'docs'],
  props: z.object({
    layout: z.enum(headerLayouts).default('split'),
    density: z.enum(headerDensities).default('regular'),
    border: z.enum(headerBorders).default('none'),
    shadow: z.enum(headerShadows).default('none'),
    ...sectionColorProps,
    ...sectionMotionProps,
    ...containerCustomProps,
    align: z.enum(sectionAlignments).default('start'),
    tone: z.enum(sectionTones).default('transparent'),
    spacing: z.enum(sectionSpacings).default('sm'),
    width: z.enum(sectionWidths).default('wide'),
    sticky: z.boolean().default(false),
    translucent: z.boolean().default(false),
  }),
  propertyGroups: {
    layout: { tab: 'design', section: 'Layout' },
    density: { tab: 'design', section: 'Layout' },
    align: { tab: 'design', section: 'Layout' },
    width: { tab: 'design', section: 'Layout' },
    ...sectionColorGroups,
    ...sectionMotionGroups,
    ...containerCustomGroups,
    tone: { tab: 'design', section: 'Colour' },
    border: { tab: 'design', section: 'Edge' },
    shadow: { tab: 'design', section: 'Edge' },
    spacing: { tab: 'design', section: 'Spacing' },
    sticky: { tab: 'advanced', section: 'Behaviour' },
    translucent: { tab: 'advanced', section: 'Behaviour' },
  },
  slots: {
    start: { allow: ['richText', 'cta', 'button', 'navLinks', 'stack'] },
    center: { allow: ['richText', 'cta', 'button', 'navLinks', 'stack'] },
    end: { allow: ['richText', 'cta', 'button', 'navLinks', 'stack'] },
  },
  examples: pageHeaderExamples,
});

export type PageHeaderProps = z.output<typeof pageHeaderSchema.props>;
