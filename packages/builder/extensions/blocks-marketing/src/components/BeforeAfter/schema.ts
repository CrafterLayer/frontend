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
import { safeImageSourceSchema } from '../section-urls';
import { beforeAfterExamples } from './examples';

export const beforeAfterAspects = ['wide', 'landscape', 'square', 'portrait'] as const;

export const beforeAfterSchema = defineBlockSchema({
  type: 'beforeAfter',
  description:
    'A before/after image comparison with a keyboard-accessible slider: a renovation, a treatment, a retouch. Two photos with alt text and corner labels.',
  surfaces: ['site', 'store'],
  props: z.object({
    eyebrow: z.string().min(1).max(40).optional(),
    heading: z.string().min(1).max(90).default('See the difference'),
    body: z.string().min(1).max(240).optional(),
    beforeSrc: safeImageSourceSchema.optional(),
    beforeAlt: z.string().max(160).default(''),
    afterSrc: safeImageSourceSchema.optional(),
    afterAlt: z.string().max(160).default(''),
    beforeLabel: z.string().min(1).max(24).default('Before'),
    afterLabel: z.string().min(1).max(24).default('After'),
    showLabels: z.boolean().default(true),
    caption: z.string().min(1).max(180).optional(),
    /* Where the divider starts, as a percentage from the inline start. */
    start: z.number().int().min(0).max(100).default(50),
    aspect: z.enum(beforeAfterAspects).default('landscape'),
    /* The slider's accessible name: it is never seen, so it is an Inspector row, not a part. */
    sliderLabel: z.string().min(1).max(60).default('Drag to compare before and after'),
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
    beforeSrc: { tab: 'content', section: 'Before', kind: 'image' },
    beforeAlt: { tab: 'content', section: 'Before' },
    beforeLabel: { tab: 'content', section: 'Before' },
    afterSrc: { tab: 'content', section: 'After', kind: 'image' },
    afterAlt: { tab: 'content', section: 'After' },
    afterLabel: { tab: 'content', section: 'After' },
    caption: { tab: 'content', section: 'Comparison' },
    showLabels: { tab: 'design', section: 'Comparison' },
    start: { tab: 'design', section: 'Comparison' },
    aspect: { tab: 'design', section: 'Comparison' },
    sliderLabel: { tab: 'advanced', section: 'Accessibility' },
    ...sectionDesignGroups,
  },
  inlineEditable: 'heading',
  /*
    The introduction, both photos, both corner labels and the caption. The
    slider's name is heard, not seen, so it stays an Inspector row.
  */
  parts: {
    ...sectionIntroParts,
    beforeImage: {
      kind: 'image',
      bind: { src: 'beforeSrc', alt: 'beforeAlt' },
      label: { en: 'Before photo', ar: 'صورة قبل' },
      aliases: ['before', 'old', 'original', 'قبل', 'الصورة الأولى'],
    },
    afterImage: {
      kind: 'image',
      bind: { src: 'afterSrc', alt: 'afterAlt' },
      label: { en: 'After photo', ar: 'صورة بعد' },
      aliases: ['after', 'new', 'result', 'بعد', 'النتيجة'],
    },
    beforeLabel: {
      kind: 'text',
      bind: 'beforeLabel',
      label: { en: 'Before label', ar: 'تسمية قبل' },
      aliases: ['before label', 'قبل'],
    },
    afterLabel: {
      kind: 'text',
      bind: 'afterLabel',
      label: { en: 'After label', ar: 'تسمية بعد' },
      aliases: ['after label', 'بعد'],
    },
    caption: {
      kind: 'text',
      bind: 'caption',
      label: { en: 'Caption', ar: 'التعليق' },
      aliases: ['caption', 'note', 'credit', 'تعليق', 'ملاحظة'],
    },
  },
  examples: beforeAfterExamples,
});

export type BeforeAfterProps = z.output<typeof beforeAfterSchema.props>;
