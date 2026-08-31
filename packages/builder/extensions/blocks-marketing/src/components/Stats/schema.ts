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
import { statsExamples } from './examples';

const defaultStats = [
  { value: '42%', label: 'Faster launch', detail: 'Measured from brief to published page' },
  { value: '3.4×', label: 'More iterations', detail: 'Without adding review overhead' },
  { value: '99.9%', label: 'Reliable output', detail: 'Across validated production builds' },
  { value: '24/7', label: 'Global workflow', detail: 'Ready whenever the team is' },
];

export const statsSchema = defineBlockSchema({
  type: 'stats',
  description:
    'A proof-oriented metrics section with quantified outcomes, supporting context, and responsive card, minimal, or contrast treatments.',
  surfaces: ['site', 'store'],
  props: z.object({
    eyebrow: z.string().min(1).max(40).default('Measured impact'),
    heading: z.string().min(1).max(90).default('Results that hold up beyond the pitch deck'),
    body: z
      .string()
      .min(1)
      .max(200)
      .default('Clear outcomes, tracked from the first working session through the final launch.'),
    items: z
      .array(
        z.object({
          value: z.string().min(1).max(24),
          label: z.string().min(1).max(56),
          detail: z.string().min(1).max(100).optional(),
        }),
      )
      .max(8)
      .default(defaultStats),
    variant: z.enum(['cards', 'minimal', 'contrast']).default('cards'),
    columns: z.enum(['auto', '2', '3', '4']).default('auto'),
    headerLayout: z.enum(['stacked', 'split']).default('split'),
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
    eyebrow: { tab: 'content', section: 'Text' },
    heading: { tab: 'content', section: 'Text' },
    body: { tab: 'content', section: 'Text' },
    items: { tab: 'content', section: 'Metrics' },
    variant: { tab: 'design', section: 'Style' },
    columns: { tab: 'design', section: 'Layout' },
    headerLayout: { tab: 'design', section: 'Layout' },
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
  examples: statsExamples,
});

export type StatsProps = z.output<typeof statsSchema.props>;
