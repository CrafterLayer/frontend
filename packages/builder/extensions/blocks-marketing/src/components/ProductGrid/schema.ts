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
import { productGridExamples } from './examples';

export const productGridVariants = ['grid', 'featured'] as const;
export const productGridColumns = ['2', '3', '4'] as const;
export const productImageRatios = ['square', 'portrait'] as const;

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
      message: 'Product link must be relative or use http, https, mailto, or tel.',
    },
  );

const safeWebImageSchema = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .refine(
    (value) =>
      (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) ||
      /^https?:\/\//i.test(value) ||
      /^data:image\/(?:avif|gif|jpeg|png|webp);/i.test(value),
    {
      message:
        'Product images must use http(s), a root-relative path, or a supported raster data URL.',
    },
  );

export const productGridSchema = defineBlockSchema({
  type: 'productGrid',
  description:
    'A professional ecommerce product grid with imagery, prices, badges, ratings, review counts, safe calls to action, and a featured-product layout.',
  surfaces: ['site', 'store'],
  props: z.object({
    eyebrow: z.string().min(1).max(40).optional(),
    heading: z.string().min(1).max(80).default('Featured products'),
    body: z.string().min(1).max(240).optional(),
    products: z
      .array(
        z.object({
          name: z.string().min(1).max(100),
          description: z.string().min(1).max(220).optional(),
          price: z.string().min(1).max(40),
          originalPrice: z.string().min(1).max(40).optional(),
          imageSrc: safeWebImageSchema.optional(),
          imageAlt: z.string().max(160).optional(),
          badge: z.string().min(1).max(40).optional(),
          href: safeHrefSchema,
          rating: z.number().min(0).max(5).multipleOf(0.1).optional(),
          ratingLabel: z.string().min(1).max(100).optional(),
          reviewCount: z.number().int().min(0).max(999999).optional(),
          featured: z.boolean().optional(),
        }),
      )
      .max(12)
      .default([]),
    actionLabel: z.string().min(1).max(40).default('View product'),
    showRatings: z.boolean().default(true),
    ratingPrefix: z.string().min(1).max(30).default('Rated'),
    ratingSuffix: z.string().min(1).max(30).default('out of 5'),
    reviewCountLabel: z.string().min(1).max(30).default('reviews'),
    variant: z.enum(productGridVariants).default('grid'),
    columns: z.enum(productGridColumns).default('4'),
    imageRatio: z.enum(productImageRatios).default('square'),
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
    products: { tab: 'content', section: 'Products' },
    actionLabel: { tab: 'content', section: 'Product action' },
    showRatings: { tab: 'design', section: 'Ratings' },
    ratingPrefix: { tab: 'content', section: 'Rating labels' },
    ratingSuffix: { tab: 'content', section: 'Rating labels' },
    reviewCountLabel: { tab: 'content', section: 'Rating labels' },
    variant: { tab: 'design', section: 'Layout' },
    columns: { tab: 'design', section: 'Layout' },
    imageRatio: { tab: 'design', section: 'Media' },
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
  examples: productGridExamples,
});

export type ProductGridProps = z.output<typeof productGridSchema.props>;
