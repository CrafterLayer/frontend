import { z } from 'zod';

import { defineBlockSchema, findRejectedUtilities, partStylesProp } from '@craftkit/builder-schema';

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
    /* Per-part classes and direction (block-parts DESIGN §2.2), under the tokens law. */
    partStyles: partStylesProp(),
  }),
  propertyGroups: {
    label: { tab: 'content' },
    className: { tab: 'advanced', section: 'Custom classes', kind: 'utility-classes' },
    partStyles: { tab: 'advanced', section: 'Custom classes', kind: 'part-styles' },
  },
  inlineEditable: 'label',
  /*
    The label is declared so the Inspector, Layers and the agent address it
    (block-parts DESIGN §1). It is DRAWN by the parent Tabs block as this
    panel's trigger, so this renderer stamps no element for it, and the panel
    itself is the block (a box part on the root would swallow every click that
    should select the panel). Tabs stamps the trigger with
    `forwardedPartProps` (fix pass 2026-10-06): `data-ck-part="label"` plus
    `data-ck-part-owner=<this panel>`, so the tab text is selected and edited
    in place as this panel's part.
  */
  parts: {
    label: {
      kind: 'text',
      bind: 'label',
      label: { en: 'Tab label', ar: 'اسم التبويب' },
      aliases: ['tab', 'title', 'التبويب', 'العنوان'],
    },
  },
  slots: { default: { allow: [...PANEL_CHILDREN] } },
  examples: tabPanelExamples,
});

export type TabPanelProps = z.output<typeof tabPanelSchema.props>;
