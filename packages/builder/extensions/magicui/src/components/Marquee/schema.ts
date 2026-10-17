import { z } from 'zod';

import {
  defineBlockSchema,
  findRejectedUtilities,
  motionSpecSchema,
  partStylesProp,
} from '@craftkit/builder-schema';

import { marqueeExamples } from './examples';

const safeDestinationSchema = z
  .string()
  .min(1)
  .max(2000)
  .refine(
    (value) =>
      value.startsWith('#') ||
      (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) ||
      /^(https?:\/\/|mailto:|tel:)/i.test(value),
    {
      message: 'URL must be relative or use http, https, mailto, or tel.',
    },
  );

const safeImageUrlSchema = z
  .string()
  .min(1)
  .max(2000)
  .refine(
    (value) =>
      (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) ||
      /^https?:\/\//i.test(value),
    { message: 'Image URL must be a safe root-relative, http, or https URL.' },
  );

export const marqueeItemSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(200).optional(),
  meta: z.string().min(1).max(60).optional(),
  imageUrl: safeImageUrlSchema.optional(),
  imageAlt: z.string().max(140).optional(),
  href: safeDestinationSchema.optional(),
});

const defaultItems = z.array(marqueeItemSchema).parse([
  { title: 'Northstar', meta: 'Strategy' },
  { title: 'Monument', meta: 'Product' },
  { title: 'Fieldwork', meta: 'Research' },
  { title: 'Continuum', meta: 'Technology' },
  { title: 'Afterglow', meta: 'Design' },
]);

export const marqueeSchema = defineBlockSchema({
  type: 'marquee',
  description:
    'A continuously moving, reduced-motion-safe row for logos, testimonials, announcements, partners, or compact content cards. Inspired by Magic UI.',
  surfaces: ['site', 'store'],
  props: z.object({
    label: z.string().min(1).max(100).default('Highlights'),
    pauseLabel: z.string().min(1).max(60).default('Pause animation'),
    resumeLabel: z.string().min(1).max(60).default('Resume animation'),
    items: z.array(marqueeItemSchema).min(2).max(24).default(defaultItems),
    presentation: z.enum(['logos', 'cards', 'compact']).default('logos'),
    direction: z.enum(['forward', 'reverse']).default('forward'),
    speed: z.enum(['slow', 'normal', 'fast']).default('normal'),
    rows: z.enum(['one', 'two']).default('one'),
    pauseOnHover: z.boolean().default(true),
    edgeFade: z.boolean().default(true),
    tone: z.enum(['transparent', 'surface', 'inverse']).default('transparent'),
    radius: z.enum(['small', 'large', 'pill']).default('large'),
    motion: motionSpecSchema.optional(),
    className: z
      .string()
      .max(400)
      .refine((value) => findRejectedUtilities(value).length === 0, {
        error: (issue) =>
          findRejectedUtilities(String(issue.input))
            .map((rejection) => rejection.message)
            .join(' '),
      })
      .optional(),
    /* Per-part classes and direction (block-parts DESIGN §2.2), under the tokens law. */
    partStyles: partStylesProp(),
  }),
  propertyGroups: {
    label: { tab: 'content', section: 'Accessibility' },
    pauseLabel: { tab: 'content', section: 'Accessibility' },
    resumeLabel: { tab: 'content', section: 'Accessibility' },
    items: { tab: 'content', section: 'Items' },
    presentation: { tab: 'design', section: 'Appearance' },
    direction: { tab: 'design', section: 'Motion' },
    speed: { tab: 'design', section: 'Motion' },
    rows: { tab: 'design', section: 'Layout' },
    pauseOnHover: { tab: 'design', section: 'Motion' },
    edgeFade: { tab: 'design', section: 'Appearance' },
    tone: { tab: 'design', section: 'Colour' },
    radius: { tab: 'design', section: 'Appearance' },
    motion: { tab: 'design', section: 'Motion', kind: 'motion' },
    className: { tab: 'advanced', section: 'Custom classes', kind: 'utility-classes' },
    partStyles: { tab: 'advanced', section: 'Custom classes', kind: 'part-styles' },
  },
  /*
    The marquee's inner elements (block-parts DESIGN §1): the visible pause
    and resume labels, the item row and every item's image, title, text,
    detail and link. Each item is drawn in every seamless copy; all copies
    carry the part, and only the first, readable copy hosts an inline editor.
    `label` names the region for assistive technology only, so it stays an
    Inspector row.
  */
  parts: {
    pauseLabel: {
      kind: 'text',
      bind: 'pauseLabel',
      label: { en: 'Pause button', ar: 'زر الإيقاف' },
      aliases: ['pause', 'pause text', 'stop', 'إيقاف'],
    },
    resumeLabel: {
      kind: 'text',
      bind: 'resumeLabel',
      label: { en: 'Resume button', ar: 'زر الاستئناف' },
      aliases: ['resume', 'play', 'resume text', 'استئناف', 'تشغيل'],
    },
    items: {
      kind: 'list',
      bind: 'items',
      label: { en: 'Items', ar: 'العناصر' },
      aliases: ['row', 'logos', 'cards', 'track', 'list', 'الشريط', 'القائمة'],
    },
    item: {
      kind: 'item',
      bind: 'items.*',
      list: 'items',
      label: { en: 'Item', ar: 'العنصر' },
      aliases: ['logo', 'card', 'tile', 'بطاقة', 'شعار', 'عنصر'],
    },
    'item.image': {
      kind: 'image',
      bind: { src: 'items.*.imageUrl', alt: 'items.*.imageAlt' },
      label: { en: 'Item image', ar: 'صورة العنصر' },
      aliases: ['image', 'logo image', 'photo', 'mark', 'صورة', 'الشعار'],
    },
    'item.title': {
      kind: 'text',
      bind: 'items.*.title',
      label: { en: 'Item title', ar: 'عنوان العنصر' },
      aliases: ['title', 'name', 'عنوان', 'الاسم'],
    },
    'item.description': {
      kind: 'text',
      bind: 'items.*.description',
      label: { en: 'Item text', ar: 'نص العنصر' },
      aliases: ['description', 'quote', 'text', 'وصف', 'النص'],
      multiline: true,
    },
    'item.meta': {
      kind: 'text',
      bind: 'items.*.meta',
      label: { en: 'Item detail', ar: 'تفصيل العنصر' },
      aliases: ['meta', 'category', 'role', 'tag', 'تصنيف', 'وسم'],
    },
    'item.link': {
      kind: 'link',
      bind: { text: 'items.*.title', href: 'items.*.href' },
      label: { en: 'Item link', ar: 'رابط العنصر' },
      aliases: ['link', 'action', 'رابط', 'الرابط'],
    },
  },
  examples: marqueeExamples,
});

export type MarqueeProps = z.output<typeof marqueeSchema.props>;
export type MarqueeItem = z.output<typeof marqueeItemSchema>;
