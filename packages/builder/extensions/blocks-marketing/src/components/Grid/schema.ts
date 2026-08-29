import { z } from 'zod';

import { defineBlockSchema } from '@craftkit/builder-schema';

import { sectionColorGroups, sectionColorProps } from '../section-color';
import {
  sectionAlignments,
  sectionSpacings,
  sectionTones,
  sectionWidths,
} from '../section-options';
import { gridExamples } from './examples';

/**
 * The same explicit composition vocabulary used by the sibling layout
 * container, with Grid itself included so grids can be nested.
 */
const GRID_CHILDREN = [
  'stack',
  'grid',
  'hero',
  'features',
  'pricing',
  'testimonials',
  'cta',
  'richText',
  'navLinks',
] as const;

export const gridSchema = defineBlockSchema({
  type: 'grid',
  description:
    'A responsive grid layout container. Holds other blocks in up to one, two, three, four or six columns and drops columns as its available width narrows.',
  surfaces: ['site', 'store', 'docs'],
  props: z.object({
    columns: z.enum(['1', '2', '3', '4', '6']).default('3'),
    gap: z.enum(sectionSpacings).default('md'),
    align: z.enum(sectionAlignments).default('start'),
    justify: z.enum(sectionAlignments).default('start'),
    flow: z.enum(['row', 'dense']).default('row'),
    tone: z.enum(sectionTones).default('transparent'),
    spacing: z.enum(sectionSpacings).default('none'),
    width: z.enum(sectionWidths).default('standard'),
    ...sectionColorProps,
  }),
  propertyGroups: {
    columns: { tab: 'design', section: 'Layout' },
    gap: { tab: 'design', section: 'Layout' },
    align: { tab: 'design', section: 'Layout' },
    justify: { tab: 'design', section: 'Layout' },
    flow: { tab: 'advanced', section: 'Layout' },
    tone: { tab: 'design', section: 'Colour' },
    spacing: { tab: 'design', section: 'Spacing' },
    width: { tab: 'design', section: 'Width' },
    ...sectionColorGroups,
  },
  slots: { default: { allow: [...GRID_CHILDREN] } },
  examples: gridExamples,
});

export type GridProps = z.output<typeof gridSchema.props>;
