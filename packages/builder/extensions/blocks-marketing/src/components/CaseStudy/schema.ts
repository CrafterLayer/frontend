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
import { safeHrefSchema, safeImageSourceSchema } from '../section-urls';
import { caseStudyExamples } from './examples';

export const caseStudyMediaPositions = ['start', 'end'] as const;

const defaultMetrics = [
  { value: '32%', label: 'faster deliveries' },
  { value: '2×', label: 'repeat orders' },
  { value: '6 weeks', label: 'from kickoff to launch' },
];

const defaultPoints = [
  { label: 'Challenge', text: 'Three tools, no shared picture, and every change made by phone.' },
  { label: 'Approach', text: 'One live board for the team and automatic updates for customers.' },
  { label: 'Result', text: 'Faster service in two new cities without adding headcount.' },
];

export const caseStudySchema = defineBlockSchema({
  type: 'caseStudy',
  description:
    'A customer story: client name, challenge/approach/result points, headline metrics (value and label), a client quote and an image, with a link to the full story.',
  surfaces: ['site'],
  props: z.object({
    eyebrow: z.string().min(1).max(40).optional(),
    client: z.string().min(1).max(60).optional(),
    heading: z.string().min(1).max(110).default('How one team cut delivery times by a third'),
    body: z.string().min(1).max(280).optional(),
    metrics: z
      .array(z.object({ value: z.string().min(1).max(16), label: z.string().min(1).max(60) }))
      .max(4)
      .default(defaultMetrics),
    points: z
      .array(z.object({ label: z.string().min(1).max(30), text: z.string().min(1).max(280) }))
      .max(4)
      .default(defaultPoints),
    quote: z.string().min(1).max(280).optional(),
    quoteAuthor: z.string().min(1).max(60).optional(),
    quoteRole: z.string().min(1).max(80).optional(),
    imageSrc: safeImageSourceSchema.optional(),
    imageAlt: z.string().max(160).default(''),
    actionLabel: z.string().min(1).max(40).optional(),
    actionHref: safeHrefSchema.optional(),
    mediaPosition: z.enum(caseStudyMediaPositions).default('end'),
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
    client: { tab: 'content', section: 'Introduction' },
    metrics: { tab: 'content', section: 'Results' },
    points: { tab: 'content', section: 'Story' },
    quote: { tab: 'content', section: 'Quote', kind: 'multiline' },
    quoteAuthor: { tab: 'content', section: 'Quote' },
    quoteRole: { tab: 'content', section: 'Quote' },
    imageSrc: { tab: 'content', section: 'Image', kind: 'image' },
    imageAlt: { tab: 'content', section: 'Image' },
    actionLabel: { tab: 'content', section: 'Action' },
    actionHref: { tab: 'content', section: 'Action' },
    mediaPosition: { tab: 'design', section: 'Layout' },
    ...sectionDesignGroups,
  },
  inlineEditable: 'heading',
  parts: {
    ...sectionIntroParts,
    client: {
      kind: 'text',
      bind: 'client',
      label: { en: 'Client', ar: 'العميل' },
      aliases: ['client', 'customer', 'company', 'العميل', 'الشركة'],
    },
    metrics: {
      kind: 'list',
      bind: 'metrics',
      label: { en: 'Results', ar: 'النتائج' },
      aliases: ['metrics', 'results', 'numbers', 'stats', 'النتائج', 'الأرقام'],
    },
    metric: {
      kind: 'item',
      bind: 'metrics.*',
      list: 'metrics',
      label: { en: 'Result', ar: 'نتيجة' },
      aliases: ['metric', 'result', 'stat', 'نتيجة', 'رقم'],
    },
    'metric.value': {
      kind: 'text',
      bind: 'metrics.*.value',
      label: { en: 'Result value', ar: 'قيمة النتيجة' },
      aliases: ['value', 'number', 'figure', 'القيمة', 'الرقم'],
    },
    'metric.label': {
      kind: 'text',
      bind: 'metrics.*.label',
      label: { en: 'Result label', ar: 'وصف النتيجة' },
      aliases: ['label', 'caption', 'الوصف', 'التسمية'],
    },
    points: {
      kind: 'list',
      bind: 'points',
      label: { en: 'Story', ar: 'القصة' },
      aliases: ['story', 'points', 'challenge', 'solution', 'القصة', 'التحدي', 'الحل'],
    },
    'point.label': {
      kind: 'text',
      bind: 'points.*.label',
      label: { en: 'Story step', ar: 'مرحلة القصة' },
      aliases: ['challenge', 'approach', 'result', 'التحدي', 'الحل', 'النتيجة'],
    },
    'point.text': {
      kind: 'text',
      bind: 'points.*.text',
      label: { en: 'Story text', ar: 'نص القصة' },
      aliases: ['text', 'description', 'detail', 'النص', 'التفاصيل'],
      multiline: true,
    },
    quote: {
      kind: 'text',
      bind: 'quote',
      label: { en: 'Client quote', ar: 'اقتباس العميل' },
      aliases: ['quote', 'testimonial', 'اقتباس', 'شهادة'],
      multiline: true,
    },
    quoteAuthor: {
      kind: 'text',
      bind: 'quoteAuthor',
      label: { en: 'Quote author', ar: 'صاحب الاقتباس' },
      aliases: ['author', 'name', 'الاسم'],
    },
    quoteRole: {
      kind: 'text',
      bind: 'quoteRole',
      label: { en: 'Quote role', ar: 'منصب صاحب الاقتباس' },
      aliases: ['role', 'title', 'position', 'المنصب'],
    },
    image: {
      kind: 'image',
      bind: { src: 'imageSrc', alt: 'imageAlt' },
      label: { en: 'Image', ar: 'الصورة' },
      aliases: ['image', 'photo', 'picture', 'صورة'],
    },
    action: {
      kind: 'link',
      bind: { text: 'actionLabel', href: 'actionHref' },
      label: { en: 'Link', ar: 'الرابط' },
      aliases: ['button', 'link', 'read more', 'full story', 'الرابط', 'اقرأ المزيد'],
    },
  },
  examples: caseStudyExamples,
});

export type CaseStudyProps = z.output<typeof caseStudySchema.props>;
