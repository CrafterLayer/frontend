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
import { processStepsExamples } from './examples';

const defaultSteps = [
  {
    title: 'Frame the opportunity',
    body: 'Align on the audience, the outcome, and the evidence the page must communicate.',
    meta: 'Discover',
  },
  {
    title: 'Shape the system',
    body: 'Turn the brief into a clear narrative, reusable sections, and intentional visual rules.',
    meta: 'Design',
  },
  {
    title: 'Build with proof',
    body: 'Implement the responsive experience and test the behavior that visitors actually use.',
    meta: 'Deliver',
  },
  {
    title: 'Launch and learn',
    body: 'Publish confidently, measure the result, and evolve the page from real feedback.',
    meta: 'Improve',
  },
];

export const processStepsSchema = defineBlockSchema({
  type: 'processSteps',
  description:
    'An ordered, responsive process for explaining a service methodology, onboarding flow, roadmap, or implementation sequence.',
  surfaces: ['site', 'store'],
  props: z.object({
    eyebrow: z.string().min(1).max(40).default('How it works'),
    heading: z.string().min(1).max(90).default('A clear path from first idea to confident launch'),
    body: z
      .string()
      .min(1)
      .max(200)
      .default(
        'Each stage has a concrete outcome, so progress stays visible and decisions stay focused.',
      ),
    steps: z
      .array(
        z.object({
          title: z.string().min(1).max(64),
          body: z.string().min(1).max(180),
          meta: z.string().min(1).max(32).optional(),
        }),
      )
      .max(8)
      .default(defaultSteps),
    variant: z.enum(['cards', 'minimal', 'accented']).default('cards'),
    layout: z.enum(['horizontal', 'vertical']).default('horizontal'),
    columns: z.enum(['auto', '2', '3', '4']).default('auto'),
    showNumbers: z.boolean().default(true),
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
    body: { tab: 'content', section: 'Text', kind: 'multiline' },
    steps: { tab: 'content', section: 'Steps' },
    variant: { tab: 'design', section: 'Style' },
    layout: { tab: 'design', section: 'Layout' },
    columns: { tab: 'design', section: 'Layout' },
    showNumbers: { tab: 'design', section: 'Visibility' },
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
    step list, each step, and each step's title, text and meta line.
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
    steps: {
      kind: 'list',
      bind: 'steps',
      label: { en: 'Steps', ar: 'الخطوات' },
      aliases: ['process', 'timeline', 'list', 'المراحل', 'القائمة'],
    },
    step: {
      kind: 'item',
      bind: 'steps.*',
      list: 'steps',
      label: { en: 'Step', ar: 'الخطوة' },
      aliases: ['stage', 'phase', 'card', 'مرحلة', 'خطوة'],
    },
    'step.title': {
      kind: 'text',
      bind: 'steps.*.title',
      label: { en: 'Step title', ar: 'عنوان الخطوة' },
      aliases: ['title', 'h3', 'عنوان'],
    },
    'step.body': {
      kind: 'text',
      bind: 'steps.*.body',
      label: { en: 'Step text', ar: 'وصف الخطوة' },
      aliases: ['description', 'text', 'body', 'الوصف', 'النص'],
      multiline: true,
    },
    'step.meta': {
      kind: 'text',
      bind: 'steps.*.meta',
      label: { en: 'Step meta', ar: 'تفصيل الخطوة' },
      aliases: ['meta', 'duration', 'tag', 'المدة', 'وسم'],
    },
  },
  examples: processStepsExamples,
});

export type ProcessStepsProps = z.output<typeof processStepsSchema.props>;
