import { z } from 'zod';

import {
  defineBlockSchema,
  findRejectedUtilities,
  motionSpecSchema,
  partStylesProp,
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
    /* Per-part classes and direction (block-parts DESIGN §2.2), under the tokens law. */
    partStyles: partStylesProp(),
  }),
  propertyGroups: {
    triggerLabel: { tab: 'content', section: 'Trigger' },
    title: { tab: 'content', section: 'Message' },
    body: { tab: 'content', section: 'Message', kind: 'multiline' },
    primaryAction: { tab: 'content', section: 'Actions', kind: 'link' },
    secondaryAction: { tab: 'content', section: 'Actions', kind: 'link' },
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
    partStyles: { tab: 'advanced', section: 'Custom classes', kind: 'part-styles' },
  },
  inlineEditable: 'title',
  /*
    The trigger, the panel and its text and actions (block-parts DESIGN §1).
    The close button is named by `closeLabel`, an attribute, so it stays an
    Inspector row.
  */
  parts: {
    trigger: {
      kind: 'text',
      bind: 'triggerLabel',
      label: { en: 'Trigger button', ar: 'زر الفتح' },
      aliases: ['button', 'open button', 'triggerLabel', 'الزر', 'زر'],
    },
    panel: {
      kind: 'box',
      label: { en: 'Dialog panel', ar: 'لوحة الحوار' },
      aliases: ['modal', 'card', 'النافذة', 'اللوحة'],
    },
    title: {
      kind: 'text',
      bind: 'title',
      label: { en: 'Title', ar: 'العنوان' },
      aliases: ['heading', 'headline', 'عنوان'],
    },
    body: {
      kind: 'text',
      bind: 'body',
      label: { en: 'Body', ar: 'الوصف' },
      aliases: ['message', 'description', 'paragraph', 'text', 'وصف', 'الرسالة', 'النص'],
      multiline: true,
    },
    primaryAction: {
      kind: 'link',
      bind: { text: 'primaryAction.label', href: 'primaryAction.href' },
      label: { en: 'Primary action', ar: 'الإجراء الرئيسي' },
      aliases: ['primary button', 'confirm', 'الزر الرئيسي', 'تأكيد'],
    },
    secondaryAction: {
      kind: 'link',
      bind: { text: 'secondaryAction.label', href: 'secondaryAction.href' },
      label: { en: 'Secondary action', ar: 'الإجراء الثانوي' },
      aliases: ['secondary button', 'cancel', 'الزر الثانوي', 'إلغاء'],
    },
  },
  examples: dialogExamples,
});

export type DialogProps = z.output<typeof dialogSchema.props>;
