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
    body: { tab: 'content', section: 'Introduction', kind: 'multiline' },
    email: { tab: 'content', section: 'Contact details' },
    phone: { tab: 'content', section: 'Contact details' },
    address: { tab: 'content', section: 'Contact details', kind: 'multiline' },
    availability: { tab: 'content', section: 'Contact details' },
    showForm: { tab: 'content', section: 'Form' },
    formTitle: { tab: 'content', section: 'Form' },
    formBody: { tab: 'content', section: 'Form', kind: 'multiline' },
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
  /*
    The section's inner elements (block-parts DESIGN §1): the introduction,
    every contact detail, the availability note, and the form's title, text,
    field labels and submit button. The email and phone links derive their
    `mailto:`/`tel:` address from the committed text only, so an inline
    editor never reaches an attribute.
  */
  parts: {
    eyebrow: {
      kind: 'text',
      bind: 'eyebrow',
      label: { en: 'Eyebrow', ar: 'الشارة' },
      aliases: ['badge', 'overline', 'kicker', 'شارة', 'العنوان الصغير'],
    },
    heading: {
      kind: 'text',
      bind: 'heading',
      label: { en: 'Heading', ar: 'العنوان' },
      aliases: ['title', 'headline', 'h2', 'عنوان', 'العنوان الرئيسي'],
    },
    body: {
      kind: 'text',
      bind: 'body',
      label: { en: 'Body', ar: 'الوصف' },
      aliases: ['intro', 'paragraph', 'description', 'text', 'وصف', 'الفقرة', 'النص'],
      multiline: true,
    },
    email: {
      kind: 'text',
      bind: 'email',
      label: { en: 'Email address', ar: 'البريد الإلكتروني' },
      aliases: ['email', 'mail', 'e-mail', 'بريد', 'الإيميل'],
    },
    phone: {
      kind: 'text',
      bind: 'phone',
      label: { en: 'Phone number', ar: 'رقم الهاتف' },
      aliases: ['phone', 'telephone', 'number', 'هاتف', 'الهاتف', 'الجوال'],
    },
    address: {
      kind: 'text',
      bind: 'address',
      label: { en: 'Address', ar: 'العنوان البريدي' },
      aliases: ['address', 'location', 'office', 'الموقع', 'المكتب'],
      multiline: true,
    },
    availability: {
      kind: 'text',
      bind: 'availability',
      label: { en: 'Availability', ar: 'التوفر' },
      aliases: ['availability', 'status', 'hours', 'response time', 'التوفر', 'الحالة'],
    },
    formTitle: {
      kind: 'text',
      bind: 'formTitle',
      label: { en: 'Form title', ar: 'عنوان النموذج' },
      aliases: ['form title', 'form heading', 'h3', 'عنوان النموذج'],
    },
    formBody: {
      kind: 'text',
      bind: 'formBody',
      label: { en: 'Form text', ar: 'نص النموذج' },
      aliases: ['form text', 'form description', 'وصف النموذج'],
      multiline: true,
    },
    nameLabel: {
      kind: 'text',
      bind: 'nameLabel',
      label: { en: 'Name field label', ar: 'تسمية حقل الاسم' },
      aliases: ['name label', 'name field', 'حقل الاسم'],
    },
    emailLabel: {
      kind: 'text',
      bind: 'emailLabel',
      label: { en: 'Email field label', ar: 'تسمية حقل البريد' },
      aliases: ['email label', 'email field', 'حقل البريد'],
    },
    messageLabel: {
      kind: 'text',
      bind: 'messageLabel',
      label: { en: 'Message field label', ar: 'تسمية حقل الرسالة' },
      aliases: ['message label', 'message field', 'حقل الرسالة'],
    },
    submitLabel: {
      kind: 'text',
      bind: 'submitLabel',
      label: { en: 'Submit button', ar: 'زر الإرسال' },
      aliases: ['submit', 'button', 'send', 'زر', 'الزر', 'إرسال'],
    },
  },
  examples: contactExamples,
});

export type ContactProps = z.output<typeof contactSchema.props>;
