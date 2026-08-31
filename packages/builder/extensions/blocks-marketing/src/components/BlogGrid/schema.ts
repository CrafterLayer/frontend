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
import { blogGridExamples } from './examples';

export const blogGridVariants = ['cards', 'editorial', 'featured'] as const;
export const blogGridColumns = ['2', '3'] as const;

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
      message: 'Article link must be relative or use http, https, mailto, or tel.',
    },
  );

export const blogGridSchema = defineBlockSchema({
  type: 'blogGrid',
  description:
    'A responsive article collection with card, editorial, and featured layouts; optional imagery and structured publication metadata.',
  surfaces: ['site', 'store'],
  props: z.object({
    eyebrow: z.string().min(1).max(40).optional(),
    heading: z.string().min(1).max(80).default('Latest insights'),
    body: z.string().min(1).max(240).optional(),
    posts: z
      .array(
        z.object({
          title: z.string().min(1).max(100),
          excerpt: z.string().min(1).max(240),
          href: safeHrefSchema,
          category: z.string().min(1).max(40).optional(),
          author: z.string().min(1).max(60).optional(),
          publishedLabel: z.string().min(1).max(40).optional(),
          dateTime: z.string().min(1).max(40).optional(),
          readingTime: z.string().min(1).max(40).optional(),
          imageSrc: z.string().min(1).max(2000).optional(),
          imageAlt: z.string().max(160).optional(),
          featured: z.boolean().optional(),
        }),
      )
      .max(12)
      .default([]),
    actionLabel: z.string().min(1).max(40).default('Read article'),
    showImages: z.boolean().default(true),
    variant: z.enum(blogGridVariants).default('cards'),
    columns: z.enum(blogGridColumns).default('3'),
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
    posts: { tab: 'content', section: 'Articles' },
    actionLabel: { tab: 'content', section: 'Articles' },
    showImages: { tab: 'design', section: 'Media' },
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
  examples: blogGridExamples,
});

export type BlogGridProps = z.output<typeof blogGridSchema.props>;
