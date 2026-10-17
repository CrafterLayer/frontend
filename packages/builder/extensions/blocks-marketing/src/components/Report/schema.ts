import { z } from 'zod';

import { defineBlockSchema } from '@craftkit/builder-schema';

import { chartHeights, chartPalettes, chartVariants } from '../Chart/schema';
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
import { reportExamples } from './examples';

/*
  The chart a report draws: every chart type that reads a whole table. A gauge
  (one value) is what the KPI cards already are, and a sparkline is a trend
  without its numbers, so neither is offered here.
*/
export const reportChartTypes = [
  'bar',
  'hbar',
  'line',
  'area',
  'combo',
  'scatter',
  'radar',
  'funnel',
  'pie',
  'donut',
] as const;
/* What a KPI card shows of its column: the last row (with its change), or the whole column. */
export const reportMeasures = ['last', 'total', 'average', 'max', 'min'] as const;
/* Which way a KPI's change is good: up for revenue, down for costs. */
export const reportDirections = ['up', 'down'] as const;

/* What the Library card inserts: four quarters, two columns, two KPIs — enough to read as a report. */
const defaultCategories = ['Q1', 'Q2', 'Q3', 'Q4'];
const defaultSeries = [
  { name: 'Revenue', values: [42, 58, 64, 81] },
  { name: 'Costs', values: [30, 34, 41, 38] },
];
const defaultKpis = [
  { label: 'Revenue', series: 0, measure: 'last' as const, better: 'up' as const },
  { label: 'Costs', series: 1, measure: 'last' as const, better: 'down' as const },
];

export const reportSchema = defineBlockSchema({
  type: 'report',
  description:
    'One dataset as a report section: `title`, `summary`, up to four KPI cards, one SVG chart and an optional table. `categories` label the rows; each of up to six `series` is a numeric column. A KPI names a column by index (`series`) and a `measure`: `last` (with its change against the previous row, coloured by `better`: up or down), `total`, `average`, `max` or `min`. `chartType`: bar, hbar, line, area, combo, scatter, radar, funnel, pie or donut.',
  surfaces: ['site', 'store', 'docs'],
  props: z.object({
    title: z.string().min(1).max(90).default('Quarterly report'),
    summary: z.string().min(1).max(320).optional(),
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
    valuePrefix: z.string().min(1).max(12).optional(),
    valueSuffix: z.string().min(1).max(12).optional(),
    kpis: z
      .array(
        z.object({
          label: z.string().min(1).max(40),
          series: z.number().int().min(0).max(5).default(0),
          measure: z.enum(reportMeasures).default('last'),
          better: z.enum(reportDirections).default('up'),
        }),
      )
      .max(4)
      .default(defaultKpis),
    /* Printed after every change: "▲ +12.5% vs previous". */
    changeLabel: z.string().min(1).max(40).default('vs previous'),
    chartType: z.enum(reportChartTypes).default('bar'),
    stacked: z.boolean().default(false),
    /* The slice a pie folds its smallest values into past eight slices. */
    otherLabel: z.string().min(1).max(24).default('Other'),
    showTable: z.boolean().default(true),
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
    summary: { tab: 'content', section: 'Text', kind: 'multiline' },
    categories: { tab: 'content', section: 'Data' },
    series: { tab: 'content', section: 'Data' },
    valuePrefix: { tab: 'content', section: 'Values' },
    valueSuffix: { tab: 'content', section: 'Values' },
    kpis: { tab: 'content', section: 'KPIs' },
    changeLabel: { tab: 'content', section: 'KPIs' },
    chartType: { tab: 'content', section: 'Chart' },
    stacked: { tab: 'content', section: 'Chart' },
    otherLabel: { tab: 'content', section: 'Values' },
    showTable: { tab: 'design', section: 'Display' },
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
    The report's inner elements (block-parts DESIGN §1): its title and summary,
    each KPI card with its label, the change label (one part, printed on every
    card that shows a change), and the chart's own parts under the chart's
    names — the category labels, the series and their names, the value prefix
    and suffix and the folded "other" slice — so the chart is drawn by the
    Chart block's own figures. The table repeats the categories and series
    names under the same parts. The numbers are Inspector rows.
  */
  parts: {
    title: {
      kind: 'text',
      bind: 'title',
      label: { en: 'Title', ar: 'العنوان' },
      aliases: ['heading', 'headline', 'report title', 'عنوان', 'عنوان التقرير'],
    },
    summary: {
      kind: 'text',
      bind: 'summary',
      label: { en: 'Summary', ar: 'الملخص' },
      aliases: ['description', 'subtitle', 'finding', 'وصف', 'الخلاصة'],
      multiline: true,
    },
    kpis: {
      kind: 'list',
      bind: 'kpis',
      label: { en: 'KPI cards', ar: 'بطاقات المؤشرات' },
      aliases: ['kpis', 'metrics', 'key numbers', 'المؤشرات', 'الأرقام الرئيسية'],
    },
    kpi: {
      kind: 'item',
      bind: 'kpis.*',
      list: 'kpis',
      label: { en: 'KPI card', ar: 'بطاقة مؤشر' },
      aliases: ['kpi', 'metric', 'card', 'مؤشر', 'بطاقة'],
    },
    'kpi.label': {
      kind: 'text',
      bind: 'kpis.*.label',
      label: { en: 'KPI label', ar: 'تسمية المؤشر' },
      aliases: ['metric name', 'kpi name', 'اسم المؤشر'],
    },
    changeLabel: {
      kind: 'text',
      bind: 'changeLabel',
      label: { en: 'Change label', ar: 'تسمية التغيّر' },
      aliases: ['vs previous', 'compared with', 'مقارنة بالسابق', 'عن الفترة السابقة'],
    },
    categories: {
      kind: 'list',
      bind: 'categories',
      label: { en: 'Categories', ar: 'الفئات' },
      aliases: ['rows', 'x axis', 'labels', 'months', 'الصفوف', 'التسميات'],
    },
    category: {
      kind: 'text',
      bind: 'categories.*',
      label: { en: 'Category', ar: 'الفئة' },
      aliases: ['row label', 'axis label', 'category label', 'فئة', 'تسمية'],
    },
    series: {
      kind: 'list',
      bind: 'series',
      label: { en: 'Data columns', ar: 'أعمدة البيانات' },
      aliases: ['columns', 'series', 'legend', 'datasets', 'الأعمدة', 'السلاسل'],
    },
    dataset: {
      kind: 'item',
      bind: 'series.*',
      list: 'series',
      label: { en: 'Data column', ar: 'عمود البيانات' },
      aliases: ['column', 'series', 'dataset', 'عمود', 'سلسلة'],
    },
    'dataset.name': {
      kind: 'text',
      bind: 'series.*.name',
      label: { en: 'Column name', ar: 'اسم العمود' },
      aliases: ['column heading', 'series name', 'legend label', 'اسم', 'العنوان'],
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
  },
  examples: reportExamples,
});

export type ReportProps = z.output<typeof reportSchema.props>;
