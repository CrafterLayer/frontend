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
import { logoCloudExamples } from './examples';

const defaultLogos = [
  { name: 'Northstar', descriptor: 'Analytics' },
  { name: 'Kinetic', descriptor: 'Infrastructure' },
  { name: 'Meridian', descriptor: 'Commerce' },
  { name: 'Luma', descriptor: 'Creative tools' },
  { name: 'Arcform', descriptor: 'Operations' },
  { name: 'Canopy', descriptor: 'Collaboration' },
];

export const logoCloudSchema = defineBlockSchema({
  type: 'logoCloud',
  description:
    'A responsive social-proof section for customer, partner, publication, or integration names without requiring external image assets.',
  surfaces: ['site', 'store'],
  props: z.object({
    eyebrow: z.string().min(1).max(40).default('Trusted in production'),
    heading: z.string().min(1).max(90).default('The teams shaping what comes next build with us'),
    body: z.string().min(1).max(180).optional(),
    items: z
      .array(
        z.object({
          name: z.string().min(1).max(32),
          descriptor: z.string().min(1).max(48).optional(),
        }),
      )
      .max(12)
      .default(defaultLogos),
    variant: z.enum(['minimal', 'cards', 'framed']).default('cards'),
    columns: z.enum(['3', '4', '5', '6']).default('6'),
    align: z.enum(sectionAlignments).default('center'),
    tone: z.enum(sectionTones).default('light'),
    spacing: z.enum(sectionSpacings).default('md'),
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
    body: { tab: 'content', section: 'Text', kind: 'multiline' },
    items: { tab: 'content', section: 'Brands' },
    variant: { tab: 'design', section: 'Style' },
    columns: { tab: 'design', section: 'Layout' },
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
    The section's inner elements (block-parts DESIGN §1): the intro text, the
    brand grid, each brand, and each brand's name and descriptor. The
    monogram is decoration derived from the name, not a part.
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
    items: {
      kind: 'list',
      bind: 'items',
      label: { en: 'Brands', ar: 'العلامات' },
      aliases: ['logos', 'clients', 'grid', 'الشعارات', 'العملاء'],
    },
    item: {
      kind: 'item',
      bind: 'items.*',
      list: 'items',
      label: { en: 'Brand', ar: 'العلامة' },
      aliases: ['logo', 'client', 'tile', 'شعار', 'عميل'],
    },
    'item.name': {
      kind: 'text',
      bind: 'items.*.name',
      label: { en: 'Brand name', ar: 'اسم العلامة' },
      aliases: ['name', 'company', 'الاسم', 'الشركة'],
    },
    'item.descriptor': {
      kind: 'text',
      bind: 'items.*.descriptor',
      label: { en: 'Brand descriptor', ar: 'وصف العلامة' },
      aliases: ['descriptor', 'tagline', 'industry', 'الوصف', 'المجال'],
    },
  },
  examples: logoCloudExamples,
});

export type LogoCloudProps = z.output<typeof logoCloudSchema.props>;
