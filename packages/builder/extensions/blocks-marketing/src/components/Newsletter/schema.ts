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
import { newsletterExamples } from './examples';

const formActionSchema = z
  .string()
  .min(1)
  .max(500)
  .refine(
    (value) =>
      value.startsWith('#') ||
      (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) ||
      /^https?:\/\//i.test(value),
    {
      message: 'Form action must be relative or use http or https.',
    },
  );

export const newsletterSchema = defineBlockSchema({
  type: 'newsletter',
  description:
    'An email signup section with native validation, editable submission action, consent context, and inline, card, or split presentation.',
  surfaces: ['site', 'store'],
  props: z.object({
    eyebrow: z.string().min(1).max(40).optional(),
    heading: z.string().min(1).max(100).default('Useful ideas, delivered with care'),
    body: z.string().min(1).max(240).optional(),
    emailLabel: z.string().min(1).max(60).default('Email address'),
    placeholder: z.string().min(1).max(80).default('you@example.com'),
    buttonLabel: z.string().min(1).max(40).default('Subscribe'),
    privacy: z.string().min(1).max(180).optional(),
    action: formActionSchema.default('/subscribe'),
    variant: z.enum(['inline', 'card', 'split']).default('card'),
    formLayout: z.enum(['row', 'stacked']).default('row'),
    align: z.enum(sectionAlignments).default('start'),
    tone: z.enum(sectionTones).default('transparent'),
    spacing: z.enum(sectionSpacings).default('lg'),
    width: z.enum(sectionWidths).default('standard'),
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
    emailLabel: { tab: 'content', section: 'Form' },
    placeholder: { tab: 'content', section: 'Form' },
    buttonLabel: { tab: 'content', section: 'Form' },
    privacy: { tab: 'content', section: 'Consent' },
    action: { tab: 'advanced', section: 'Form' },
    variant: { tab: 'design', section: 'Style' },
    formLayout: { tab: 'design', section: 'Form' },
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
  examples: newsletterExamples,
});

export type NewsletterProps = z.output<typeof newsletterSchema.props>;
