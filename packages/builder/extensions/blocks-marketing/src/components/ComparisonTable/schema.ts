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
  .refine(
    (value) =>
      value.startsWith('#') ||
      (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) ||
      /^(https?:\/\/|mailto:|tel:)/i.test(value),
    {
      message: 'Action link must be relative or use http, https, mailto, or tel.',
    },
  );

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
    body: { tab: 'content', section: 'Introduction', kind: 'multiline' },
    featureLabel: { tab: 'content', section: 'Comparison' },
    plans: { tab: 'content', section: 'Plans' },
    rows: { tab: 'content', section: 'Rows' },
    showActions: { tab: 'content', section: 'Plans' },
    emptyValue: { tab: 'content', section: 'Rows' },
    scrollLabel: { tab: 'advanced', section: 'Accessibility' },
    note: { tab: 'content', section: 'Footnote', kind: 'multiline' },
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
  /*
    The section's inner elements (block-parts DESIGN §1): the introduction,
    the plan columns with their badge, name, description, price, period and
    button, the rows with their feature name and each cell value, the empty
    cell text and the footnote. The scroll region's label is read only by
    assistive technology, so it stays an Inspector row.
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
    featureLabel: {
      kind: 'text',
      bind: 'featureLabel',
      label: { en: 'Feature column label', ar: 'عنوان عمود الميزات' },
      aliases: ['feature header', 'first column', 'column label', 'عمود الميزات'],
    },
    plans: {
      kind: 'list',
      bind: 'plans',
      label: { en: 'Plans', ar: 'الخطط' },
      aliases: ['columns', 'tiers', 'packages', 'الأعمدة', 'الباقات'],
    },
    plan: {
      kind: 'item',
      bind: 'plans.*',
      list: 'plans',
      label: { en: 'Plan', ar: 'الخطة' },
      aliases: ['column', 'tier', 'package', 'عمود', 'باقة'],
    },
    'plan.badge': {
      kind: 'text',
      bind: 'plans.*.badge',
      label: { en: 'Plan badge', ar: 'شارة الخطة' },
      aliases: ['badge', 'tag', 'popular', 'شارة', 'وسم'],
    },
    'plan.name': {
      kind: 'text',
      bind: 'plans.*.name',
      label: { en: 'Plan name', ar: 'اسم الخطة' },
      aliases: ['name', 'plan title', 'الاسم'],
    },
    'plan.description': {
      kind: 'text',
      bind: 'plans.*.description',
      label: { en: 'Plan description', ar: 'وصف الخطة' },
      aliases: ['description', 'summary', 'وصف'],
    },
    'plan.price': {
      kind: 'text',
      bind: 'plans.*.price',
      label: { en: 'Plan price', ar: 'سعر الخطة' },
      aliases: ['price', 'cost', 'سعر', 'الثمن'],
    },
    'plan.period': {
      kind: 'text',
      bind: 'plans.*.period',
      label: { en: 'Billing period', ar: 'فترة الدفع' },
      aliases: ['period', 'per month', 'billing', 'الفترة'],
    },
    'plan.action': {
      kind: 'link',
      bind: { text: 'plans.*.actionLabel', href: 'plans.*.actionHref' },
      label: { en: 'Plan button', ar: 'زر الخطة' },
      aliases: ['button', 'action', 'cta', 'link', 'زر', 'الزر', 'الرابط'],
    },
    rows: {
      kind: 'list',
      bind: 'rows',
      label: { en: 'Rows', ar: 'الصفوف' },
      aliases: ['features', 'table rows', 'الميزات', 'الجدول'],
    },
    row: {
      kind: 'item',
      bind: 'rows.*',
      list: 'rows',
      label: { en: 'Row', ar: 'الصف' },
      aliases: ['feature row', 'line', 'صف'],
    },
    'row.feature': {
      kind: 'text',
      bind: 'rows.*.feature',
      label: { en: 'Feature name', ar: 'اسم الميزة' },
      aliases: ['feature', 'row title', 'row header', 'الميزة'],
    },
    'row.value': {
      kind: 'text',
      bind: 'rows.*.values.*',
      label: { en: 'Cell value', ar: 'قيمة الخلية' },
      aliases: ['value', 'cell', 'الخلية', 'القيمة'],
    },
    emptyValue: {
      kind: 'text',
      bind: 'emptyValue',
      label: { en: 'Empty cell text', ar: 'نص الخلية الفارغة' },
      aliases: ['empty', 'missing value', 'dash', 'الفارغة'],
    },
    note: {
      kind: 'text',
      bind: 'note',
      label: { en: 'Footnote', ar: 'الحاشية' },
      aliases: ['footnote', 'fine print', 'note', 'ملاحظة', 'حاشية'],
      multiline: true,
    },
  },
  examples: comparisonTableExamples,
});

export type ComparisonTableProps = z.output<typeof comparisonTableSchema.props>;
