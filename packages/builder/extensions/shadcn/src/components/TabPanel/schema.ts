import { z } from 'zod';

import { defineBlockSchema, findRejectedUtilities } from '@craftkit/builder-schema';

import { tabPanelExamples } from './examples';

/* A panel holds real content, so it accepts the same range a section does. */
const PANEL_CHILDREN = [
  'richText',
  'image',
  'cta',
  'navLinks',
  'stack',
  'grid',
  'card',
  'badge',
  'shadcnAlert',
  'pricing',
  'features',
  'formSection',
  'gallery',
  'videoSection',
  'portfolioGrid',
  'productGrid',
  'button',
  'separator',
  'avatarGroup',
  'progress',
  'breadcrumbs',
  'pagination',
  'dialog',
  'accordion',
  'shimmerButton',
] as const;

export const tabPanelSchema = defineBlockSchema({
  type: 'tabPanel',
  description:
    'One panel inside a Tabs block. Its label becomes the tab. Put any content inside it.',
  surfaces: ['site', 'store'],
  props: z.object({
    /*
      Short by contract: a tab label that wraps turns the strip into two rows
      and the control stops reading as a row of tabs.
    */
    label: z.string().min(1).max(40).default('Tab'),
    className: z
      .string()
      .max(400)
      .refine((value) => findRejectedUtilities(value).length === 0, {
        error: (issue) =>
          findRejectedUtilities(String(issue.input))
            .map((rejection) => rejection.message)
            .join(' '),
      })
      .optional(),
  }),
  propertyGroups: {
    label: { tab: 'content' },
    className: { tab: 'advanced', section: 'Custom classes', kind: 'utility-classes' },
  },
  inlineEditable: 'label',
  slots: { default: { allow: [...PANEL_CHILDREN] } },
  examples: tabPanelExamples,
});

export type TabPanelProps = z.output<typeof tabPanelSchema.props>;
