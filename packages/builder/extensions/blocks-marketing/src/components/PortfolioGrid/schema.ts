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
import { portfolioGridExamples } from './examples';

export const portfolioGridVariants = ['grid', 'editorial'] as const;
export const portfolioGridColumns = ['2', '3'] as const;

const safeHrefSchema = z
  .string()
  .min(1)
  .max(2000)
  .refine(
    (value) =>
      value.startsWith('#') ||
      (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) ||
      /^(https?:\/\/|mailto:|tel:)/i.test(value),
    {
      message: 'Case-study link must be relative or use http, https, mailto, or tel.',
    },
  );

export const portfolioGridSchema = defineBlockSchema({
  type: 'portfolioGrid',
  description:
    'A premium portfolio section with project imagery, category, summary, outcome metrics, and safe case-study links in grid or editorial layouts.',
  surfaces: ['site', 'store'],
  props: z.object({
    eyebrow: z.string().min(1).max(40).optional(),
    heading: z.string().min(1).max(80).default('Selected work'),
    body: z.string().min(1).max(240).optional(),
    items: z
      .array(
        z.object({
          category: z.string().min(1).max(50),
          title: z.string().min(1).max(100),
          summary: z.string().min(1).max(260),
          imageSrc: z.string().min(1).max(2000).optional(),
          imageAlt: z.string().max(160).optional(),
          href: safeHrefSchema,
          metrics: z
            .array(
              z.object({
                label: z.string().min(1).max(50),
                value: z.string().min(1).max(40),
              }),
            )
            .max(3)
            .default([]),
        }),
      )
      .max(12)
      .default([]),
    actionLabel: z.string().min(1).max(40).default('View case study'),
    showMetrics: z.boolean().default(true),
    variant: z.enum(portfolioGridVariants).default('grid'),
    columns: z.enum(portfolioGridColumns).default('3'),
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
    items: { tab: 'content', section: 'Case studies' },
    actionLabel: { tab: 'content', section: 'Case studies' },
    showMetrics: { tab: 'design', section: 'Content' },
    variant: { tab: 'design', section: 'Layout' },
    columns: { tab: 'design', section: 'Layout' },
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
  examples: portfolioGridExamples,
});

export type PortfolioGridProps = z.output<typeof portfolioGridSchema.props>;
