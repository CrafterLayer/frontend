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
import { locationExamples } from './examples';

export const locationLayouts = ['split', 'stacked'] as const;

/* A dialable number: digits, spaces, dashes, dots, brackets and one leading plus. */
const phoneSchema = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^\+?[0-9][0-9 ().-]*$/u, 'Use digits, spaces and an optional leading +.');

const emailSchema = z
  .string()
  .trim()
  .min(3)
  .max(120)
  .regex(/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/u, 'Use an address like name@example.com.');

const defaultHours = [
  { days: 'Sunday – Thursday', time: '9:00 – 22:00' },
  { days: 'Friday', time: '14:00 – 23:00' },
  { days: 'Saturday', time: 'Closed' },
];

export const locationSchema = defineBlockSchema({
  type: 'location',
  description:
    'Where to find a business: its address with an "Open in Maps" button (an OpenStreetMap link built from the address, or from `latitude`/`longitude` when given — no API key), opening hours as day and time rows, and call, email and WhatsApp links. `embedMap` (off by default, for privacy) adds an OpenStreetMap embed and needs `latitude` and `longitude`.',
  surfaces: ['site', 'store'],
  props: z.object({
    eyebrow: z.string().min(1).max(40).optional(),
    heading: z.string().min(1).max(90).default('Visit us'),
    body: z.string().min(1).max(240).optional(),
    address: z.string().min(1).max(240).default('18 Market Street, Old Town'),
    addressLabel: z.string().min(1).max(40).default('Address'),
    mapsLabel: z.string().min(1).max(40).default('Open in Maps'),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    embedMap: z.boolean().default(false),
    mapTitle: z.string().min(1).max(80).default('Map'),
    hoursLabel: z.string().min(1).max(40).default('Opening hours'),
    hours: z
      .array(
        z.object({
          days: z.string().min(1).max(40),
          time: z.string().min(1).max(60),
        }),
      )
      .max(10)
      .default(defaultHours),
    hoursNote: z.string().min(1).max(160).optional(),
    contactLabel: z.string().min(1).max(40).default('Contact'),
    phone: phoneSchema.optional(),
    phoneLabel: z.string().min(1).max(40).default('Call'),
    email: emailSchema.optional(),
    emailLabel: z.string().min(1).max(40).default('Email'),
    whatsapp: phoneSchema.optional(),
    whatsappLabel: z.string().min(1).max(40).default('WhatsApp'),
    whatsappMessage: z.string().min(1).max(200).optional(),
    layout: z.enum(locationLayouts).default('split'),
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
    address: { tab: 'content', section: 'Address', kind: 'multiline' },
    addressLabel: { tab: 'content', section: 'Address' },
    mapsLabel: { tab: 'content', section: 'Map' },
    latitude: { tab: 'content', section: 'Map' },
    longitude: { tab: 'content', section: 'Map' },
    embedMap: { tab: 'content', section: 'Map' },
    mapTitle: { tab: 'advanced', section: 'Accessibility' },
    hoursLabel: { tab: 'content', section: 'Opening hours' },
    hours: { tab: 'content', section: 'Opening hours' },
    hoursNote: { tab: 'content', section: 'Opening hours' },
    contactLabel: { tab: 'content', section: 'Contact' },
    phone: { tab: 'content', section: 'Contact' },
    phoneLabel: { tab: 'content', section: 'Contact' },
    email: { tab: 'content', section: 'Contact' },
    emailLabel: { tab: 'content', section: 'Contact' },
    whatsapp: { tab: 'content', section: 'Contact' },
    whatsappLabel: { tab: 'content', section: 'Contact' },
    whatsappMessage: { tab: 'content', section: 'Contact', kind: 'multiline' },
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
  /*
    The section's inner elements (block-parts DESIGN §1): the introduction, the
    address and its label, the maps button, each opening-hours row with its days
    and time, the hours note, and each contact link's label and value. The map
    embed's title is read only by assistive technology, so it stays an
    Inspector row; the coordinates are numbers, not text to edit in place.
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
    addressLabel: {
      kind: 'text',
      bind: 'addressLabel',
      label: { en: 'Address label', ar: 'تسمية العنوان' },
      aliases: ['address heading', 'عنوان الموقع'],
    },
    address: {
      kind: 'text',
      bind: 'address',
      label: { en: 'Address', ar: 'العنوان البريدي' },
      aliases: ['address', 'street', 'location', 'الموقع', 'الشارع', 'العنوان'],
      multiline: true,
    },
    mapsLabel: {
      kind: 'text',
      bind: 'mapsLabel',
      label: { en: 'Maps button', ar: 'زر الخريطة' },
      aliases: ['map link', 'directions', 'open in maps', 'الخريطة', 'الاتجاهات'],
    },
    hoursLabel: {
      kind: 'text',
      bind: 'hoursLabel',
      label: { en: 'Hours heading', ar: 'عنوان المواعيد' },
      aliases: ['opening hours title', 'مواعيد العمل'],
    },
    hours: {
      kind: 'list',
      bind: 'hours',
      label: { en: 'Opening hours', ar: 'مواعيد العمل' },
      aliases: ['hours', 'schedule', 'opening times', 'المواعيد', 'ساعات العمل', 'الدوام'],
    },
    hour: {
      kind: 'item',
      bind: 'hours.*',
      list: 'hours',
      label: { en: 'Hours row', ar: 'صف المواعيد' },
      aliases: ['day', 'row', 'يوم', 'صف'],
    },
    'hour.days': {
      kind: 'text',
      bind: 'hours.*.days',
      label: { en: 'Days', ar: 'الأيام' },
      aliases: ['days', 'day', 'weekdays', 'اليوم'],
    },
    'hour.time': {
      kind: 'text',
      bind: 'hours.*.time',
      label: { en: 'Times', ar: 'الأوقات' },
      aliases: ['time', 'hours', 'open', 'closed', 'الوقت', 'مغلق'],
    },
    hoursNote: {
      kind: 'text',
      bind: 'hoursNote',
      label: { en: 'Hours note', ar: 'ملاحظة المواعيد' },
      aliases: ['holidays', 'note', 'العطل', 'ملاحظة'],
    },
    contactLabel: {
      kind: 'text',
      bind: 'contactLabel',
      label: { en: 'Contact heading', ar: 'عنوان التواصل' },
      aliases: ['contact title', 'التواصل'],
    },
    phoneLabel: {
      kind: 'text',
      bind: 'phoneLabel',
      label: { en: 'Call label', ar: 'تسمية الاتصال' },
      aliases: ['call', 'phone label', 'اتصل'],
    },
    phone: {
      kind: 'text',
      bind: 'phone',
      label: { en: 'Phone number', ar: 'رقم الهاتف' },
      aliases: ['phone', 'tel', 'telephone', 'mobile', 'الهاتف', 'الجوال'],
    },
    emailLabel: {
      kind: 'text',
      bind: 'emailLabel',
      label: { en: 'Email label', ar: 'تسمية البريد' },
      aliases: ['email label', 'راسلنا'],
    },
    email: {
      kind: 'text',
      bind: 'email',
      label: { en: 'Email address', ar: 'البريد الإلكتروني' },
      aliases: ['email', 'mail', 'البريد'],
    },
    whatsappLabel: {
      kind: 'text',
      bind: 'whatsappLabel',
      label: { en: 'WhatsApp label', ar: 'تسمية واتساب' },
      aliases: ['whatsapp label', 'order on whatsapp', 'اطلب عبر واتساب'],
    },
    whatsapp: {
      kind: 'text',
      bind: 'whatsapp',
      label: { en: 'WhatsApp number', ar: 'رقم واتساب' },
      aliases: ['whatsapp', 'واتساب', 'واتس'],
    },
  },
  examples: locationExamples,
});

export type LocationProps = z.output<typeof locationSchema.props>;
