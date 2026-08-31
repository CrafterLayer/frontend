import { z } from 'zod';

import { defineBlockSchema } from '@craftkit/builder-schema';

import {
  sectionAlignments,
  sectionSpacings,
  sectionTones,
  sectionWidths,
} from '../section-options';
import { sectionColorGroups, sectionColorProps } from '../section-color';
import { sectionMotionGroups, sectionMotionProps } from '../section-motion';
import { sectionCustomGroups, sectionCustomProps } from '../section-custom';
import { sectionSpacingGroups, sectionSpacingProps } from '../section-spacing';
import { sectionTypographyGroups, sectionTypographyProps } from '../section-typography';
import { featuresExamples } from './examples';

export const featuresSchema = defineBlockSchema({
  type: 'features',
  description:
    'A grid of product feature cards, each with a short title and one-sentence body. One to four columns.',
  surfaces: ['site', 'store'],
  props: z.object({
    eyebrow: z.string().min(1).max(60).optional(),
    heading: z.string().min(1).max(80).default('Features'),
    body: z.string().min(1).max(200).optional(),
    items: z
      .array(
        z.object({
          icon: z.string().min(1).max(8).optional(),
          kicker: z.string().min(1).max(40).optional(),
          title: z.string().min(1).max(60),
          body: z.string().min(1).max(160),
        }),
      )
      .default([]),
    columns: z.enum(['1', '2', '3', '4']).default('3'),
    variant: z.enum(['cards', 'bordered', 'minimal']).default('cards'),
    align: z.enum(sectionAlignments).default('start'),
    tone: z.enum(sectionTones).default('transparent'),
    spacing: z.enum(sectionSpacings).default('md'),
    width: z.enum(sectionWidths).default('full'),
    ...sectionColorProps,
    ...sectionMotionProps,
    ...sectionCustomProps,
    ...sectionTypographyProps,
    ...sectionSpacingProps,
  }),
  /*
    Where each property appears in the inspector, declared by the BLOCK.
    
    The inspector never guesses this from a property's name or type — a tab
    strip that sorts rows by an invented rule is the same lie as a tab that does
    nothing. The split follows what a person is DOING: writing the page,
    shaping it, or making a rare structural choice.
  */
  propertyGroups: {
    eyebrow: { tab: 'content', section: 'Text' },
    heading: { tab: 'content', section: 'Text' },
    body: { tab: 'content', section: 'Text' },
    items: { tab: 'content', section: 'Items' },
    columns: { tab: 'design', section: 'Layout' },
    variant: { tab: 'design', section: 'Layout' },
    align: { tab: 'design', section: 'Alignment' },
    tone: { tab: 'design', section: 'Colour' },
    spacing: { tab: 'design', section: 'Spacing' },
    width: { tab: 'design', section: 'Width' },
    ...sectionColorGroups,
    ...sectionMotionGroups,
    ...sectionCustomGroups,
    ...sectionTypographyGroups,
    ...sectionSpacingGroups,
  },
  inlineEditable: 'heading',
  examples: featuresExamples,
});

export type FeaturesProps = z.output<typeof featuresSchema.props>;
