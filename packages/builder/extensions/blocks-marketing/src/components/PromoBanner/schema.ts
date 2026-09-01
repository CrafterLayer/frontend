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
import { promoBannerExamples } from './examples';

const safeDestination = z
  .string()
  .min(1)
  .max(2000)
  .refine(
    (value) =>
      value.startsWith('#') ||
      (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) ||
      /^(https?:\/\/|mailto:|tel:)/i.test(value),
    { error: 'Use a relative path, fragment, or an http, https, mailto, or tel URL.' },
  );

const safeMediaSource = z
  .string()
  .min(1)
  .max(2000)
  .refine(
    (value) =>
      (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) ||
      /^https?:\/\//i.test(value),
    { error: 'Media must use a relative path or an http or https URL.' },
  );

export const promoBannerSchema = defineBlockSchema({
  type: 'promoBanner',
  description:
    'A premium promotional banner with centered, split, or media-led presentation, safe actions, and optional responsive imagery.',
  surfaces: ['site', 'store'],
  props: z.object({
    label: z.string().min(1).max(40).optional(),
    headline: z.string().min(1).max(110).default('Make the next move count'),
    body: z.string().min(1).max(320).optional(),
    actions: z
      .array(
        z.object({
          label: z.string().min(1).max(40),
          href: safeDestination,
          emphasis: z.enum(['primary', 'secondary']).default('primary'),
        }),
      )
      .max(2)
      .default([]),
    imageSrc: safeMediaSource.optional(),
    imageAlt: z.string().max(160).default(''),
    showMedia: z.boolean().default(true),
    variant: z.enum(['centered', 'split', 'media']).default('centered'),
    panelStyle: z.enum(['surface', 'accent', 'inverse']).default('inverse'),
    mediaPosition: z.enum(['start', 'end']).default('end'),
    mediaAspect: z.enum(['wide', 'square', 'portrait']).default('wide'),
    padding: z.enum(['compact', 'comfortable', 'spacious']).default('spacious'),
    radius: z.enum(['none', 'lg', 'xl']).default('xl'),
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
    label: { tab: 'content', section: 'Message' },
    headline: { tab: 'content', section: 'Message' },
    body: { tab: 'content', section: 'Message' },
    actions: { tab: 'content', section: 'Actions' },
    imageSrc: { tab: 'content', section: 'Media' },
    imageAlt: { tab: 'content', section: 'Media' },
    showMedia: { tab: 'design', section: 'Media' },
    variant: { tab: 'design', section: 'Layout' },
    panelStyle: { tab: 'design', section: 'Style' },
    mediaPosition: { tab: 'design', section: 'Media' },
    mediaAspect: { tab: 'design', section: 'Media' },
    padding: { tab: 'design', section: 'Spacing' },
    radius: { tab: 'design', section: 'Shape' },
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
  inlineEditable: 'headline',
  examples: promoBannerExamples,
});

export type PromoBannerProps = z.output<typeof promoBannerSchema.props>;
