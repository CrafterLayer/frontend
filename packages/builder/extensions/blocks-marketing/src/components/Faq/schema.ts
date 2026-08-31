import { z } from 'zod';

import { defineBlockSchema } from '@craftkit/builder-schema';

import { sectionColorGroups, sectionColorProps } from '../section-color';
import { sectionCustomGroups, sectionCustomProps } from '../section-custom';
import { sectionMotionGroups, sectionMotionProps } from '../section-motion';
import {
  sectionAlignments,
  sectionSpacings,
  sectionTones,
  sectionWidths,
} from '../section-options';
import { sectionSpacingGroups, sectionSpacingProps } from '../section-spacing';
import { sectionTypographyGroups, sectionTypographyProps } from '../section-typography';
import { faqExamples } from './examples';

export const faqSchema = defineBlockSchema({
  type: 'faq',
  description:
    'An accessible frequently asked questions section with native disclosures, card or divided styling, and optional two-column layout.',
  surfaces: ['site', 'store', 'docs'],
  props: z.object({
    eyebrow: z.string().min(1).max(40).optional(),
    heading: z.string().min(1).max(100).default('Frequently asked questions'),
    body: z.string().min(1).max(240).optional(),
    items: z
      .array(
        z.object({
          question: z.string().min(1).max(140),
          answer: z.string().min(1).max(600),
        }),
      )
      .max(16)
      .default([]),
    layout: z.enum(['single', 'columns']).default('single'),
    variant: z.enum(['divided', 'cards']).default('divided'),
    openFirst: z.boolean().default(false),
    showNumbers: z.boolean().default(false),
    align: z.enum(sectionAlignments).default('start'),
    tone: z.enum(sectionTones).default('transparent'),
    spacing: z.enum(sectionSpacings).default('lg'),
    width: z.enum(sectionWidths).default('standard'),
    ...sectionColorProps,
    ...sectionMotionProps,
    ...sectionCustomProps,
    ...sectionTypographyProps,
    ...sectionSpacingProps,
  }),
  propertyGroups: {
    eyebrow: { tab: 'content', section: 'Text' },
    heading: { tab: 'content', section: 'Text' },
    body: { tab: 'content', section: 'Text' },
    items: { tab: 'content', section: 'Questions' },
    layout: { tab: 'design', section: 'Layout' },
    variant: { tab: 'design', section: 'Style' },
    openFirst: { tab: 'design', section: 'Behavior' },
    showNumbers: { tab: 'design', section: 'Style' },
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
  examples: faqExamples,
});

export type FaqProps = z.output<typeof faqSchema.props>;
