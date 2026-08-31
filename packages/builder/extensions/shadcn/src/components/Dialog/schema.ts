import { z } from 'zod';

import {
  defineBlockSchema,
  findRejectedUtilities,
  motionSpecSchema,
} from '@craftkit/builder-schema';

import { dialogExamples } from './examples';

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

const actionSchema = z.object({
  label: z.string().min(1).max(48),
  href: safeDestination,
});

const utilityClasses = z
  .string()
  .max(400)
  .refine((value) => findRejectedUtilities(value).length === 0, {
    error: (issue) =>
      findRejectedUtilities(String(issue.input))
        .map((rejection) => rejection.message)
        .join(' '),
  });

export const dialogSchema = defineBlockSchema({
  type: 'dialog',
  description:
    'A standards-based native modal dialog with browser focus containment, inert background, safe actions, and configurable close policies.',
  surfaces: ['site', 'store'],
  props: z.object({
    triggerLabel: z.string().min(1).max(64).default('Open dialog'),
    title: z.string().min(1).max(120).default('Continue with this action?'),
    body: z.string().min(1).max(480).optional(),
    primaryAction: actionSchema.optional(),
    secondaryAction: actionSchema.optional(),
    closeLabel: z.string().min(1).max(64).default('Close dialog'),
    size: z.enum(['sm', 'md', 'lg', 'full']).default('sm'),
    tone: z.enum(['surface', 'inverse', 'accent']).default('surface'),
    triggerVariant: z.enum(['primary', 'secondary', 'ghost']).default('primary'),
    initialFocus: z.enum(['close', 'primary', 'dialog']).default('close'),
    showCloseButton: z.boolean().default(true),
    closeOnEscape: z.boolean().default(true),
    closeOnOverlay: z.boolean().default(true),
    closeOnAction: z.boolean().default(true),
    motion: motionSpecSchema.optional(),
    className: utilityClasses.optional(),
  }),
  propertyGroups: {
    triggerLabel: { tab: 'content', section: 'Trigger' },
    title: { tab: 'content', section: 'Message' },
    body: { tab: 'content', section: 'Message' },
    primaryAction: { tab: 'content', section: 'Actions' },
    secondaryAction: { tab: 'content', section: 'Actions' },
    closeLabel: { tab: 'content', section: 'Accessibility' },
    size: { tab: 'design', section: 'Dialog' },
    tone: { tab: 'design', section: 'Dialog' },
    triggerVariant: { tab: 'design', section: 'Trigger' },
    initialFocus: { tab: 'advanced', section: 'Focus' },
    showCloseButton: { tab: 'design', section: 'Controls' },
    closeOnEscape: { tab: 'advanced', section: 'Close behavior' },
    closeOnOverlay: { tab: 'advanced', section: 'Close behavior' },
    closeOnAction: { tab: 'advanced', section: 'Close behavior' },
    motion: { tab: 'design', section: 'Motion', kind: 'motion' },
    className: { tab: 'advanced', section: 'Custom classes', kind: 'utility-classes' },
  },
  inlineEditable: 'title',
  examples: dialogExamples,
});

export type DialogProps = z.output<typeof dialogSchema.props>;
