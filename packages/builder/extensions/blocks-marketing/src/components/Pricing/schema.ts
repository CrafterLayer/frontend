import { z } from 'zod';

import { defineBlockSchema } from '@craftkit/builder-schema';

import {
  sectionAlignments,
  sectionSpacings,
  sectionTones,
  sectionWidths,
} from '../section-options';
import { sectionColorGroups, sectionColorProps } from '../section-color';
import { sectionMotionGroups, sectionMotionProps } from '../section-motion';
import { sectionCustomGroups, sectionCustomProps } from '../section-custom';
import { sectionSpacingGroups, sectionSpacingProps } from '../section-spacing';
import { sectionTypographyGroups, sectionTypographyProps } from '../section-typography';
import { pricingExamples } from './examples';

export const pricingSchema = defineBlockSchema({
  type: 'pricing',
  description:
    'A pricing section: a heading, an optional lead, and a row of plan cards. Put pricingPlan blocks in its slot; each card holds its own feature list and its own call-to-action button.',
  surfaces: ['site', 'store'],
  props: z.object({
    heading: z.string().min(1).max(80).default('Pricing'),
    body: z.string().min(1).max(200).optional(),

    columns: z.enum(['auto', '2', '3', '4']).default('auto'),
    align: z.enum(sectionAlignments).default('start'),
    tone: z.enum(sectionTones).default('transparent'),
    spacing: z.enum(sectionSpacings).default('md'),
    width: z.enum(sectionWidths).default('full'),
    ...sectionColorProps,
    ...sectionMotionProps,
    ...sectionCustomProps,
    ...sectionTypographyProps,
    ...sectionSpacingProps,
  }),
  /*
    Where each property appears in the inspector, declared by the BLOCK.
    
    The inspector never guesses this from a property's name or type — a tab
    strip that sorts rows by an invented rule is the same lie as a tab that does
    nothing. The split follows what a person is DOING: writing the page,
    shaping it, or making a rare structural choice.
  */
  propertyGroups: {
    heading: { tab: 'content', section: 'Text' },
    body: { tab: 'content', section: 'Text', kind: 'multiline' },
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
  /* The section's own text (block-parts DESIGN §1); each plan card is a pricingPlan node with its own parts. */
  parts: {
    heading: {
      kind: 'text',
      bind: 'heading',
      label: { en: 'Heading', ar: 'العنوان' },
      aliases: ['title', 'headline', 'عنوان'],
    },
    body: {
      kind: 'text',
      bind: 'body',
      label: { en: 'Intro', ar: 'المقدمة' },
      aliases: ['lead', 'description', 'paragraph', 'الوصف', 'مقدمة', 'النص'],
      multiline: true,
    },
    plans: {
      kind: 'box',
      label: { en: 'Plan row', ar: 'صف الخطط' },
      aliases: ['grid', 'cards', 'الخطط', 'البطاقات'],
    },
  },
  /*
    The plans are NODES now, not data.

    They were an array of `{ name, price, period, features: string[] }`, which
    could express a feature list and nothing else — so a call-to-action button
    inside a card, the one thing every real pricing section needs, was
    impossible to author. A slot costs nothing and removes the whole class of
    "the schema did not anticipate this".
  */
  slots: { default: { allow: ['pricingPlan'] } },
  examples: pricingExamples,
});

export type PricingProps = z.output<typeof pricingSchema.props>;
