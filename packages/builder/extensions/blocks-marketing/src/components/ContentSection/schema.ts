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
  .refine((value) => /^(#|\/|https?:\/\/|mailto:|tel:)/i.test(value), {
    message: 'Link must be relative or use http, https, mailto, or tel.',
  });

export const contentSectionSchema = defineBlockSchema({
  type: 'content-section',
  description:
    'A narrative section with optional media, proof highlights, and a supporting link in split, stacked, or editorial layouts.',
  surfaces: ['site', 'store', 'docs'],
  props: z.object({
    eyebrow: z.string().min(1).max(40).optional(),
    heading: z.string().min(1).max(110).default('A clearer way to move forward'),
    body: z.string().min(1).max(600).default('Tell the story behind the work and the outcome it creates.'),
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
    body: { tab: 'content', section: 'Text' },
    highlights: { tab: 'content', section: 'Highlights' },
    imageSrc: { tab: 'content', section: 'Media' },
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
  examples: contentSectionExamples,
});

export type ContentSectionProps = z.output<typeof contentSectionSchema.props>;
