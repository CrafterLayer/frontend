import { z } from 'zod';

import { defineBlockSchema } from '@craftkit/builder-schema';

import {
  sectionAlignments,
  sectionSpacings,
  sectionTones,
  sectionWidths,
  sectionWraps,
} from '../section-options';
import { sectionColorGroups, sectionColorProps } from '../section-color';
import { sectionMotionGroups, sectionMotionProps } from '../section-motion';
import { sectionCustomGroups, sectionCustomProps } from '../section-custom';
import { sectionSpacingGroups, sectionSpacingProps } from '../section-spacing';
import { stackExamples } from './examples';

/**
 * What a container may hold.
 *
 * A Stack accepts every content block AND itself, which is what makes a row of
 * columns possible — the shape a person actually reaches for. Unbounded nesting
 * is the price, and it is a real one: a page nested forty deep is a page nobody
 * can select their way out of. `max` bounds the BREADTH of one stack; depth is
 * bounded by the drop resolver refusing a drop that would exceed what the
 * canvas can render legibly, which is a shell decision rather than a schema one.
 *
 * Listed explicitly rather than computed, because `allow` is a contract other
 * code reads — the drag-and-drop resolver decides legal drops from exactly this
 * list, so a clever expression here becomes an unexplainable refusal there.
 */
const STACK_CHILDREN = [
  'stack',
  'hero',
  'announcementBar',
  'promoBanner',
  'carousel',
  'videoSection',
  'gallery',
  'logoCloud',
  'features',
  'bento-grid',
  'content-section',
  'stats',
  'processSteps',
  'team',
  'portfolioGrid',
  'productGrid',
  'pricing',
  'testimonials',
  'comparisonTable',
  'faq',
  'blogGrid',
  'contact',
  'formSection',
  'newsletter',
  'cta',
  'richText',
  'navLinks',
  'grid',
  'image',
  'button',
  'separator',
  'avatarGroup',
  'progress',
  'breadcrumbs',
  'dialog',
  'pagination',
  'card',
  'tabs',
  'shadcnAlert',
  'accordion',
  'auroraBackground',
  'cloudShader',
  'spotlightSurface',
  'shineBorder',
  'marquee',
  'dotPatternSurface',
  'shimmerButton',
] as const;

export const stackSchema = defineBlockSchema({
  type: 'stack',
  description:
    'A layout container. Holds other blocks in a row or a column, with control over how they are spaced, aligned and wrapped. Nest one inside another to build columns.',
  surfaces: ['site', 'store'],
  props: z.object({
    /*
      `direction` is the whole point of the block, so it has no `optional()`:
      a container whose direction is undefined is a container that renders
      differently depending on a stylesheet nobody can see from the inspector.
    */
    direction: z.enum(['row', 'column']).default('column'),
    justify: z.enum(sectionAlignments).default('start'),
    align: z.enum(sectionAlignments).default('start'),
    gap: z.enum(sectionSpacings).default('md'),
    wrap: z.enum(sectionWraps).default('wrap'),
    tone: z.enum(sectionTones).default('transparent'),
    spacing: z.enum(sectionSpacings).default('none'),
    width: z.enum(sectionWidths).default('standard'),
    ...sectionColorProps,
    ...sectionMotionProps,
    ...sectionCustomProps,
    ...sectionSpacingProps,
  }),
  propertyGroups: {
    direction: { tab: 'design', section: 'Layout' },
    justify: { tab: 'design', section: 'Layout' },
    align: { tab: 'design', section: 'Layout' },
    gap: { tab: 'design', section: 'Layout' },
    wrap: { tab: 'advanced', section: 'Layout' },
    tone: { tab: 'design', section: 'Colour' },
    spacing: { tab: 'design', section: 'Spacing' },
    width: { tab: 'design', section: 'Width' },
    ...sectionColorGroups,
    ...sectionMotionGroups,
    ...sectionCustomGroups,
    ...sectionSpacingGroups,
  },
  slots: { default: { allow: [...STACK_CHILDREN] } },
  examples: stackExamples,
});

export type StackProps = z.output<typeof stackSchema.props>;
