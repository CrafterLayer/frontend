import { z } from 'zod';

import { defineBlockSchema } from '@craftkit/builder-schema';

import {
  sectionAlignments,
  sectionDirections,
  sectionSpacings,
  sectionTones,
  sectionWidths,
  sectionWraps,
} from '../section-options';
import { sectionColorGroups, sectionColorProps } from '../section-color';
import { sectionMotionGroups, sectionMotionProps } from '../section-motion';
import { sectionCustomGroups, sectionCustomProps } from '../section-custom';
import { sectionSpacingGroups, sectionSpacingProps } from '../section-spacing';
import { sectionTypographyGroups, sectionTypographyProps } from '../section-typography';
import { heroExamples } from './examples';

export const heroSchema = defineBlockSchema({
  type: 'hero',
  description:
    'Opening section at the top of a page: a large heading, optional supporting body, and up to two call-to-action buttons. Use once per page.',
  surfaces: ['site', 'store'],
  props: z.object({
    variant: z.enum(['centered', 'split', 'editorial']).default('centered'),
    eyebrow: z.string().min(1).max(60).optional(),
    heading: z.string().min(1).max(80).default('Your headline'),
    body: z.string().max(200).optional(),
    trustLine: z.string().min(1).max(120).optional(),
    align: z.enum(sectionAlignments).default('center'),
    tone: z.enum(sectionTones).default('light'),
    spacing: z.enum(sectionSpacings).default('lg'),
    width: z.enum(sectionWidths).default('full'),
    layoutDirection: z.enum(sectionDirections).optional(),
    layoutJustify: z.enum(sectionAlignments).optional(),
    layoutAlign: z.enum(sectionAlignments).optional(),
    layoutGap: z.enum(sectionSpacings).optional(),
    layoutWrap: z.enum(sectionWraps).optional(),
    ...sectionColorProps,
    ...sectionTypographyProps,
    ...sectionSpacingProps,
    ...sectionMotionProps,
    ...sectionCustomProps,
  }),
  propertyGroups: {
    variant: { tab: 'design', section: 'Layout' },
    eyebrow: { tab: 'content', section: 'Text' },
    heading: { tab: 'content', section: 'Text' },
    body: { tab: 'content', section: 'Text' },
    trustLine: { tab: 'content', section: 'Text' },
    layoutDirection: { tab: 'design', section: 'Layout' },
    layoutJustify: { tab: 'design', section: 'Layout' },
    layoutAlign: { tab: 'design', section: 'Layout' },
    layoutGap: { tab: 'design', section: 'Layout' },
    layoutWrap: { tab: 'design', section: 'Layout' },
    ...sectionColorGroups,
    ...sectionTypographyGroups,
    ...sectionSpacingGroups,
    ...sectionMotionGroups,
    ...sectionCustomGroups,
  },
  inlineEditable: 'heading',
  slots: {
    actions: { allow: ['cta', 'button'], max: 2 },
    media: { allow: ['image', 'grid', 'stack', 'richText'], max: 1 },
  },
  examples: heroExamples,
});

export type HeroProps = z.output<typeof heroSchema.props>;
