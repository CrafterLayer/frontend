import { z } from 'zod';

import { defineBlockSchema } from '@craftkit/builder-schema';

import {
  sectionAlignments,
  sectionSpacings,
  sectionTones,
  sectionWidths,
} from '../section-options';
import { sectionColorGroups, sectionColorProps } from '../section-color';
import { sectionSpacingGroups, sectionSpacingProps } from '../section-spacing';
import { sectionTypographyGroups, sectionTypographyProps } from '../section-typography';
import { pricingExamples } from './examples';

export const pricingSchema = defineBlockSchema({
  type: 'pricing',
  description:
    'Pricing plans side by side: each plan has a name, price text, billing period, a feature list, and may be highlighted as recommended.',
  surfaces: ['site', 'store'],
  props: z.object({
    heading: z.string().min(1).max(80).default('Pricing'),
    body: z.string().min(1).max(200).optional(),
    plans: z
      .array(
        z.object({
          name: z.string().min(1).max(40),
          price: z.string().min(1).max(20),
          period: z.enum(['month', 'year']),
          features: z.array(z.string().min(1).max(80)).max(8),
          highlighted: z.boolean().optional(),
        }),
      )
      .max(4)
      .default([]),
    columns: z.enum(['auto', '2', '3', '4']).default('auto'),
    align: z.enum(sectionAlignments).default('start'),
    tone: z.enum(sectionTones).default('transparent'),
    spacing: z.enum(sectionSpacings).default('md'),
    width: z.enum(sectionWidths).default('full'),
    ...sectionColorProps,
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
    heading: { tab: 'content', section: 'Text' },
    body: { tab: 'content', section: 'Text' },
    plans: { tab: 'content', section: 'Plans' },
    columns: { tab: 'design', section: 'Layout' },
    align: { tab: 'design', section: 'Alignment' },
    tone: { tab: 'design', section: 'Colour' },
    spacing: { tab: 'design', section: 'Spacing' },
    width: { tab: 'design', section: 'Width' },
    ...sectionColorGroups,
    ...sectionTypographyGroups,
    ...sectionSpacingGroups,
  },
  inlineEditable: 'heading',
  examples: pricingExamples,
});

export type PricingProps = z.output<typeof pricingSchema.props>;
