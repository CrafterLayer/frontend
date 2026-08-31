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
  .refine((value) => /^(#|\/|https?:\/\/|mailto:|tel:)/i.test(value), {
    message: 'Profile link must be relative or use http, https, mailto, or tel.',
  });

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
    body: { tab: 'content', section: 'Introduction' },
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
  examples: teamExamples,
});

export type TeamProps = z.output<typeof teamSchema.props>;
