import { z } from 'zod';

import { defineBlockSchema } from '@craftkit/builder-schema';

import { sectionColorGroups, sectionColorProps } from '../section-color';
import { sectionMotionGroups, sectionMotionProps } from '../section-motion';
import { sectionCustomGroups, sectionCustomProps } from '../section-custom';
import { sectionSpacingGroups, sectionSpacingProps } from '../section-spacing';
import { sectionTypographyGroups, sectionTypographyProps } from '../section-typography';
import { ctaExamples } from './examples';

const safeHref = z
  .string()
  .min(1)
  .max(2000)
  .refine(
    (value) =>
      (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) ||
      value.startsWith('#') ||
      value.startsWith('https://') ||
      value.startsWith('http://') ||
      value.startsWith('mailto:') ||
      value.startsWith('tel:'),
    { message: 'Links must use http(s), mailto, tel, a root-relative path, or an anchor.' },
  );

export const ctaSchema = defineBlockSchema({
  type: 'cta',
  description:
    'A call-to-action button with a short label and an emphasis level; optionally a small supporting note underneath. Used standalone or inside hero actions.',
  surfaces: ['site', 'store'],
  props: z.object({
    label: z.string().min(1).max(40).default('Get started'),
    href: safeHref.optional(),
    newTab: z.boolean().default(false),
    emphasis: z.enum(['primary', 'secondary', 'ghost', 'link']).default('primary'),
    note: z.string().max(80).optional(),
    size: z.enum(['sm', 'md', 'lg']).default('md'),
    width: z.enum(['fit', 'full']).default('fit'),
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
    label: { tab: 'content', section: 'Text' },
    href: { tab: 'content', section: 'Link', kind: 'link' },
    newTab: { tab: 'advanced', section: 'Link' },
    note: { tab: 'content', section: 'Text' },
    emphasis: { tab: 'design', section: 'Style' },
    size: { tab: 'design', section: 'Style' },
    width: { tab: 'design', section: 'Width' },
    ...sectionColorGroups,
    ...sectionMotionGroups,
    ...sectionCustomGroups,
    ...sectionTypographyGroups,
    ...sectionSpacingGroups,
  },
  /*
    The control is a link part (its label and destination together), the label
    text inside it a text part, and the note under it a text part
    (block-parts DESIGN §1).
  */
  parts: {
    button: {
      kind: 'link',
      bind: { text: 'label', href: 'href' },
      label: { en: 'Button', ar: 'الزر' },
      aliases: ['cta', 'link', 'action', 'زر', 'الرابط'],
    },
    label: {
      kind: 'text',
      bind: 'label',
      label: { en: 'Button label', ar: 'نص الزر' },
      aliases: ['text', 'button text', 'النص'],
    },
    note: {
      kind: 'text',
      bind: 'note',
      label: { en: 'Note', ar: 'الملاحظة' },
      aliases: ['caption', 'hint', 'ملاحظة'],
    },
  },
  examples: ctaExamples,
});

export type CtaProps = z.output<typeof ctaSchema.props>;
