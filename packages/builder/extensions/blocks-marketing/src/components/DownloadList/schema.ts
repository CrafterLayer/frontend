import { z } from 'zod';

import { defineBlockSchema } from '@craftkit/builder-schema';

import { sectionColorProps } from '../section-color';
import { sectionCustomProps } from '../section-custom';
import { sectionDesignGroups, sectionIntroGroups, sectionIntroParts } from '../section-intro';
import { sectionMotionProps } from '../section-motion';
import {
  sectionAlignments,
  sectionSpacings,
  sectionTones,
  sectionWidths,
} from '../section-options';
import { sectionSpacingProps } from '../section-spacing';
import { sectionTypographyProps } from '../section-typography';
import { safeHrefSchema } from '../section-urls';
import { downloadListExamples } from './examples';

export const downloadListLayouts = ['list', 'cards'] as const;

const defaultFiles = [
  {
    title: 'Company profile',
    description: 'Who we are, what we do and who we do it for.',
    format: 'PDF',
    size: '3.2 MB',
    href: '#',
  },
  { title: 'Price list', format: 'PDF', size: '480 KB', href: '#' },
  {
    title: 'Brand kit',
    description: 'Logos, colours and type for partners and press.',
    format: 'ZIP',
    size: '18 MB',
    href: '#',
  },
];

export const downloadListSchema = defineBlockSchema({
  type: 'downloadList',
  description:
    'Downloadable files such as a company profile, a menu, a brochure or a report: each with a title, a short description, its format and size, and its own link.',
  surfaces: ['site', 'store', 'docs'],
  props: z.object({
    eyebrow: z.string().min(1).max(40).optional(),
    heading: z.string().min(1).max(90).default('Downloads'),
    body: z.string().min(1).max(240).optional(),
    files: z
      .array(
        z.object({
          title: z.string().min(1).max(90),
          description: z.string().min(1).max(160).optional(),
          format: z.string().min(1).max(8).optional(),
          size: z.string().min(1).max(16).optional(),
          href: safeHrefSchema,
        }),
      )
      .max(20)
      .default(defaultFiles),
    /* Shown beside every file; one part, edited once. */
    downloadLabel: z.string().min(1).max(24).default('Download'),
    layout: z.enum(downloadListLayouts).default('list'),
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
    ...sectionIntroGroups,
    files: { tab: 'content', section: 'Files' },
    downloadLabel: { tab: 'content', section: 'Files' },
    layout: { tab: 'design', section: 'Layout' },
    ...sectionDesignGroups,
  },
  inlineEditable: 'heading',
  parts: {
    ...sectionIntroParts,
    files: {
      kind: 'list',
      bind: 'files',
      label: { en: 'Files', ar: 'الملفات' },
      aliases: ['files', 'documents', 'downloads', 'resources', 'الملفات', 'المستندات'],
    },
    file: {
      kind: 'item',
      bind: 'files.*',
      list: 'files',
      label: { en: 'File', ar: 'الملف' },
      aliases: ['file', 'document', 'download', 'ملف', 'مستند'],
    },
    'file.title': {
      kind: 'link',
      bind: { text: 'files.*.title', href: 'files.*.href' },
      label: { en: 'File title', ar: 'اسم الملف' },
      aliases: ['title', 'name', 'link', 'الاسم', 'العنوان', 'الرابط'],
    },
    'file.description': {
      kind: 'text',
      bind: 'files.*.description',
      label: { en: 'File description', ar: 'وصف الملف' },
      aliases: ['description', 'summary', 'الوصف'],
    },
    'file.format': {
      kind: 'text',
      bind: 'files.*.format',
      label: { en: 'File format', ar: 'صيغة الملف' },
      aliases: ['format', 'type', 'pdf', 'الصيغة', 'النوع'],
    },
    'file.size': {
      kind: 'text',
      bind: 'files.*.size',
      label: { en: 'File size', ar: 'حجم الملف' },
      aliases: ['size', 'mb', 'kb', 'الحجم'],
    },
    downloadLabel: {
      kind: 'text',
      bind: 'downloadLabel',
      label: { en: 'Download label', ar: 'نص التحميل' },
      aliases: ['download', 'get', 'تحميل', 'تنزيل'],
    },
  },
  examples: downloadListExamples,
});

export type DownloadListProps = z.output<typeof downloadListSchema.props>;
