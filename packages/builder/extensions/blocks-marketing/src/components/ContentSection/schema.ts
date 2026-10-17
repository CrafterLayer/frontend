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
import { contentSectionExamples } from './examples';

const safeHrefSchema = z
  .string()
  .min(1)
  .max(500)
  .refine(
    (value) =>
      value.startsWith('#') ||
      (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) ||
      /^(https?:\/\/|mailto:|tel:)/i.test(value),
    {
      message: 'Link must be relative or use http, https, mailto, or tel.',
    },
  );

export const contentSectionSchema = defineBlockSchema({
  type: 'content-section',
  description:
    'A narrative section with optional media, proof highlights, and a supporting link in split, stacked, or editorial layouts.',
  surfaces: ['site', 'store', 'docs'],
  props: z.object({
    eyebrow: z.string().min(1).max(40).optional(),
    heading: z.string().min(1).max(110).default('A clearer way to move forward'),
    body: z
      .string()
      .min(1)
      .max(600)
      .default('Tell the story behind the work and the outcome it creates.'),
    highlights: z
      .array(
        z.object({
          title: z.string().min(1).max(60),
          body: z.string().min(1).max(160),
        }),
      )
      .max(6)
      .default([]),
    imageSrc: z.string().min(1).max(2000).optional(),
    imageAlt: z.string().max(160).default(''),
    caption: z.string().min(1).max(140).optional(),
    imageFit: z.enum(['cover', 'contain']).default('cover'),
    mediaPosition: z.enum(['start', 'end']).default('end'),
    link: z
      .object({
        label: z.string().min(1).max(40),
        href: safeHrefSchema,
      })
      .optional(),
    layout: z.enum(['split', 'stacked', 'editorial']).default('split'),
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
    eyebrow: { tab: 'content', section: 'Text' },
    heading: { tab: 'content', section: 'Text' },
    body: { tab: 'content', section: 'Text', kind: 'multiline' },
    highlights: { tab: 'content', section: 'Highlights' },
    imageSrc: { tab: 'content', section: 'Media', kind: 'image' },
    imageAlt: { tab: 'content', section: 'Media' },
    caption: { tab: 'content', section: 'Media' },
    link: { tab: 'content', section: 'Action' },
    imageFit: { tab: 'design', section: 'Media' },
    mediaPosition: { tab: 'design', section: 'Media' },
    layout: { tab: 'design', section: 'Layout' },
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
    The section's inner elements (block-parts DESIGN §1): the copy, each
    highlight and its lines, the action link (label in place, destination in
    the Link popover), the image (replaced through the asset picker; its alt
    text is the image part's second value) and the caption.
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
    highlights: {
      kind: 'list',
      bind: 'highlights',
      label: { en: 'Highlights', ar: 'النقاط البارزة' },
      aliases: ['points', 'bullets', 'list', 'النقاط', 'القائمة'],
    },
    highlight: {
      kind: 'item',
      bind: 'highlights.*',
      list: 'highlights',
      label: { en: 'Highlight', ar: 'نقطة بارزة' },
      aliases: ['point', 'bullet', 'نقطة', 'بند'],
    },
    'highlight.title': {
      kind: 'text',
      bind: 'highlights.*.title',
      label: { en: 'Highlight title', ar: 'عنوان النقطة' },
      aliases: ['point title', 'h3', 'عنوان'],
    },
    'highlight.body': {
      kind: 'text',
      bind: 'highlights.*.body',
      label: { en: 'Highlight text', ar: 'وصف النقطة' },
      aliases: ['point text', 'description', 'النص'],
      multiline: true,
    },
    link: {
      kind: 'link',
      bind: { text: 'link.label', href: 'link.href' },
      label: { en: 'Link', ar: 'الرابط' },
      aliases: ['button', 'cta', 'action', 'الزر', 'رابط'],
    },
    image: {
      kind: 'image',
      bind: { src: 'imageSrc', alt: 'imageAlt' },
      label: { en: 'Image', ar: 'الصورة' },
      aliases: ['media', 'picture', 'photo', 'صورة', 'الوسائط'],
    },
    caption: {
      kind: 'text',
      bind: 'caption',
      label: { en: 'Caption', ar: 'التعليق' },
      aliases: ['image caption', 'figcaption', 'تعليق الصورة', 'الشرح'],
    },
  },
  examples: contentSectionExamples,
});

export type ContentSectionProps = z.output<typeof contentSectionSchema.props>;
