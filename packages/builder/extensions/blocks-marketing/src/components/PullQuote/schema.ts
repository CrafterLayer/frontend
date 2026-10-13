import { z } from 'zod';

import { defineBlockSchema } from '@craftkit/builder-schema';

import { sectionColorProps } from '../section-color';
import { sectionCustomProps } from '../section-custom';
import { sectionDesignGroups } from '../section-intro';
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
import { pullQuoteExamples } from './examples';

export const pullQuoteVariants = ['plain', 'rule', 'card'] as const;
export const pullQuoteSizes = ['md', 'lg', 'xl'] as const;

export const pullQuoteSchema = defineBlockSchema({
  type: 'pullQuote',
  description:
    'One large editorial quotation with its speaker, role, an optional source link and portrait. For a single standout line between sections, not a set of reviews.',
  surfaces: ['site', 'store', 'docs'],
  props: z.object({
    quote: z
      .string()
      .min(1)
      .max(320)
      .default('Good work is the kind you notice only when it is missing.'),
    author: z.string().min(1).max(60).optional(),
    role: z.string().min(1).max(80).optional(),
    source: z.string().min(1).max(80).optional(),
    sourceHref: safeHrefSchema.optional(),
    imageSrc: safeImageSourceSchema.optional(),
    imageAlt: z.string().max(160).default(''),
    variant: z.enum(pullQuoteVariants).default('plain'),
    size: z.enum(pullQuoteSizes).default('lg'),
    showMark: z.boolean().default(true),
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
    quote: { tab: 'content', section: 'Quote', kind: 'multiline' },
    author: { tab: 'content', section: 'Attribution' },
    role: { tab: 'content', section: 'Attribution' },
    source: { tab: 'content', section: 'Attribution' },
    sourceHref: { tab: 'content', section: 'Attribution' },
    imageSrc: { tab: 'content', section: 'Attribution', kind: 'image' },
    imageAlt: { tab: 'content', section: 'Attribution' },
    variant: { tab: 'design', section: 'Quote' },
    size: { tab: 'design', section: 'Quote' },
    showMark: { tab: 'design', section: 'Quote' },
    ...sectionDesignGroups,
  },
  inlineEditable: 'quote',
  parts: {
    quote: {
      kind: 'text',
      bind: 'quote',
      label: { en: 'Quote', ar: 'الاقتباس' },
      aliases: ['quote', 'quotation', 'statement', 'text', 'اقتباس', 'النص', 'المقولة'],
      multiline: true,
    },
    author: {
      kind: 'text',
      bind: 'author',
      label: { en: 'Speaker', ar: 'القائل' },
      aliases: ['author', 'name', 'speaker', 'person', 'الاسم', 'القائل', 'الكاتب'],
    },
    role: {
      kind: 'text',
      bind: 'role',
      label: { en: 'Role', ar: 'المنصب' },
      aliases: ['role', 'title', 'job', 'position', 'المنصب', 'الوظيفة'],
    },
    source: {
      kind: 'link',
      bind: { text: 'source', href: 'sourceHref' },
      label: { en: 'Source', ar: 'المصدر' },
      aliases: ['source', 'publication', 'citation', 'link', 'المصدر', 'المرجع'],
    },
    image: {
      kind: 'image',
      bind: { src: 'imageSrc', alt: 'imageAlt' },
      label: { en: 'Portrait', ar: 'الصورة' },
      aliases: ['photo', 'portrait', 'avatar', 'image', 'صورة', 'الصورة الشخصية'],
    },
  },
  examples: pullQuoteExamples,
});

export type PullQuoteProps = z.output<typeof pullQuoteSchema.props>;
