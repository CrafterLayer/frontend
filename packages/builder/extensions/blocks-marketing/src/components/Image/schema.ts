import { z } from 'zod';

import { defineBlockSchema, imagePropSchema } from '@craftkit/builder-schema';

import { sectionColorGroups, sectionColorProps } from '../section-color';
import { sectionMotionGroups, sectionMotionProps } from '../section-motion';
import { sectionCustomGroups, sectionCustomProps } from '../section-custom';
import { sectionSpacingGroups, sectionSpacingProps } from '../section-spacing';
import { sectionAlignments, sectionWidths } from '../section-options';
import { imageExamples } from './examples';

export const imageSchema = defineBlockSchema({
  type: 'image',
  description:
    'A responsive image with explicit alternative-text semantics, object-fit controls, and canvas-only setup guidance.',
  surfaces: ['site', 'store', 'docs'],
  props: z.object({
    /**
     * A picture CHOSEN from the site's library, or a labelled absence.
     *
     * This is what a generated site carries, and it is the only kind of image
     * an agent may produce: an id the site's asset table resolves, or a
     * sentence saying why there is nothing here. There is no third state, and
     * in particular no generated address (FR-045).
     *
     * `src` stays for a person typing a URL they own. When both are set the
     * asset wins, because it is the one the site can still resolve after the
     * URL rots.
     */
    asset: imagePropSchema.optional(),
    src: z.string().max(2000).optional(),
    alt: z.string().max(160).default(''),
    decorative: z.boolean().default(false),
    fit: z.enum(['cover', 'contain', 'fill']).default('cover'),
    ratio: z.enum(['auto', 'square', 'wide', 'portrait']).default('auto'),
    radius: z.enum(['none', 'sm', 'md', 'full']).default('none'),
    width: z.enum(sectionWidths).default('standard'),
    align: z.enum(sectionAlignments).default('start'),
    ...sectionColorProps,
    ...sectionMotionProps,
    ...sectionCustomProps,
    ...sectionSpacingProps,
  }),
  propertyGroups: {
    asset: { tab: 'content', section: 'Image' },
    src: { tab: 'content', section: 'Image' },
    alt: { tab: 'content', section: 'Accessibility' },
    decorative: { tab: 'advanced', section: 'Accessibility' },
    fit: { tab: 'design', section: 'Image' },
    ratio: { tab: 'design', section: 'Image' },
    radius: { tab: 'design', section: 'Image' },
    width: { tab: 'design', section: 'Layout' },
    align: { tab: 'design', section: 'Layout' },
    ...sectionColorGroups,
    ...sectionMotionGroups,
    ...sectionCustomGroups,
    ...sectionSpacingGroups,
  },
  examples: imageExamples,
});

export type ImageProps = z.output<typeof imageSchema.props>;
