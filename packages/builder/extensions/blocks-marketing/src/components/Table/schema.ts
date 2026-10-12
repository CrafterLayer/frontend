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
import { tableExamples } from './examples';

export const tableColumnAligns = ['start', 'center', 'end'] as const;
export const tableDensities = ['comfortable', 'compact'] as const;
export const tableVariants = ['boxed', 'minimal'] as const;

/*
  The sample a person sees when the card is inserted from the Library: three
  columns and four rows, the last column numeric and aligned to the end. A
  table that inserts empty teaches nothing about what it is for.
*/
const defaultColumns = [
  { label: 'Service', align: 'start' as const },
  { label: 'Duration', align: 'start' as const },
  { label: 'Price', align: 'end' as const },
];

const defaultRows = [
  { cells: ['Consultation', '30 min', '$40'] },
  { cells: ['Full assessment', '60 min', '$90'] },
  { cells: ['Follow-up visit', '20 min', '$25'] },
  { cells: ['Group workshop', '90 min', '$15'] },
];

export const tableSchema = defineBlockSchema({
  type: 'table',
  description:
    'A semantic data table: column headers, optional row headers in the first column, an optional heading and caption, per-column text alignment, striped or compact rows, and a labelled horizontal scroll region on narrow screens. Use it for schedules, price lists, specifications, opening hours and any rows-and-columns data; use comparisonTable for plan-versus-plan pricing.',
  surfaces: ['site', 'store', 'docs'],
  props: z.object({
    title: z.string().min(1).max(90).optional(),
    caption: z.string().min(1).max(160).optional(),
    columns: z
      .array(
        z.object({
          label: z.string().min(1).max(60),
          align: z.enum(tableColumnAligns).default('start'),
        }),
      )
      .max(8)
      .default(defaultColumns),
    rows: z
      .array(
        z.object({
          cells: z.array(z.string().max(160)).max(8).default([]),
        }),
      )
      .max(50)
      .default(defaultRows),
    headerRow: z.boolean().default(true),
    firstColumnIsHeader: z.boolean().default(true),
    striped: z.boolean().default(false),
    density: z.enum(tableDensities).default('comfortable'),
    variant: z.enum(tableVariants).default('boxed'),
    scrollLabel: z.string().min(1).max(80).default('Scrollable table'),
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
    caption: { tab: 'content', section: 'Text', kind: 'multiline' },
    columns: { tab: 'content', section: 'Columns' },
    rows: { tab: 'content', section: 'Rows' },
    headerRow: { tab: 'content', section: 'Table' },
    firstColumnIsHeader: { tab: 'content', section: 'Table' },
    striped: { tab: 'design', section: 'Table' },
    density: { tab: 'design', section: 'Table' },
    variant: { tab: 'design', section: 'Table' },
    scrollLabel: { tab: 'advanced', section: 'Accessibility' },
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
    The table's inner elements (block-parts DESIGN §1): the heading, the
    caption, each column header and its label, each row and every cell. A cell
    is addressed by row and column (`row.cell@2.1` is the third row's second
    cell). The scroll region's label is read only by assistive technology, so
    it stays an Inspector row.
  */
  parts: {
    title: {
      kind: 'text',
      bind: 'title',
      label: { en: 'Heading', ar: 'العنوان' },
      aliases: ['title', 'heading', 'headline', 'h2', 'عنوان', 'عنوان الجدول'],
    },
    caption: {
      kind: 'text',
      bind: 'caption',
      label: { en: 'Caption', ar: 'التعليق' },
      aliases: ['caption', 'note', 'footnote', 'summary', 'تعليق', 'ملاحظة', 'وصف الجدول'],
      multiline: true,
    },
    columns: {
      kind: 'list',
      bind: 'columns',
      label: { en: 'Columns', ar: 'الأعمدة' },
      aliases: ['header row', 'headers', 'column headers', 'صف العناوين', 'رؤوس الأعمدة'],
    },
    column: {
      kind: 'item',
      bind: 'columns.*',
      list: 'columns',
      label: { en: 'Column', ar: 'العمود' },
      aliases: ['column', 'header', 'عمود', 'رأس العمود'],
    },
    'column.label': {
      kind: 'text',
      bind: 'columns.*.label',
      label: { en: 'Column heading', ar: 'عنوان العمود' },
      aliases: ['column name', 'header text', 'th', 'اسم العمود'],
    },
    rows: {
      kind: 'list',
      bind: 'rows',
      label: { en: 'Rows', ar: 'الصفوف' },
      aliases: ['body', 'table rows', 'data', 'البيانات', 'صفوف الجدول'],
    },
    row: {
      kind: 'item',
      bind: 'rows.*',
      list: 'rows',
      label: { en: 'Row', ar: 'الصف' },
      aliases: ['row', 'line', 'record', 'صف', 'سطر'],
    },
    'row.cell': {
      kind: 'text',
      bind: 'rows.*.cells.*',
      label: { en: 'Cell', ar: 'الخلية' },
      aliases: ['cell', 'value', 'td', 'خلية', 'القيمة'],
    },
  },
  examples: tableExamples,
});

export type TableProps = z.output<typeof tableSchema.props>;
