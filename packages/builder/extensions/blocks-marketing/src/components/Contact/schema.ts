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
import { contactExamples } from './examples';

export const contactVariants = ['split', 'card', 'centered'] as const;
export const contactMethods = ['post', 'get'] as const;

const formActionSchema = z
  .string()
  .min(1)
  .max(2000)
  .refine(
    (value) =>
      value.startsWith('#') ||
      (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) ||
      /^https?:\/\//i.test(value),
    {
      message: 'Form action must be a relative, http, or https URL.',
    },
  );

export const contactSchema = defineBlockSchema({
  type: 'contact',
  description:
    'A complete contact section with direct email, phone, and address details plus an accessible name, email, and message form.',
  surfaces: ['site', 'store'],
  props: z.object({
    eyebrow: z.string().min(1).max(40).optional(),
    heading: z.string().min(1).max(80).default("Let's work together"),
    body: z.string().min(1).max(240).optional(),
    email: z.email().max(254).optional(),
    phone: z.string().min(3).max(40).optional(),
    address: z.string().min(1).max(240).optional(),
    availability: z.string().min(1).max(100).optional(),
    showForm: z.boolean().default(true),
    formTitle: z.string().min(1).max(80).default('Tell us about your project'),
    formBody: z.string().min(1).max(180).optional(),
    nameLabel: z.string().min(1).max(40).default('Name'),
    emailLabel: z.string().min(1).max(40).default('Work email'),
    messageLabel: z.string().min(1).max(40).default('How can we help?'),
    submitLabel: z.string().min(1).max(40).default('Send enquiry'),
    formAction: formActionSchema.optional(),
    method: z.enum(contactMethods).default('post'),
    variant: z.enum(contactVariants).default('split'),
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
    email: { tab: 'content', section: 'Contact details' },
    phone: { tab: 'content', section: 'Contact details' },
    address: { tab: 'content', section: 'Contact details' },
    availability: { tab: 'content', section: 'Contact details' },
    showForm: { tab: 'content', section: 'Form' },
    formTitle: { tab: 'content', section: 'Form' },
    formBody: { tab: 'content', section: 'Form' },
    nameLabel: { tab: 'content', section: 'Form labels' },
    emailLabel: { tab: 'content', section: 'Form labels' },
    messageLabel: { tab: 'content', section: 'Form labels' },
    submitLabel: { tab: 'content', section: 'Form labels' },
    formAction: { tab: 'advanced', section: 'Form submission' },
    method: { tab: 'advanced', section: 'Form submission' },
    variant: { tab: 'design', section: 'Layout' },
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
  examples: contactExamples,
});

export type ContactProps = z.output<typeof contactSchema.props>;
