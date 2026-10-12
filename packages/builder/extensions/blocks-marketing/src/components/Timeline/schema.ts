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
import { timelineExamples } from './examples';

export const timelineLayouts = ['vertical', 'alternating'] as const;
export const timelineStatuses = ['done', 'upcoming'] as const;

/* What the Library card inserts: a short company story that ends in a plan. */
const defaultItems = [
  {
    date: '2019',
    title: 'Founded',
    description: 'Two founders, one prototype and a shared desk.',
    status: 'done' as const,
  },
  {
    date: '2021',
    title: 'First thousand customers',
    description: 'Word of mouth carried the product into three new cities.',
    status: 'done' as const,
  },
  {
    date: '2024',
    title: 'A second studio',
    description: 'A bigger team and a home for workshops.',
    badge: 'Milestone',
    status: 'done' as const,
  },
  {
    date: '2027',
    title: 'Launching across the region',
    description: 'New partners, new languages, the same care.',
    status: 'upcoming' as const,
  },
];

export const timelineSchema = defineBlockSchema({
  type: 'timeline',
  description:
    'A timeline of dated milestones as a semantic ordered list: company history, a product roadmap or an event agenda. Each item has a date (free text such as "2024", "Q3" or "09:30"), a title, an optional description and badge, and a status — `done` (filled marker) or `upcoming` (hollow marker, dashed connector). Vertical, or alternating on wide screens.',
  surfaces: ['site', 'store', 'docs'],
  props: z.object({
    eyebrow: z.string().min(1).max(40).optional(),
    heading: z.string().min(1).max(90).default('Our story'),
    body: z.string().min(1).max(240).optional(),
    items: z
      .array(
        z.object({
          date: z.string().min(1).max(40),
          title: z.string().min(1).max(90),
          description: z.string().min(1).max(280).optional(),
          badge: z.string().min(1).max(32).optional(),
          status: z.enum(timelineStatuses).default('done'),
        }),
      )
      .max(20)
      .default(defaultItems),
    layout: z.enum(timelineLayouts).default('vertical'),
    /* What a screen reader hears for each marker: the status is never colour alone. */
    doneLabel: z.string().min(1).max(40).default('Completed'),
    upcomingLabel: z.string().min(1).max(40).default('Upcoming'),
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
    items: { tab: 'content', section: 'Milestones' },
    layout: { tab: 'design', section: 'Layout' },
    doneLabel: { tab: 'advanced', section: 'Accessibility' },
    upcomingLabel: { tab: 'advanced', section: 'Accessibility' },
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
    The section's inner elements (block-parts DESIGN §1): the introduction, the
    list, each milestone and its date, title, description and badge. The status
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
    items: {
      kind: 'list',
      bind: 'items',
      label: { en: 'Milestones', ar: 'المحطات' },
      aliases: [
        'timeline',
        'events',
        'history',
        'roadmap',
        'agenda',
        'الأحداث',
        'المراحل',
        'الجدول الزمني',
      ],
    },
    item: {
      kind: 'item',
      bind: 'items.*',
      list: 'items',
      label: { en: 'Milestone', ar: 'المحطة' },
      aliases: ['event', 'step', 'entry', 'حدث', 'مرحلة'],
    },
    'item.date': {
      kind: 'text',
      bind: 'items.*.date',
      label: { en: 'Milestone date', ar: 'تاريخ المحطة' },
      aliases: ['date', 'year', 'time', 'when', 'التاريخ', 'السنة', 'الوقت'],
    },
    'item.title': {
      kind: 'text',
      bind: 'items.*.title',
      label: { en: 'Milestone title', ar: 'عنوان المحطة' },
      aliases: ['title', 'name', 'heading', 'العنوان', 'الاسم'],
    },
    'item.description': {
      kind: 'text',
      bind: 'items.*.description',
      label: { en: 'Milestone description', ar: 'وصف المحطة' },
      aliases: ['description', 'detail', 'text', 'الوصف', 'التفاصيل'],
      multiline: true,
    },
    'item.badge': {
      kind: 'text',
      bind: 'items.*.badge',
      label: { en: 'Milestone badge', ar: 'شارة المحطة' },
      aliases: ['badge', 'tag', 'label', 'شارة', 'وسم'],
    },
  },
  examples: timelineExamples,
});

export type TimelineProps = z.output<typeof timelineSchema.props>;
