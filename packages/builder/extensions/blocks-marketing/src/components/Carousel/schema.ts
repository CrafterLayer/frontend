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
import { carouselExamples } from './examples';

const safeDestination = z
  .string()
  .min(1)
  .max(2000)
  .refine(
    (value) =>
      value.startsWith('#') ||
      (value.startsWith('/') && !value.startsWith('//')) ||
      /^(https?:\/\/|mailto:|tel:)/i.test(value),
    { error: 'Use a relative path, fragment, or an http, https, mailto, or tel URL.' },
  );

const safeMediaSource = z
  .string()
  .min(1)
  .max(2000)
  .refine(
    (value) => (value.startsWith('/') && !value.startsWith('//')) || /^https?:\/\//i.test(value),
    { error: 'Media must use a relative path or an http or https URL.' },
  );

export const carouselSchema = defineBlockSchema({
  type: 'carousel',
  description:
    'An accessible responsive carousel with media, copy, safe actions, keyboard navigation, indicators, and opt-in user-controllable autoplay.',
  surfaces: ['site', 'store'],
  props: z.object({
    eyebrow: z.string().min(1).max(40).optional(),
    heading: z.string().min(1).max(100).default('Featured stories'),
    body: z.string().min(1).max(240).optional(),
    items: z
      .array(
        z.object({
          label: z.string().min(1).max(40).optional(),
          title: z.string().min(1).max(100),
          body: z.string().min(1).max(320).optional(),
          imageSrc: safeMediaSource.optional(),
          imageAlt: z.string().max(160).default(''),
          action: z
            .object({
              label: z.string().min(1).max(40),
              href: safeDestination,
            })
            .optional(),
        }),
      )
      .max(10)
      .default([]),
    variant: z.enum(['card', 'split', 'media']).default('split'),
    mediaPosition: z.enum(['start', 'end']).default('start'),
    mediaAspect: z.enum(['wide', 'square', 'portrait']).default('wide'),
    showControls: z.boolean().default(true),
    showIndicators: z.boolean().default(true),
    loop: z.boolean().default(true),
    autoplay: z.boolean().default(false),
    autoplayInterval: z.enum(['slow', 'normal', 'fast']).default('normal'),
    pauseOnInteraction: z.boolean().default(true),
    controlsLabel: z.string().min(1).max(80).default('Carousel controls'),
    previousLabel: z.string().min(1).max(80).default('Previous slide'),
    nextLabel: z.string().min(1).max(80).default('Next slide'),
    playLabel: z.string().min(1).max(80).default('Play carousel'),
    pauseLabel: z.string().min(1).max(80).default('Pause carousel'),
    goToLabel: z.string().min(1).max(80).default('Go to slide'),
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
    items: { tab: 'content', section: 'Slides' },
    controlsLabel: { tab: 'content', section: 'Accessibility' },
    previousLabel: { tab: 'content', section: 'Accessibility' },
    nextLabel: { tab: 'content', section: 'Accessibility' },
    playLabel: { tab: 'content', section: 'Accessibility' },
    pauseLabel: { tab: 'content', section: 'Accessibility' },
    goToLabel: { tab: 'content', section: 'Accessibility' },
    variant: { tab: 'design', section: 'Layout' },
    mediaPosition: { tab: 'design', section: 'Media' },
    mediaAspect: { tab: 'design', section: 'Media' },
    showControls: { tab: 'design', section: 'Controls' },
    showIndicators: { tab: 'design', section: 'Controls' },
    loop: { tab: 'design', section: 'Behavior' },
    autoplay: { tab: 'design', section: 'Behavior' },
    autoplayInterval: { tab: 'design', section: 'Behavior' },
    pauseOnInteraction: { tab: 'design', section: 'Behavior' },
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
  examples: carouselExamples,
});

export type CarouselProps = z.output<typeof carouselSchema.props>;
