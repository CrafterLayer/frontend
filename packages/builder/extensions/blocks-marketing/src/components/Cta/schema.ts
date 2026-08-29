import { z } from 'zod';

import { defineBlockSchema } from '@craftkit/builder-schema';

import { sectionColorGroups, sectionColorProps } from '../section-color';
import { sectionSpacingGroups, sectionSpacingProps } from '../section-spacing';
import { sectionTypographyGroups, sectionTypographyProps } from '../section-typography';
import { ctaExamples } from './examples';

export const ctaSchema = defineBlockSchema({
  type: 'cta',
  description:
    'A call-to-action button with a short label and an emphasis level; optionally a small supporting note underneath. Used standalone or inside hero actions.',
  surfaces: ['site', 'store'],
  props: z.object({
    label: z.string().min(1).max(40).default('Get started'),
    emphasis: z.enum(['primary', 'ghost']).default('primary'),
    note: z.string().max(80).optional(),
    size: z.enum(['sm', 'md', 'lg']).default('md'),
    width: z.enum(['fit', 'full']).default('fit'),
    ...sectionColorProps,
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
    note: { tab: 'content', section: 'Text' },
    emphasis: { tab: 'design', section: 'Style' },
    size: { tab: 'design', section: 'Style' },
    width: { tab: 'design', section: 'Width' },
    ...sectionColorGroups,
    ...sectionTypographyGroups,
    ...sectionSpacingGroups,
  },
  examples: ctaExamples,
});

export type CtaProps = z.output<typeof ctaSchema.props>;
