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
import { blogGridExamples } from './examples';

export const blogGridVariants = ['cards', 'editorial', 'featured'] as const;
export const blogGridColumns = ['2', '3'] as const;

const safeHrefSchema = z
  .string()
  .min(1)
  .max(2000)
  .refine(
    (value) =>
      value.startsWith('#') ||
      (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) ||
      /^(https?:\/\/|mailto:|tel:)/i.test(value),
    {
      message: 'Article link must be relative or use http, https, mailto, or tel.',
    },
  );

export const blogGridSchema = defineBlockSchema({
  type: 'blogGrid',
  description:
    'A responsive article collection with card, editorial, and featured layouts; optional imagery and structured publication metadata.',
  surfaces: ['site', 'store'],
  props: z.object({
    eyebrow: z.string().min(1).max(40).optional(),
    heading: z.string().min(1).max(80).default('Latest insights'),
    body: z.string().min(1).max(240).optional(),
    posts: z
      .array(
        z.object({
          title: z.string().min(1).max(100),
          excerpt: z.string().min(1).max(240),
          href: safeHrefSchema,
          category: z.string().min(1).max(40).optional(),
          author: z.string().min(1).max(60).optional(),
          publishedLabel: z.string().min(1).max(40).optional(),
          dateTime: z.string().min(1).max(40).optional(),
          readingTime: z.string().min(1).max(40).optional(),
          imageSrc: z.string().min(1).max(2000).optional(),
          imageAlt: z.string().max(160).optional(),
          featured: z.boolean().optional(),
        }),
      )
      .max(12)
      .default([]),
    actionLabel: z.string().min(1).max(40).default('Read article'),
    showImages: z.boolean().default(true),
    variant: z.enum(blogGridVariants).default('cards'),
    columns: z.enum(blogGridColumns).default('3'),
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
    posts: { tab: 'content', section: 'Articles' },
    actionLabel: { tab: 'content', section: 'Articles' },
    showImages: { tab: 'design', section: 'Media' },
    variant: { tab: 'design', section: 'Layout' },
    columns: { tab: 'design', section: 'Layout' },
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
    The section's inner elements (block-parts DESIGN §1): the introduction,
    the article list, each article card and every line on it are selectable,
    editable and stylable on the canvas. `actionLabel` is one part shown on
    every card; `post.link` is the card's link (its text binds the article
    title, which the link's accessible name reads through aria-labelledby).
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
    posts: {
      kind: 'list',
      bind: 'posts',
      label: { en: 'Articles', ar: 'المقالات' },
      aliases: ['posts', 'articles', 'cards', 'grid', 'list', 'البطاقات', 'القائمة', 'المدونة'],
    },
    post: {
      kind: 'item',
      bind: 'posts.*',
      list: 'posts',
      label: { en: 'Article', ar: 'المقالة' },
      aliases: ['article', 'post', 'card', 'مقال', 'مقالة', 'بطاقة'],
    },
    'post.image': {
      kind: 'image',
      bind: { src: 'posts.*.imageSrc', alt: 'posts.*.imageAlt' },
      label: { en: 'Article image', ar: 'صورة المقالة' },
      aliases: ['image', 'photo', 'cover', 'thumbnail', 'صورة', 'الصورة'],
    },
    'post.category': {
      kind: 'text',
      bind: 'posts.*.category',
      label: { en: 'Article category', ar: 'تصنيف المقالة' },
      aliases: ['category', 'tag', 'topic', 'تصنيف', 'وسم'],
    },
    'post.title': {
      kind: 'text',
      bind: 'posts.*.title',
      label: { en: 'Article title', ar: 'عنوان المقالة' },
      aliases: ['card title', 'h3', 'عنوان البطاقة'],
    },
    'post.excerpt': {
      kind: 'text',
      bind: 'posts.*.excerpt',
      label: { en: 'Article excerpt', ar: 'مقتطف المقالة' },
      aliases: ['excerpt', 'summary', 'card text', 'مقتطف', 'ملخص', 'نص البطاقة'],
      multiline: true,
    },
    'post.author': {
      kind: 'text',
      bind: 'posts.*.author',
      label: { en: 'Article author', ar: 'كاتب المقالة' },
      aliases: ['author', 'byline', 'writer', 'الكاتب', 'المؤلف'],
    },
    'post.publishedLabel': {
      kind: 'text',
      bind: 'posts.*.publishedLabel',
      label: { en: 'Publication date', ar: 'تاريخ النشر' },
      aliases: ['date', 'published', 'التاريخ'],
    },
    'post.readingTime': {
      kind: 'text',
      bind: 'posts.*.readingTime',
      label: { en: 'Reading time', ar: 'مدة القراءة' },
      aliases: ['read time', 'minutes', 'وقت القراءة'],
    },
    'post.link': {
      kind: 'link',
      bind: { text: 'posts.*.title', href: 'posts.*.href' },
      label: { en: 'Article link', ar: 'رابط المقالة' },
      aliases: ['link', 'read more', 'action', 'cta', 'رابط', 'الرابط', 'اقرأ المزيد'],
    },
    actionLabel: {
      kind: 'text',
      bind: 'actionLabel',
      label: { en: 'Link label', ar: 'نص الرابط' },
      aliases: ['button text', 'link text', 'read more text', 'نص الزر'],
    },
  },
  examples: blogGridExamples,
});

export type BlogGridProps = z.output<typeof blogGridSchema.props>;
