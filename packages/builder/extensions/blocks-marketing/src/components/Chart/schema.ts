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
import { chartExamples } from './examples';

export const chartTypes = ['bar', 'line', 'area', 'pie', 'donut'] as const;
/*
  Colour schemes, never colours: each names an ordered set of theme roles
  (chart-palette.ts), so a re-themed site repaints every chart it holds.
*/
export const chartPalettes = ['accent', 'mixed', 'mono', 'success'] as const;
export const chartHeights = ['sm', 'md', 'lg'] as const;
export const chartVariants = ['card', 'plain'] as const;

/* What the Library card inserts: four quarters, two series — enough to read as a chart. */
const defaultCategories = ['Q1', 'Q2', 'Q3', 'Q4'];
const defaultSeries = [
  { name: 'Revenue', values: [42, 58, 64, 81] },
  { name: 'Costs', values: [30, 34, 41, 45] },
];

export const chartSchema = defineBlockSchema({
  type: 'chart',
  description:
    'An accessible data chart drawn as SVG with no script: bar, line, area, pie or donut. `categories` label the x axis (or the slices); each of up to six `series` has a name and one number per category. Supports stacked bars and areas, legend, gridlines, value labels, a value prefix or suffix (such as $ or %), theme-colour palettes, and a screen-reader data table. Pie and donut plot the first series only.',
  surfaces: ['site', 'store', 'docs'],
  props: z.object({
    title: z.string().min(1).max(90).optional(),
    description: z.string().min(1).max(240).optional(),
    chartType: z.enum(chartTypes).default('bar'),
    categories: z.array(z.string().min(1).max(40)).max(24).default(defaultCategories),
    series: z
      .array(
        z.object({
          name: z.string().min(1).max(40),
          values: z.array(z.number()).max(24).default([]),
        }),
      )
      .max(6)
      .default(defaultSeries),
    stacked: z.boolean().default(false),
    valuePrefix: z.string().min(1).max(12).optional(),
    valueSuffix: z.string().min(1).max(12).optional(),
    /* The slice a pie folds its smallest values into past eight slices. */
    otherLabel: z.string().min(1).max(24).default('Other'),
    showLegend: z.boolean().default(true),
    showValues: z.boolean().default(false),
    showGrid: z.boolean().default(true),
    palette: z.enum(chartPalettes).default('accent'),
    height: z.enum(chartHeights).default('md'),
    variant: z.enum(chartVariants).default('card'),
    align: z.enum(sectionAlignments).default('start'),
    tone: z.enum(sectionTones).default('transparent'),
    spacing: z.enum(sectionSpacings).default('md'),
    width: z.enum(sectionWidths).default('wide'),
    ...sectionColorProps,
    ...sectionMotionProps,
    ...sectionCustomProps,
    ...sectionTypographyProps,
    ...sectionSpacingProps,
  }),
  propertyGroups: {
    title: { tab: 'content', section: 'Text' },
    description: { tab: 'content', section: 'Text', kind: 'multiline' },
    chartType: { tab: 'content', section: 'Chart' },
    categories: { tab: 'content', section: 'Data' },
    series: { tab: 'content', section: 'Data' },
    stacked: { tab: 'content', section: 'Chart' },
    valuePrefix: { tab: 'content', section: 'Values' },
    valueSuffix: { tab: 'content', section: 'Values' },
    otherLabel: { tab: 'content', section: 'Values' },
    showLegend: { tab: 'design', section: 'Display' },
    showValues: { tab: 'design', section: 'Display' },
    showGrid: { tab: 'design', section: 'Display' },
    palette: { tab: 'design', section: 'Chart' },
    height: { tab: 'design', section: 'Chart' },
    variant: { tab: 'design', section: 'Chart' },
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
  /*
    The chart's inner elements (block-parts DESIGN §1): its title and
    description, each category label (on the x axis, or in a pie's legend), the
    folded "other" slice's label, each series with its name (in the legend),
    and the value prefix and suffix — one part each, printed beside every
    number, hosted by the first. The numbers are Inspector rows: a value is a
    number, not text to edit in place.
  */
  parts: {
    title: {
      kind: 'text',
      bind: 'title',
      label: { en: 'Title', ar: 'العنوان' },
      aliases: ['heading', 'headline', 'chart title', 'عنوان', 'عنوان المخطط'],
    },
    description: {
      kind: 'text',
      bind: 'description',
      label: { en: 'Description', ar: 'الوصف' },
      aliases: ['subtitle', 'summary', 'caption', 'وصف', 'الملخص'],
      multiline: true,
    },
    categories: {
      kind: 'list',
      bind: 'categories',
      label: { en: 'Categories', ar: 'الفئات' },
      aliases: ['x axis', 'labels', 'months', 'slices', 'المحور الأفقي', 'التسميات'],
    },
    category: {
      kind: 'text',
      bind: 'categories.*',
      label: { en: 'Category', ar: 'الفئة' },
      aliases: ['category label', 'axis label', 'slice label', 'فئة', 'تسمية'],
    },
    series: {
      kind: 'list',
      bind: 'series',
      label: { en: 'Data series', ar: 'السلاسل' },
      aliases: ['legend', 'datasets', 'lines', 'bars', 'وسيلة الإيضاح', 'البيانات'],
    },
    dataset: {
      kind: 'item',
      bind: 'series.*',
      list: 'series',
      label: { en: 'Series', ar: 'السلسلة' },
      aliases: ['series', 'dataset', 'line', 'legend item', 'سلسلة', 'مجموعة بيانات'],
    },
    valuePrefix: {
      kind: 'text',
      bind: 'valuePrefix',
      label: { en: 'Value prefix', ar: 'بادئة القيمة' },
      aliases: ['prefix', 'currency', 'unit', 'البادئة', 'العملة'],
    },
    valueSuffix: {
      kind: 'text',
      bind: 'valueSuffix',
      label: { en: 'Value suffix', ar: 'لاحقة القيمة' },
      aliases: ['suffix', 'unit', 'percent', 'اللاحقة', 'الوحدة'],
    },
    otherLabel: {
      kind: 'text',
      bind: 'otherLabel',
      label: { en: 'Other slice label', ar: 'تسمية الشريحة الأخرى' },
      aliases: ['other', 'remaining', 'أخرى', 'البقية'],
    },
    'dataset.name': {
      kind: 'text',
      bind: 'series.*.name',
      label: { en: 'Series name', ar: 'اسم السلسلة' },
      aliases: ['series name', 'legend label', 'name', 'اسم', 'الاسم'],
    },
  },
  examples: chartExamples,
});

export type ChartProps = z.output<typeof chartSchema.props>;
