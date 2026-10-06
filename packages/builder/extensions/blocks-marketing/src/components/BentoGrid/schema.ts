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
import { bentoGridExamples } from './examples';

export const bentoGridSchema = defineBlockSchema({
  type: 'bento-grid',
  description:
    'A premium bento section with explicit card hierarchy, metrics, and equal or mosaic layouts.',
  surfaces: ['site', 'store'],
  props: z.object({
    eyebrow: z.string().min(1).max(40).optional(),
    heading: z.string().min(1).max(100).default('Built for the way your team works'),
    body: z.string().min(1).max(240).optional(),
    items: z
      .array(
        z.object({
          kicker: z.string().min(1).max(32).optional(),
          title: z.string().min(1).max(72),
          body: z.string().min(1).max(220),
          metric: z.string().min(1).max(24).optional(),
          size: z.enum(['small', 'wide', 'tall', 'featured']).default('small'),
          emphasis: z.enum(['neutral', 'accent', 'inverse']).default('neutral'),
        }),
      )
      .max(12)
      .default([]),
    layout: z.enum(['mosaic', 'equal']).default('mosaic'),
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
    items: { tab: 'content', section: 'Cards' },
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
    The grid's inner elements (block-parts DESIGN §1): the intro text, the
    card grid, each card, and each card's kicker, metric, title and text.
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
      label: { en: 'Cards', ar: 'البطاقات' },
      aliases: ['grid', 'bento', 'tiles', 'الشبكة', 'المربعات'],
    },
    item: {
      kind: 'item',
      bind: 'items.*',
      list: 'items',
      label: { en: 'Card', ar: 'البطاقة' },
      aliases: ['tile', 'cell', 'بطاقة', 'مربع'],
    },
    'item.kicker': {
      kind: 'text',
      bind: 'items.*.kicker',
      label: { en: 'Card kicker', ar: 'تمهيد البطاقة' },
      aliases: ['kicker', 'label', 'tag', 'وسم'],
    },
    'item.metric': {
      kind: 'text',
      bind: 'items.*.metric',
      label: { en: 'Card metric', ar: 'رقم البطاقة' },
      aliases: ['metric', 'number', 'stat', 'value', 'الرقم', 'القيمة'],
    },
    'item.title': {
      kind: 'text',
      bind: 'items.*.title',
      label: { en: 'Card title', ar: 'عنوان البطاقة' },
      aliases: ['card heading', 'h3', 'عنوان'],
    },
    'item.body': {
      kind: 'text',
      bind: 'items.*.body',
      label: { en: 'Card text', ar: 'نص البطاقة' },
      aliases: ['card body', 'description', 'وصف البطاقة'],
      multiline: true,
    },
  },
  examples: bentoGridExamples,
});

export type BentoGridProps = z.output<typeof bentoGridSchema.props>;
