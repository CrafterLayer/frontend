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
import { galleryExamples } from './examples';

const safeImageSourceSchema = z
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
        'Image sources must use http(s), a root-relative path, or a supported raster data URL.',
    },
  );

const safeImageHrefSchema = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .refine(
    (value) =>
      (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) ||
      value.startsWith('#') ||
      /^https?:\/\//i.test(value),
    {
      message: 'Image links must use http(s), a root-relative path, or an anchor.',
    },
  );

const galleryItemSchema = z
  .object({
    src: safeImageSourceSchema,
    alt: z.string().max(160).default(''),
    decorative: z.boolean().default(false),
    caption: z.string().min(1).max(180).optional(),
    href: safeImageHrefSchema.optional(),
    featured: z.boolean().optional(),
  })
  .superRefine((item, context) => {
    if (!item.decorative && item.alt.trim().length === 0) {
      context.addIssue({
        code: 'custom',
        message: 'Informative gallery images require nonempty alt text.',
        path: ['alt'],
      });
    }
  });

export const gallerySchema = defineBlockSchema({
  type: 'gallery',
  description:
    'A premium image collection with responsive grid and editorial layouts, semantic captions, explicit alt text, and optional safe full-size links.',
  surfaces: ['site', 'store'],
  props: z.object({
    eyebrow: z.string().min(1).max(40).optional(),
    heading: z.string().min(1).max(100).default('Work that rewards a closer look'),
    body: z.string().min(1).max(260).optional(),
    items: z.array(galleryItemSchema).max(16).default([]),
    layout: z.enum(['grid', 'editorial']).default('grid'),
    columns: z.enum(['2', '3', '4']).default('3'),
    aspect: z.enum(['landscape', 'square', 'portrait']).default('landscape'),
    imageFit: z.enum(['cover', 'contain']).default('cover'),
    showCaptions: z.boolean().default(true),
    captionStyle: z.enum(['below', 'overlay']).default('below'),
    linkImages: z.boolean().default(false),
    linkLabel: z.string().min(1).max(60).default('Open full-size image'),
    newTab: z.boolean().default(true),
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
    body: { tab: 'content', section: 'Introduction' },
    items: { tab: 'content', section: 'Images' },
    linkLabel: { tab: 'content', section: 'Image links' },
    layout: { tab: 'design', section: 'Layout' },
    columns: { tab: 'design', section: 'Layout' },
    aspect: { tab: 'design', section: 'Media' },
    imageFit: { tab: 'design', section: 'Media' },
    showCaptions: { tab: 'design', section: 'Captions' },
    captionStyle: { tab: 'design', section: 'Captions' },
    linkImages: { tab: 'design', section: 'Image links' },
    newTab: { tab: 'advanced', section: 'Image links' },
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
  examples: galleryExamples,
});

export type GalleryProps = z.output<typeof gallerySchema.props>;
