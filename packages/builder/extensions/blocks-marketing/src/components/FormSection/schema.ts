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
import { formSectionExamples } from './examples';

export const formSectionVariants = ['split', 'card', 'minimal'] as const;
export const formSectionMethods = ['post', 'get'] as const;
export const formSectionFieldTypes = [
  'text',
  'email',
  'tel',
  'url',
  'number',
  'date',
  'textarea',
  'select',
  'checkbox',
] as const;

const safeActionSchema = z
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

const fieldOptionSchema = z.object({
  label: z.string().min(1).max(80),
  value: z.string().min(1).max(120),
});

export const formSectionFieldSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(48)
      .regex(
        /^[a-z][a-z0-9-]*$/i,
        'Field id must begin with a letter and use letters, numbers, or dashes.',
      ),
    name: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[a-z][a-z0-9_-]*$/i, 'Field name must begin with a letter.'),
    type: z.enum(formSectionFieldTypes).default('text'),
    label: z.string().min(1).max(80),
    placeholder: z.string().max(120).optional(),
    helper: z.string().max(180).optional(),
    autoComplete: z.string().max(80).optional(),
    required: z.boolean().default(false),
    width: z.enum(['full', 'half']).default('full'),
    rows: z.number().int().min(3).max(12).default(5),
    options: z.array(fieldOptionSchema).max(16).default([]),
  })
  .superRefine((field, context) => {
    if (field.type === 'select' && field.options.length === 0) {
      context.addIssue({
        code: 'custom',
        message: 'Select fields require at least one option.',
        path: ['options'],
      });
    }
  });

const defaultFields = z.array(formSectionFieldSchema).parse([
  {
    id: 'name',
    name: 'name',
    type: 'text' as const,
    label: 'Name',
    placeholder: 'Your name',
    autoComplete: 'name',
    required: true,
    width: 'half' as const,
  },
  {
    id: 'email',
    name: 'email',
    type: 'email' as const,
    label: 'Work email',
    placeholder: 'you@company.com',
    autoComplete: 'email',
    required: true,
    width: 'half' as const,
  },
  {
    id: 'message',
    name: 'message',
    type: 'textarea' as const,
    label: 'How can we help?',
    placeholder: 'Share the goal, context, and timeline.',
    required: true,
    width: 'full' as const,
    rows: 5,
  },
]);

export const formSectionSchema = defineBlockSchema({
  type: 'formSection',
  description:
    'A configurable, accessible form section for enquiries, applications, bookings, lead capture, and custom workflows.',
  surfaces: ['site', 'store'],
  props: z.object({
    eyebrow: z.string().min(1).max(50).optional(),
    heading: z.string().min(1).max(100).default('Tell us what you need'),
    body: z.string().min(1).max(320).optional(),
    fields: z
      .array(formSectionFieldSchema)
      .min(1)
      .max(12)
      .default(defaultFields)
      .superRefine((fields, context) => {
        const ids = new Set<string>();
        const names = new Set<string>();
        fields.forEach((field, index) => {
          if (ids.has(field.id)) {
            context.addIssue({
              code: 'custom',
              message: `Field id "${field.id}" must be unique.`,
              path: [index, 'id'],
            });
          }
          if (names.has(field.name)) {
            context.addIssue({
              code: 'custom',
              message: `Field name "${field.name}" must be unique.`,
              path: [index, 'name'],
            });
          }
          ids.add(field.id);
          names.add(field.name);
        });
      }),
    submitLabel: z.string().min(1).max(50).default('Send request'),
    footerNote: z.string().min(1).max(220).optional(),
    successHint: z.string().min(1).max(180).optional(),
    action: safeActionSchema.optional(),
    method: z.enum(formSectionMethods).default('post'),
    variant: z.enum(formSectionVariants).default('split'),
    controlDensity: z.enum(['compact', 'comfortable']).default('comfortable'),
    controlRadius: z.enum(['small', 'large']).default('large'),
    buttonVariant: z.enum(['solid', 'outline']).default('solid'),
    buttonWidth: z.enum(['auto', 'full']).default('auto'),
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
    fields: { tab: 'content', section: 'Fields' },
    submitLabel: { tab: 'content', section: 'Submission' },
    footerNote: { tab: 'content', section: 'Submission' },
    successHint: { tab: 'content', section: 'Submission' },
    action: { tab: 'advanced', section: 'Submission' },
    method: { tab: 'advanced', section: 'Submission' },
    variant: { tab: 'design', section: 'Layout' },
    controlDensity: { tab: 'design', section: 'Controls' },
    controlRadius: { tab: 'design', section: 'Controls' },
    buttonVariant: { tab: 'design', section: 'Button' },
    buttonWidth: { tab: 'design', section: 'Button' },
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
  examples: formSectionExamples,
});

export type FormSectionProps = z.output<typeof formSectionSchema.props>;
export type FormSectionField = z.output<typeof formSectionFieldSchema>;
