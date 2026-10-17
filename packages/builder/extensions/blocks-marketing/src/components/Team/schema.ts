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
import { teamExamples } from './examples';

export const teamVariants = ['cards', 'editorial', 'compact'] as const;
export const teamColumns = ['2', '3', '4'] as const;

const safeHrefSchema = z
  .string()
  .min(1)
  .max(2000)
  .refine(
    (value) =>
      value.startsWith('#') ||
      (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) ||
      /^(https?:\/\/|mailto:|tel:)/i.test(value),
    {
      message: 'Profile link must be relative or use http, https, mailto, or tel.',
    },
  );

export const teamSchema = defineBlockSchema({
  type: 'team',
  description:
    'A professional people section with responsive card, editorial, and compact layouts; optional portraits, biographies, and profile links.',
  surfaces: ['site', 'store'],
  props: z.object({
    eyebrow: z.string().min(1).max(40).optional(),
    heading: z.string().min(1).max(80).default('Meet the team'),
    body: z.string().min(1).max(240).optional(),
    members: z
      .array(
        z.object({
          name: z.string().min(1).max(60),
          role: z.string().min(1).max(80),
          bio: z.string().min(1).max(220).optional(),
          imageSrc: z.string().min(1).max(2000).optional(),
          imageAlt: z.string().max(160).optional(),
          profileHref: safeHrefSchema.optional(),
        }),
      )
      .max(12)
      .default([]),
    profileLabel: z.string().min(1).max(40).default('View profile'),
    variant: z.enum(teamVariants).default('cards'),
    columns: z.enum(teamColumns).default('4'),
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
    members: { tab: 'content', section: 'People' },
    profileLabel: { tab: 'content', section: 'People' },
    variant: { tab: 'design', section: 'Layout' },
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
    people grid, each person, and each person's name, role, bio and portrait.

    `profileLabel` is ONE value shown in every profile link, so it is one
    top-level part: editing it in any card edits them all. Each link's
    destination stays in the person's row in the Inspector.
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
    members: {
      kind: 'list',
      bind: 'members',
      label: { en: 'People', ar: 'الأشخاص' },
      aliases: ['team', 'members', 'grid', 'الفريق', 'الأعضاء'],
    },
    member: {
      kind: 'item',
      bind: 'members.*',
      list: 'members',
      label: { en: 'Person', ar: 'الشخص' },
      aliases: ['member', 'card', 'profile', 'عضو', 'بطاقة'],
    },
    'member.name': {
      kind: 'text',
      bind: 'members.*.name',
      label: { en: 'Name', ar: 'الاسم' },
      aliases: ['name', 'person name', 'h3', 'اسم'],
    },
    'member.role': {
      kind: 'text',
      bind: 'members.*.role',
      label: { en: 'Role', ar: 'المنصب' },
      aliases: ['role', 'title', 'job', 'position', 'الوظيفة'],
    },
    'member.bio': {
      kind: 'text',
      bind: 'members.*.bio',
      label: { en: 'Bio', ar: 'النبذة' },
      aliases: ['bio', 'biography', 'about', 'description', 'نبذة', 'الوصف'],
      multiline: true,
    },
    'member.image': {
      kind: 'image',
      bind: { src: 'members.*.imageSrc', alt: 'members.*.imageAlt' },
      label: { en: 'Portrait', ar: 'الصورة' },
      aliases: ['photo', 'picture', 'avatar', 'image', 'صورة', 'الصورة الشخصية'],
    },
    profileLabel: {
      kind: 'text',
      bind: 'profileLabel',
      label: { en: 'Profile link text', ar: 'نص رابط الملف' },
      aliases: ['profile link', 'link text', 'view profile', 'رابط الملف', 'نص الرابط'],
    },
  },
  examples: teamExamples,
});

export type TeamProps = z.output<typeof teamSchema.props>;
