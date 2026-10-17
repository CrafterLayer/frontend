import { z } from 'zod';

import { defineBlockSchema, motionSpecSchema } from '@craftkit/builder-schema';

import { accordionExamples } from './examples';

/**
 * What an accordion may hold.
 *
 * Exactly one child type, and deliberately so. Radix's accordion assigns
 * keyboard semantics — arrow keys, Home/End, roving focus — across its ITEMS,
 * and a stray block dropped between two items silently breaks that traversal
 * without breaking anything a test would notice. The container therefore holds
 * items and nothing else; arbitrary content goes INSIDE an item, where the
 * accordion has no opinion about it.
 *
 * Listed explicitly rather than computed, because `allow` is a contract the
 * drag-and-drop resolver reads to decide legal drops — a clever expression here
 * becomes an unexplainable refusal there.
 */
const ACCORDION_CHILDREN = ['accordionItem'] as const;

export const accordionSchema = defineBlockSchema({
  type: 'accordion',
  description:
    'A list of collapsible sections. Use for FAQs, product specifications, or any long content a reader should be able to skim before expanding. Holds accordionItem blocks; each item holds its own content.',
  surfaces: ['site', 'store'],
  props: z.object({
    /*
      `single` closes the previous item when a new one opens; `multiple` lets a
      reader hold several open at once. It has no `optional()` because an
      accordion whose behaviour is undefined behaves differently depending on a
      default nobody can see from the inspector.
    */
    mode: z.enum(['single', 'multiple']).default('single'),
    /*
      Whether a reader may close every item. Off by default in `single` mode
      because an FAQ that can show nothing at all reads as broken rather than
      as tidy.
    */
    collapsible: z.boolean().default(true),
    /*
      Which item starts open.

      This lives on the CONTAINER, not on the item, because in Radix the open
      state belongs to the root — an item cannot open itself. Putting it on the
      item would have read better in the inspector and been a lie in the DOM.

      A named intent rather than an index: an index is a literal that silently
      points at the wrong section the moment someone reorders the items.
    */
    defaultOpen: z.enum(['none', 'first']).default('none'),
    motion: motionSpecSchema.optional(),
  }),
  propertyGroups: {
    mode: { tab: 'content', section: 'Behaviour' },
    collapsible: { tab: 'content', section: 'Behaviour' },
    defaultOpen: { tab: 'content', section: 'Behaviour' },
    motion: { tab: 'design', section: 'Motion', kind: 'motion' },
  },
  slots: { default: { allow: [...ACCORDION_CHILDREN] } },
  examples: accordionExamples,
});

export type AccordionProps = z.output<typeof accordionSchema.props>;
