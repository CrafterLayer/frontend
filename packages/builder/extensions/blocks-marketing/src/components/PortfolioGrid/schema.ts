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
        'Project images must use http(s), a root-relative path, or a supported raster data URL.',
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
          imageSrc: safeWebImageSchema.optional(),
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
    body: { tab: 'content', section: 'Introduction', kind: 'multiline' },
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
  /*
    The section's inner elements (block-parts DESIGN §1): the introduction,
    the case-study list, each card, its lines, its image and its outcome
    metrics. `actionLabel` is one part shown on every card; `item.link` is the
    card's link, named by its label and the project title.
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
    items: {
      kind: 'list',
      bind: 'items',
      label: { en: 'Case studies', ar: 'دراسات الحالة' },
      aliases: ['projects', 'work', 'cards', 'grid', 'list', 'المشاريع', 'الأعمال', 'القائمة'],
    },
    item: {
      kind: 'item',
      bind: 'items.*',
      list: 'items',
      label: { en: 'Case study', ar: 'دراسة الحالة' },
      aliases: ['project', 'card', 'case', 'مشروع', 'بطاقة'],
    },
    'item.image': {
      kind: 'image',
      bind: { src: 'items.*.imageSrc', alt: 'items.*.imageAlt' },
      label: { en: 'Project image', ar: 'صورة المشروع' },
      aliases: ['image', 'photo', 'cover', 'thumbnail', 'صورة', 'الصورة'],
    },
    'item.category': {
      kind: 'text',
      bind: 'items.*.category',
      label: { en: 'Project category', ar: 'تصنيف المشروع' },
      aliases: ['category', 'tag', 'sector', 'تصنيف', 'وسم'],
    },
    'item.title': {
      kind: 'text',
      bind: 'items.*.title',
      label: { en: 'Project title', ar: 'عنوان المشروع' },
      aliases: ['card title', 'h3', 'عنوان البطاقة'],
    },
    'item.summary': {
      kind: 'text',
      bind: 'items.*.summary',
      label: { en: 'Project summary', ar: 'ملخص المشروع' },
      aliases: ['summary', 'card text', 'description', 'ملخص', 'نص البطاقة'],
      multiline: true,
    },
    'item.metrics': {
      kind: 'list',
      bind: 'items.*.metrics',
      label: { en: 'Project results', ar: 'نتائج المشروع' },
      aliases: ['metrics', 'results', 'outcomes', 'stats', 'النتائج', 'الأرقام'],
    },
    'item.metric': {
      kind: 'item',
      bind: 'items.*.metrics.*',
      list: 'item.metrics',
      label: { en: 'Result', ar: 'النتيجة' },
      aliases: ['metric', 'outcome', 'stat', 'رقم', 'نتيجة'],
    },
    'item.metric.value': {
      kind: 'text',
      bind: 'items.*.metrics.*.value',
      label: { en: 'Result value', ar: 'قيمة النتيجة' },
      aliases: ['value', 'number', 'figure', 'القيمة', 'الرقم'],
    },
    'item.metric.label': {
      kind: 'text',
      bind: 'items.*.metrics.*.label',
      label: { en: 'Result label', ar: 'وصف النتيجة' },
      aliases: ['metric label', 'caption', 'الوصف'],
    },
    'item.link': {
      kind: 'link',
      bind: { text: 'items.*.title', href: 'items.*.href' },
      label: { en: 'Case study link', ar: 'رابط دراسة الحالة' },
      aliases: ['link', 'action', 'cta', 'view', 'رابط', 'الرابط'],
    },
    actionLabel: {
      kind: 'text',
      bind: 'actionLabel',
      label: { en: 'Link label', ar: 'نص الرابط' },
      aliases: ['button text', 'link text', 'view text', 'نص الزر'],
    },
  },
  examples: portfolioGridExamples,
});

export type PortfolioGridProps = z.output<typeof portfolioGridSchema.props>;
