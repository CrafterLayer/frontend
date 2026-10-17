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
import { appDownloadExamples } from './examples';

/* Generic glyphs only: a store button here never draws a store's trademarked badge or logo. */
export const appDownloadIcons = ['phone', 'play', 'globe', 'monitor', 'download'] as const;
export const appDownloadLayouts = ['split', 'centered'] as const;
export const appDownloadMediaPositions = ['start', 'end'] as const;

const defaultStores = [
  { icon: 'phone' as const, kicker: 'Download on the', label: 'App Store', href: '#' },
  { icon: 'play' as const, kicker: 'Get it on', label: 'Google Play', href: '#' },
];

export const appDownloadSchema = defineBlockSchema({
  type: 'appDownload',
  description:
    'Promotes a mobile app: heading, a few benefits, generic store buttons (glyph, small lead-in, store name, link), a rating note and a phone screenshot in a drawn device frame.',
  surfaces: ['site', 'store'],
  props: z.object({
    eyebrow: z.string().min(1).max(40).optional(),
    heading: z.string().min(1).max(90).default('Everything you need, in your pocket'),
    body: z.string().min(1).max(240).optional(),
    features: z
      .array(z.string().min(1).max(80))
      .max(5)
      .default(['Order ahead and skip the queue', 'Track every delivery live', 'Pay with one tap']),
    stores: z
      .array(
        z.object({
          icon: z.enum(appDownloadIcons).default('phone'),
          kicker: z.string().min(1).max(30).optional(),
          label: z.string().min(1).max(30),
          href: safeHrefSchema,
        }),
      )
      .max(3)
      .default(defaultStores),
    note: z.string().min(1).max(120).optional(),
    imageSrc: safeImageSourceSchema.optional(),
    imageAlt: z.string().max(160).default(''),
    showDevice: z.boolean().default(true),
    layout: z.enum(appDownloadLayouts).default('split'),
    mediaPosition: z.enum(appDownloadMediaPositions).default('end'),
    align: z.enum(sectionAlignments).default('start'),
    tone: z.enum(sectionTones).default('light'),
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
    features: { tab: 'content', section: 'Benefits' },
    stores: { tab: 'content', section: 'Store buttons' },
    note: { tab: 'content', section: 'Store buttons' },
    imageSrc: { tab: 'content', section: 'Screenshot', kind: 'image' },
    imageAlt: { tab: 'content', section: 'Screenshot' },
    showDevice: { tab: 'design', section: 'Screenshot' },
    layout: { tab: 'design', section: 'Layout' },
    mediaPosition: { tab: 'design', section: 'Layout' },
    ...sectionDesignGroups,
  },
  inlineEditable: 'heading',
  parts: {
    ...sectionIntroParts,
    features: {
      kind: 'list',
      bind: 'features',
      label: { en: 'Benefits', ar: 'المزايا' },
      aliases: ['features', 'benefits', 'bullets', 'المزايا', 'المميزات'],
    },
    feature: {
      kind: 'text',
      bind: 'features.*',
      label: { en: 'Benefit', ar: 'ميزة' },
      aliases: ['feature', 'benefit', 'bullet', 'ميزة', 'نقطة'],
    },
    stores: {
      kind: 'list',
      bind: 'stores',
      label: { en: 'Store buttons', ar: 'أزرار المتاجر' },
      aliases: ['stores', 'download buttons', 'badges', 'المتاجر', 'أزرار التحميل'],
    },
    store: {
      kind: 'link',
      bind: { text: 'stores.*.label', href: 'stores.*.href' },
      label: { en: 'Store button', ar: 'زر المتجر' },
      aliases: ['store', 'app store', 'google play', 'download', 'button', 'المتجر', 'زر التحميل'],
    },
    'store.kicker': {
      kind: 'text',
      bind: 'stores.*.kicker',
      label: { en: 'Store lead-in', ar: 'تمهيد المتجر' },
      aliases: ['download on the', 'get it on', 'حمّله من', 'احصل عليه من'],
    },
    note: {
      kind: 'text',
      bind: 'note',
      label: { en: 'Rating note', ar: 'ملاحظة التقييم' },
      aliases: ['note', 'rating', 'reviews', 'trust line', 'التقييم', 'ملاحظة'],
    },
    image: {
      kind: 'image',
      bind: { src: 'imageSrc', alt: 'imageAlt' },
      label: { en: 'Screenshot', ar: 'لقطة الشاشة' },
      aliases: ['screenshot', 'phone', 'image', 'mockup', 'صورة', 'لقطة الشاشة'],
    },
  },
  examples: appDownloadExamples,
});

export type AppDownloadProps = z.output<typeof appDownloadSchema.props>;
