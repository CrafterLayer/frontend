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
import { comparisonTableExamples } from './examples';

export const comparisonTableVariants = ['boxed', 'minimal', 'contrast'] as const;

const safeHrefSchema = z
  .string()
  .min(1)
  .max(2000)
  .refine((value) => /^(#|\/|https?:\/\/|mailto:|tel:)/i.test(value), {
    message: 'Action link must be relative or use http, https, mailto, or tel.',
  });

export const comparisonTableSchema = defineBlockSchema({
  type: 'comparisonTable',
  description:
    'A semantic plan or product comparison table with optional prices, badges, calls to action, highlighted rows, and featured columns.',
  surfaces: ['site', 'store'],
  props: z.object({
    eyebrow: z.string().min(1).max(40).optional(),
    heading: z.string().min(1).max(80).default('Compare plans'),
    body: z.string().min(1).max(240).optional(),
    featureLabel: z.string().min(1).max(40).default('Features'),
    plans: z
      .array(
        z.object({
          name: z.string().min(1).max(40),
          description: z.string().min(1).max(120).optional(),
          price: z.string().min(1).max(32).optional(),
          period: z.string().min(1).max(32).optional(),
          badge: z.string().min(1).max(32).optional(),
          actionLabel: z.string().min(1).max(40).optional(),
          actionHref: safeHrefSchema.optional(),
          featured: z.boolean().optional(),
        }),
      )
      .max(4)
      .default([]),
    rows: z
      .array(
        z.object({
          feature: z.string().min(1).max(80),
          values: z.array(z.string().max(100)).max(4).default([]),
          highlight: z.boolean().optional(),
        }),
      )
      .max(16)
      .default([]),
    showActions: z.boolean().default(true),
    emptyValue: z.string().max(20).default('—'),
    scrollLabel: z.string().min(1).max(80).default('Scrollable plan comparison'),
    note: z.string().min(1).max(200).optional(),
    variant: z.enum(comparisonTableVariants).default('boxed'),
    align: z.enum(sectionAlignments).default('start'),
    tone: z.enum(sectionTones).default('transparent'),
    spacing: z.enum(sectionSpacings).default('lg'),
    width: z.enum(sectionWidths).default('wide'),
    ...sectionColorProps,
    ...sectionMotionProps,
    ...sectionCustomProps,
    ...sectionTypographyProps,
    ...sectionSpacingProps,
  }),
  propertyGroups: {
    eyebrow: { tab: 'content', section: 'Introduction' },
    heading: { tab: 'content', section: 'Introduction' },
    body: { tab: 'content', section: 'Introduction' },
    featureLabel: { tab: 'content', section: 'Comparison' },
    plans: { tab: 'content', section: 'Plans' },
    rows: { tab: 'content', section: 'Rows' },
    showActions: { tab: 'content', section: 'Plans' },
    emptyValue: { tab: 'content', section: 'Rows' },
    scrollLabel: { tab: 'advanced', section: 'Accessibility' },
    note: { tab: 'content', section: 'Footnote' },
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
  examples: comparisonTableExamples,
});

export type ComparisonTableProps = z.output<typeof comparisonTableSchema.props>;
