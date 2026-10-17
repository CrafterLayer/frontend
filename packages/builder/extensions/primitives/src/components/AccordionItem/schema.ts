import { z } from 'zod';

import { defineBlockSchema, partStylesProp } from '@craftkit/builder-schema';

import { accordionItemExamples } from './examples';

/**
 * What one accordion item may hold.
 *
 * This is the boundary the whole curated-catalog argument turns on. The item is
 * a heading plus a slot, and that slot accepts ordinary content blocks — so the
 * planner composes freely INSIDE an item while the accordion's keyboard
 * semantics stay intact around it. Bounded vocabulary, unbounded arrangement.
 *
 * `accordion` is deliberately absent from the list. Nesting one accordion
 * inside another produces two competing roving-focus regions, and arrow keys
 * then belong to whichever one React happened to mount first.
 */
const ACCORDION_ITEM_CHILDREN = [
  'stack',
  'grid',
  'richText',
  'image',
  'cta',
  'features',
  'navLinks',
  'button',
  'separator',
  'avatarGroup',
  'progress',
  'gallery',
  'videoSection',
] as const;

export const accordionItemSchema = defineBlockSchema({
  type: 'accordionItem',
  description:
    'One collapsible section inside an accordion: a heading a reader can click, and the content revealed underneath it. Put the answer, description, or details inside its slot.',
  surfaces: ['site', 'store'],
  props: z.object({
    /*
      No `optional()`. An item without a title is a control with no accessible
      name — a button a screen reader announces as nothing at all — so the
      schema refuses one rather than letting the page ship with it.
    */
    title: z.string().min(1).max(120).default('Section title'),
    /* Per-part classes and direction (block-parts DESIGN §2.2), under the tokens law. */
    partStyles: partStylesProp(),
  }),
  propertyGroups: {
    title: { tab: 'content' },
    partStyles: { tab: 'advanced', section: 'Custom classes', kind: 'part-styles' },
  },
  slots: { default: { allow: [...ACCORDION_ITEM_CHILDREN] } },
  inlineEditable: 'title',
  /* The trigger row and its title (block-parts DESIGN §1); the answer is composed from slot children. */
  parts: {
    trigger: {
      kind: 'box',
      label: { en: 'Trigger row', ar: 'صف العنوان' },
      aliases: ['header', 'question row', 'الرأس', 'السؤال'],
    },
    title: {
      kind: 'text',
      bind: 'title',
      label: { en: 'Title', ar: 'العنوان' },
      aliases: ['heading', 'question', 'عنوان', 'السؤال'],
    },
  },
  examples: accordionItemExamples,
});

export type AccordionItemProps = z.output<typeof accordionItemSchema.props>;
