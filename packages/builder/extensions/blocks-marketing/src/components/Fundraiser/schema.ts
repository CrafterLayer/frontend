import { z } from 'zod';

import { defineBlockSchema } from '@craftkit/builder-schema';

import { sectionColorProps } from '../section-color';
import { sectionCustomProps } from '../section-custom';
import { sectionDesignGroups, sectionIntroGroups, sectionIntroParts } from '../section-intro';
import { sectionMotionProps } from '../section-motion';
import { numberLanguages } from '../section-numbers';
import {
  sectionAlignments,
  sectionSpacings,
  sectionTones,
  sectionWidths,
} from '../section-options';
import { sectionSpacingProps } from '../section-spacing';
import { sectionTypographyProps } from '../section-typography';
import { safeHrefSchema, safeImageSourceSchema } from '../section-urls';
import { fundraiserExamples } from './examples';

export const fundraiserLayouts = ['card', 'split'] as const;
export const fundraiserCurrencyPositions = ['before', 'after'] as const;

const MAX_AMOUNT = 1_000_000_000_000;

export const fundraiserSchema = defineBlockSchema({
  type: 'fundraiser',
  description:
    'A fundraising or crowdfunding goal: the amount raised against the goal as a progress bar, supporter stats, preset amount links, a donate button and an optional photo.',
  surfaces: ['site'],
  props: z.object({
    eyebrow: z.string().min(1).max(40).optional(),
    heading: z.string().min(1).max(90).default('Help us reach our goal'),
    body: z.string().min(1).max(240).optional(),
    raised: z.number().min(0).max(MAX_AMOUNT).default(68250),
    goal: z.number().positive().max(MAX_AMOUNT).default(100000),
    /* Shown beside both amounts; one part, edited once. */
    currency: z.string().min(1).max(8).default('$'),
    currencyPosition: z.enum(fundraiserCurrencyPositions).default('before'),
    raisedLabel: z.string().min(1).max(30).default('raised of'),
    goalLabel: z.string().min(1).max(30).default('goal'),
    numberLanguage: z.enum(numberLanguages).default('en'),
    /* The progress bar's accessible name: heard, not seen. */
    progressLabel: z.string().min(1).max(60).default('Funding progress'),
    stats: z
      .array(z.object({ value: z.string().min(1).max(16), label: z.string().min(1).max(40) }))
      .max(3)
      .default([
        { value: '1,204', label: 'donors' },
        { value: '18', label: 'days left' },
      ]),
    amounts: z
      .array(z.object({ label: z.string().min(1).max(16), href: safeHrefSchema }))
      .max(6)
      .default([]),
    actionLabel: z.string().min(1).max(40).default('Donate now'),
    actionHref: safeHrefSchema.default('#'),
    note: z.string().min(1).max(160).optional(),
    imageSrc: safeImageSourceSchema.optional(),
    imageAlt: z.string().max(160).default(''),
    layout: z.enum(fundraiserLayouts).default('card'),
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
    ...sectionIntroGroups,
    raised: { tab: 'content', section: 'Goal' },
    goal: { tab: 'content', section: 'Goal' },
    currency: { tab: 'content', section: 'Goal' },
    currencyPosition: { tab: 'content', section: 'Goal' },
    raisedLabel: { tab: 'content', section: 'Goal' },
    goalLabel: { tab: 'content', section: 'Goal' },
    numberLanguage: { tab: 'content', section: 'Goal' },
    progressLabel: { tab: 'advanced', section: 'Accessibility' },
    stats: { tab: 'content', section: 'Supporters' },
    amounts: { tab: 'content', section: 'Donation' },
    actionLabel: { tab: 'content', section: 'Donation' },
    actionHref: { tab: 'content', section: 'Donation' },
    note: { tab: 'content', section: 'Donation' },
    imageSrc: { tab: 'content', section: 'Image', kind: 'image' },
    imageAlt: { tab: 'content', section: 'Image' },
    layout: { tab: 'design', section: 'Layout' },
    ...sectionDesignGroups,
  },
  inlineEditable: 'heading',
  /*
    The introduction, the currency and the words around the amounts, every
    stat, every preset amount, the button, the note and the photo. The amounts
    are numbers (Inspector rows), printed in the page's digits.
  */
  parts: {
    ...sectionIntroParts,
    currency: {
      kind: 'text',
      bind: 'currency',
      label: { en: 'Currency', ar: 'العملة' },
      aliases: ['currency', 'symbol', 'sar', 'usd', 'العملة', 'ريال'],
    },
    raisedLabel: {
      kind: 'text',
      bind: 'raisedLabel',
      label: { en: 'Raised label', ar: 'تسمية المبلغ المجموع' },
      aliases: ['raised', 'collected', 'جُمع', 'المجموع'],
    },
    goalLabel: {
      kind: 'text',
      bind: 'goalLabel',
      label: { en: 'Goal label', ar: 'تسمية الهدف' },
      aliases: ['goal', 'target', 'الهدف'],
    },
    stats: {
      kind: 'list',
      bind: 'stats',
      label: { en: 'Supporter stats', ar: 'أرقام الداعمين' },
      aliases: ['stats', 'donors', 'days left', 'الأرقام', 'المتبرعون'],
    },
    'stat.value': {
      kind: 'text',
      bind: 'stats.*.value',
      label: { en: 'Stat value', ar: 'قيمة الرقم' },
      aliases: ['value', 'number', 'القيمة', 'الرقم'],
    },
    'stat.label': {
      kind: 'text',
      bind: 'stats.*.label',
      label: { en: 'Stat label', ar: 'وصف الرقم' },
      aliases: ['label', 'donors', 'days', 'الوصف', 'المتبرعون'],
    },
    amounts: {
      kind: 'list',
      bind: 'amounts',
      label: { en: 'Preset amounts', ar: 'مبالغ مقترحة' },
      aliases: ['amounts', 'presets', 'options', 'المبالغ', 'الخيارات'],
    },
    amount: {
      kind: 'link',
      bind: { text: 'amounts.*.label', href: 'amounts.*.href' },
      label: { en: 'Preset amount', ar: 'مبلغ مقترح' },
      aliases: ['amount', 'preset', 'option', 'مبلغ', 'خيار'],
    },
    action: {
      kind: 'link',
      bind: { text: 'actionLabel', href: 'actionHref' },
      label: { en: 'Donate button', ar: 'زر التبرع' },
      aliases: ['button', 'donate', 'give', 'cta', 'زر', 'تبرع'],
    },
    note: {
      kind: 'text',
      bind: 'note',
      label: { en: 'Note', ar: 'ملاحظة' },
      aliases: ['note', 'tax', 'fine print', 'ملاحظة', 'تنويه'],
    },
    image: {
      kind: 'image',
      bind: { src: 'imageSrc', alt: 'imageAlt' },
      label: { en: 'Photo', ar: 'الصورة' },
      aliases: ['image', 'photo', 'picture', 'صورة'],
    },
  },
  examples: fundraiserExamples,
});

export type FundraiserProps = z.output<typeof fundraiserSchema.props>;
