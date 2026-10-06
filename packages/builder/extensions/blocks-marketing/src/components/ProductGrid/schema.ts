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
    body: { tab: 'content', section: 'Introduction', kind: 'multiline' },
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
  /*
    The section's inner elements (block-parts DESIGN §1): the introduction,
    the product list, each card, its image, badge, name, description and
    prices. `actionLabel` is one part shown on every card; `product.link` is
    the card's button, named by its label and the product name. The rating
    words are read only by assistive technology, so they stay Inspector rows.
  */
  parts: {
    eyebrow: {
      kind: 'text',
      bind: 'eyebrow',
      label: { en: 'Eyebrow', ar: 'الشارة' },
      aliases: ['badge', 'overline', 'kicker', 'شارة', 'العنوان الصغير'],
    },
    heading: {
      kind: 'text',
      bind: 'heading',
      label: { en: 'Heading', ar: 'العنوان' },
      aliases: ['title', 'headline', 'h2', 'عنوان', 'العنوان الرئيسي'],
    },
    body: {
      kind: 'text',
      bind: 'body',
      label: { en: 'Body', ar: 'الوصف' },
      aliases: ['intro', 'paragraph', 'description', 'text', 'وصف', 'الفقرة', 'النص'],
      multiline: true,
    },
    products: {
      kind: 'list',
      bind: 'products',
      label: { en: 'Products', ar: 'المنتجات' },
      aliases: ['items', 'cards', 'grid', 'catalogue', 'list', 'البطاقات', 'القائمة'],
    },
    product: {
      kind: 'item',
      bind: 'products.*',
      list: 'products',
      label: { en: 'Product', ar: 'المنتج' },
      aliases: ['card', 'item', 'product card', 'بطاقة', 'منتج'],
    },
    'product.image': {
      kind: 'image',
      bind: { src: 'products.*.imageSrc', alt: 'products.*.imageAlt' },
      label: { en: 'Product image', ar: 'صورة المنتج' },
      aliases: ['image', 'photo', 'picture', 'thumbnail', 'صورة', 'الصورة'],
    },
    'product.badge': {
      kind: 'text',
      bind: 'products.*.badge',
      label: { en: 'Product badge', ar: 'شارة المنتج' },
      aliases: ['badge', 'tag', 'label', 'sale', 'شارة', 'وسم'],
    },
    'product.name': {
      kind: 'text',
      bind: 'products.*.name',
      label: { en: 'Product name', ar: 'اسم المنتج' },
      aliases: ['name', 'title', 'h3', 'الاسم', 'العنوان'],
    },
    'product.description': {
      kind: 'text',
      bind: 'products.*.description',
      label: { en: 'Product description', ar: 'وصف المنتج' },
      aliases: ['description', 'card text', 'وصف', 'نص البطاقة'],
      multiline: true,
    },
    'product.price': {
      kind: 'text',
      bind: 'products.*.price',
      label: { en: 'Price', ar: 'السعر' },
      aliases: ['price', 'cost', 'سعر', 'الثمن'],
    },
    'product.originalPrice': {
      kind: 'text',
      bind: 'products.*.originalPrice',
      label: { en: 'Original price', ar: 'السعر الأصلي' },
      aliases: ['old price', 'was', 'compare at', 'السعر القديم'],
    },
    'product.link': {
      kind: 'link',
      bind: { text: 'products.*.name', href: 'products.*.href' },
      label: { en: 'Product link', ar: 'رابط المنتج' },
      aliases: ['link', 'button', 'action', 'cta', 'buy', 'رابط', 'الزر'],
    },
    actionLabel: {
      kind: 'text',
      bind: 'actionLabel',
      label: { en: 'Button label', ar: 'نص الزر' },
      aliases: ['button text', 'link text', 'cta text', 'نص الرابط'],
    },
  },
  examples: productGridExamples,
});

export type ProductGridProps = z.output<typeof productGridSchema.props>;
