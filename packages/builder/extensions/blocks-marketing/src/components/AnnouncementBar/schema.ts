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
import { announcementBarExamples } from './examples';

const announcementHref = z
  .string()
  .min(1)
  .max(240)
  .refine(
    (value) =>
      value.startsWith('#') ||
      (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) ||
      /^(https?:\/\/|mailto:|tel:)/i.test(value),
    {
      error: 'Use a relative path, fragment, or an http, https, mailto, or tel URL.',
    },
  );

export const announcementBarSchema = defineBlockSchema({
  type: 'announcementBar',
  description:
    'A compact announcement band with a short status label, message, and safe destination link.',
  surfaces: ['site', 'store'],
  props: z.object({
    label: z.string().min(1).max(24).default('New'),
    message: z
      .string()
      .min(1)
      .max(160)
      .default('A sharper way to launch polished pages is now available.'),
    linkLabel: z.string().min(1).max(40).default('Explore the release'),
    href: announcementHref.default('#details'),
    showLabel: z.boolean().default(true),
    showLink: z.boolean().default(true),
    emphasis: z.enum(['subtle', 'accent', 'inverse']).default('accent'),
    layout: z.enum(['inline', 'split']).default('inline'),
    density: z.enum(['compact', 'regular']).default('compact'),
    align: z.enum(sectionAlignments).default('center'),
    tone: z.enum(sectionTones).default('transparent'),
    spacing: z.enum(sectionSpacings).default('none'),
    width: z.enum(sectionWidths).default('wide'),
    ...sectionColorProps,
    ...sectionMotionProps,
    ...sectionCustomProps,
    ...sectionTypographyProps,
    ...sectionSpacingProps,
  }),
  propertyGroups: {
    label: { tab: 'content', section: 'Message' },
    message: { tab: 'content', section: 'Message' },
    linkLabel: { tab: 'content', section: 'Link' },
    href: { tab: 'content', section: 'Link' },
    showLabel: { tab: 'design', section: 'Visibility' },
    showLink: { tab: 'design', section: 'Visibility' },
    emphasis: { tab: 'design', section: 'Style' },
    layout: { tab: 'design', section: 'Layout' },
    density: { tab: 'design', section: 'Layout' },
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
  inlineEditable: 'message',
  examples: announcementBarExamples,
});

export type AnnouncementBarProps = z.output<typeof announcementBarSchema.props>;
