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
import { isValidTarget } from './countdown-time';
import { countdownExamples } from './examples';

export const countdownLanguages = ['en', 'ar'] as const;
export const countdownVariants = ['cards', 'minimal'] as const;

const safeHrefSchema = z
  .string()
  .min(1)
  .max(2000)
  .refine(
    (value) =>
      value.startsWith('#') ||
      (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) ||
      /^(https?:\/\/|mailto:|tel:)/i.test(value),
    { message: 'Action link must be relative or use http, https, mailto, or tel.' },
  );

export const countdownSchema = defineBlockSchema({
  type: 'countdown',
  description:
    'A launch or event countdown to `target`, an ISO 8601 date-time WITH its UTC offset (e.g. "2027-03-01T10:00:00+03:00"), with a `timezoneLabel` such as "Riyadh time". The published page shows the event date as text ("Starts Monday 1 March 2027 at 10:00") and, when scripts run, a live days/hours/minutes/seconds counter; once the moment passes it shows `endedMessage`. Optional call to action. Set `dateLanguage: "ar"` on Arabic pages.',
  surfaces: ['site', 'store'],
  props: z.object({
    eyebrow: z.string().min(1).max(40).optional(),
    heading: z.string().min(1).max(90).default('Doors open soon'),
    body: z.string().min(1).max(240).optional(),
    target: z
      .string()
      .max(40)
      .refine(isValidTarget, {
        message: 'Use an ISO date-time with its UTC offset, e.g. 2027-03-01T10:00:00+03:00.',
      })
      .default('2027-03-01T10:00:00+03:00'),
    timezoneLabel: z.string().min(1).max(40).optional(),
    dateLanguage: z.enum(countdownLanguages).default('en'),
    startsLabel: z.string().min(1).max(40).default('Starts'),
    endedMessage: z.string().min(1).max(160).default('We are live — welcome!'),
    daysLabel: z.string().min(1).max(20).default('Days'),
    hoursLabel: z.string().min(1).max(20).default('Hours'),
    minutesLabel: z.string().min(1).max(20).default('Minutes'),
    secondsLabel: z.string().min(1).max(20).default('Seconds'),
    showSeconds: z.boolean().default(true),
    /* What a screen reader hears before the coarse summary ("Time left: 12 Days"). */
    remainingLabel: z.string().min(1).max(40).default('Time left'),
    actionLabel: z.string().min(1).max(40).optional(),
    actionHref: safeHrefSchema.optional(),
    variant: z.enum(countdownVariants).default('cards'),
    align: z.enum(sectionAlignments).default('center'),
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
    target: { tab: 'content', section: 'Countdown' },
    timezoneLabel: { tab: 'content', section: 'Countdown' },
    dateLanguage: { tab: 'content', section: 'Countdown' },
    startsLabel: { tab: 'content', section: 'Countdown' },
    endedMessage: { tab: 'content', section: 'Countdown', kind: 'multiline' },
    daysLabel: { tab: 'content', section: 'Units' },
    hoursLabel: { tab: 'content', section: 'Units' },
    minutesLabel: { tab: 'content', section: 'Units' },
    secondsLabel: { tab: 'content', section: 'Units' },
    showSeconds: { tab: 'design', section: 'Countdown' },
    remainingLabel: { tab: 'advanced', section: 'Accessibility' },
    actionLabel: { tab: 'content', section: 'Action' },
    actionHref: { tab: 'content', section: 'Action' },
    variant: { tab: 'design', section: 'Countdown' },
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
    "Starts" word and the timezone label beside the date, each unit's label, the
    ended message (on the page from the start, shown once the moment passes),
    and the action. The target is a date-time, not text to edit in place, so it
    stays an Inspector row.
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
    startsLabel: {
      kind: 'text',
      bind: 'startsLabel',
      label: { en: 'Date lead-in', ar: 'تمهيد التاريخ' },
      aliases: ['starts', 'date label', 'يبدأ'],
    },
    timezoneLabel: {
      kind: 'text',
      bind: 'timezoneLabel',
      label: { en: 'Time zone', ar: 'المنطقة الزمنية' },
      aliases: ['timezone', 'time zone', 'zone', 'التوقيت', 'بتوقيت'],
    },
    daysLabel: {
      kind: 'text',
      bind: 'daysLabel',
      label: { en: 'Days label', ar: 'تسمية الأيام' },
      aliases: ['days', 'الأيام'],
    },
    hoursLabel: {
      kind: 'text',
      bind: 'hoursLabel',
      label: { en: 'Hours label', ar: 'تسمية الساعات' },
      aliases: ['hours', 'الساعات'],
    },
    minutesLabel: {
      kind: 'text',
      bind: 'minutesLabel',
      label: { en: 'Minutes label', ar: 'تسمية الدقائق' },
      aliases: ['minutes', 'الدقائق'],
    },
    secondsLabel: {
      kind: 'text',
      bind: 'secondsLabel',
      label: { en: 'Seconds label', ar: 'تسمية الثواني' },
      aliases: ['seconds', 'الثواني'],
    },
    endedMessage: {
      kind: 'text',
      bind: 'endedMessage',
      label: { en: 'Ended message', ar: 'رسالة الانتهاء' },
      aliases: ['ended', 'live', 'started', 'انتهى', 'بدأ'],
      multiline: true,
    },
    action: {
      kind: 'link',
      bind: { text: 'actionLabel', href: 'actionHref' },
      label: { en: 'Button', ar: 'الزر' },
      aliases: ['button', 'cta', 'action', 'link', 'register', 'زر', 'سجّل', 'الرابط'],
    },
  },
  examples: countdownExamples,
});

export type CountdownProps = z.output<typeof countdownSchema.props>;
