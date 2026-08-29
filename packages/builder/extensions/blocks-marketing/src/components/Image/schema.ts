import { z } from 'zod';

import { defineBlockSchema } from '@craftkit/builder-schema';

import { sectionColorGroups, sectionColorProps } from '../section-color';
import { sectionAlignments, sectionWidths } from '../section-options';
import { imageExamples } from './examples';

export const imageSchema = defineBlockSchema({
  type: 'image',
  description:
    'A responsive image with explicit alternative-text semantics, object-fit controls, and canvas-only setup guidance.',
  surfaces: ['site', 'store', 'docs'],
  props: z.object({
    src: z.string().max(2000).optional(),
    alt: z.string().max(160).default(''),
    decorative: z.boolean().default(false),
    fit: z.enum(['cover', 'contain', 'fill']).default('cover'),
    ratio: z.enum(['auto', 'square', 'wide', 'portrait']).default('auto'),
    radius: z.enum(['none', 'sm', 'md', 'full']).default('none'),
    width: z.enum(sectionWidths).default('standard'),
    align: z.enum(sectionAlignments).default('start'),
    ...sectionColorProps,
  }),
  propertyGroups: {
    src: { tab: 'content', section: 'Image' },
    alt: { tab: 'content', section: 'Accessibility' },
    decorative: { tab: 'advanced', section: 'Accessibility' },
    fit: { tab: 'design', section: 'Image' },
    ratio: { tab: 'design', section: 'Image' },
    radius: { tab: 'design', section: 'Image' },
    width: { tab: 'design', section: 'Layout' },
    align: { tab: 'design', section: 'Layout' },
    ...sectionColorGroups,
  },
  examples: imageExamples,
});

export type ImageProps = z.output<typeof imageSchema.props>;
