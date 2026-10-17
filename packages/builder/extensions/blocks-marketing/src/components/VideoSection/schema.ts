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
import { videoSectionExamples } from './examples';

const safeVideoSourceSchema = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .refine(
    (value) =>
      (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) ||
      /^https?:\/\//i.test(value) ||
      /^data:video\/(?:mp4|ogg|webm);/i.test(value),
    {
      message:
        'Video sources must use http(s), a root-relative path, or a supported video data URL.',
    },
  );

const safePosterSourceSchema = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .refine(
    (value) =>
      (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) ||
      /^https?:\/\//i.test(value) ||
      /^data:image\/(?:avif|gif|jpeg|png|webp);/i.test(value),
    {
      message:
        'Poster sources must use http(s), a root-relative path, or a supported raster data URL.',
    },
  );

const safeTrackSourceSchema = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .refine(
    (value) =>
      (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) ||
      /^https?:\/\//i.test(value),
    {
      message: 'Caption tracks must use http(s) or a root-relative path.',
    },
  );

const safeHrefSchema = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .refine(
    (value) =>
      (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) ||
      value.startsWith('#') ||
      /^https?:\/\//i.test(value) ||
      value.startsWith('mailto:') ||
      value.startsWith('tel:'),
    {
      message: 'CTA links must use http(s), mailto, tel, a root-relative path, or an anchor.',
    },
  );

const languageTagSchema = z
  .string()
  .min(2)
  .max(35)
  .regex(/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i, 'Use a valid BCP 47-style language tag.');

export const videoSectionSchema = defineBlockSchema({
  type: 'videoSection',
  description:
    'A native-video storytelling section with centered and split layouts, safe media URLs, captions-track support, and an optional CTA.',
  surfaces: ['site', 'store'],
  props: z.object({
    eyebrow: z.string().min(1).max(40).optional(),
    heading: z.string().min(1).max(100).default('See the experience in motion'),
    body: z.string().min(1).max(360).optional(),
    src: safeVideoSourceSchema.optional(),
    poster: safePosterSourceSchema.optional(),
    videoLabel: z.string().min(1).max(120).optional(),
    caption: z.string().min(1).max(180).optional(),
    captionsSrc: safeTrackSourceSchema.optional(),
    captionsLanguage: languageTagSchema.optional(),
    captionsLabel: z.string().min(1).max(60).optional(),
    cta: z
      .object({
        label: z.string().min(1).max(48),
        href: safeHrefSchema,
        newTab: z.boolean().default(false),
      })
      .optional(),
    layout: z.enum(['centered', 'split']).default('split'),
    mediaPosition: z.enum(['start', 'end']).default('end'),
    videoFit: z.enum(['cover', 'contain']).default('cover'),
    preload: z.enum(['none', 'metadata', 'auto']).default('metadata'),
    muted: z.boolean().default(false),
    loop: z.boolean().default(false),
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
    src: { tab: 'content', section: 'Video', kind: 'image' },
    poster: { tab: 'content', section: 'Video', kind: 'image' },
    videoLabel: { tab: 'content', section: 'Accessibility' },
    caption: { tab: 'content', section: 'Video' },
    captionsSrc: { tab: 'content', section: 'Captions' },
    captionsLanguage: { tab: 'content', section: 'Captions' },
    captionsLabel: { tab: 'content', section: 'Captions' },
    cta: { tab: 'content', section: 'Action', kind: 'link' },
    layout: { tab: 'design', section: 'Layout' },
    mediaPosition: { tab: 'design', section: 'Layout' },
    videoFit: { tab: 'design', section: 'Media' },
    align: { tab: 'design', section: 'Alignment' },
    tone: { tab: 'design', section: 'Colour' },
    spacing: { tab: 'design', section: 'Spacing' },
    width: { tab: 'design', section: 'Width' },
    preload: { tab: 'advanced', section: 'Playback' },
    muted: { tab: 'advanced', section: 'Playback' },
    loop: { tab: 'advanced', section: 'Playback' },
    ...sectionColorGroups,
    ...sectionMotionGroups,
    ...sectionCustomGroups,
    ...sectionTypographyGroups,
    ...sectionSpacingGroups,
  },
  inlineEditable: 'heading',
  /*
    The section's inner elements (block-parts DESIGN §1): the introduction,
    the caption under the video and the call-to-action link. The video
    address and poster are media rows (asset picker); its label and caption
    track label are read only by assistive technology, so they stay
    Inspector rows. With no `videoLabel`, the video is named by the visible
    heading through aria-labelledby, never by a copy of its text.
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
    caption: {
      kind: 'text',
      bind: 'caption',
      label: { en: 'Video caption', ar: 'تعليق الفيديو' },
      aliases: ['caption', 'figcaption', 'video text', 'تعليق', 'وصف الفيديو'],
    },
    cta: {
      kind: 'link',
      bind: { text: 'cta.label', href: 'cta.href' },
      label: { en: 'Button', ar: 'الزر' },
      aliases: ['button', 'action', 'cta', 'link', 'زر', 'الرابط'],
    },
  },
  examples: videoSectionExamples,
});

export type VideoSectionProps = z.output<typeof videoSectionSchema.props>;
