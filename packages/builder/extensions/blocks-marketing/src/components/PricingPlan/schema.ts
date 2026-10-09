import { z } from 'zod';

import { defineBlockSchema } from '@craftkit/builder-schema';

import { sectionColorGroups, sectionColorProps } from '../section-color';
import { sectionMotionGroups, sectionMotionProps } from '../section-motion';
import { sectionCustomGroups, sectionCustomProps } from '../section-custom';
import { pricingPlanExamples } from './examples';

/**
 * What one plan may hold.
 *
 * ## Why this block exists
 *
 * `pricing` used to carry its plans as DATA — an array of
 * `{ name, price, period, features: string[] }`. That shape can express a
 * feature list and nothing else. It could not hold a button, an image, a note,
 * a badge, or anything the schema had not anticipated, which meant the one
 * thing every real pricing section needs — a call to action inside each card —
 * was impossible to author. The block was a template, not a builder block.
 *
 * A plan is now a real node with a real slot. The card owns its name, its
 * price, and its emphasis; everything INSIDE it is composed, exactly as it is
 * inside an accordion item.
 *
 * `pricingPlan` is absent from its own list: a plan inside a plan is not a
 * layout anyone means, and permitting it costs a person a confusing drop
 * target for no gain.
 */
const PRICING_PLAN_CHILDREN = [
  'stack',
  'grid',
  'richText',
  'cta',
  'image',
  'navLinks',
  'features',
  'button',
  'badge',
  'separator',
] as const;

export const pricingPlanSchema = defineBlockSchema({
  type: 'pricingPlan',
  description:
    'One plan inside a pricing section: its name, its price, and whatever the card should contain — a feature list, a call-to-action button, a note. Compose the card body from other blocks.',
  surfaces: ['site', 'store'],
  props: z.object({
    name: z.string().min(1).max(40).default('Plan'),
    /*
      A STRING, not a number. Prices are written as people read them —
      "$29", "٢٩ د.أ", "Free", "Contact us" — and a numeric field would force
      a currency decision into the schema that belongs to the copy.
    */
    price: z.string().min(1).max(24).default('$0'),
    period: z.enum(['once', 'month', 'year']).default('month'),
    /*
      The one card a reader's eye should land on first. Emphasis rather than a
      colour: which colour that becomes is the design system's decision, and a
      card that hard-coded its own would stop following the theme.
    */
    emphasis: z.enum(['normal', 'featured']).default('normal'),
    /*
      The card's own words for its badge and its billing period (blocks-polish
      2026-10-08). Both used to be English literals in the component — an
      Arabic page read "Popular" and "per month". Optional: unset, the card
      keeps the English words it always showed.
    */
    badge: z.string().min(1).max(24).optional(),
    periodLabel: z.string().min(1).max(24).optional(),
    ...sectionColorProps,
    ...sectionMotionProps,
    ...sectionCustomProps,
  }),
  propertyGroups: {
    name: { tab: 'content' },
    price: { tab: 'content' },
    period: { tab: 'content' },
    badge: { tab: 'content' },
    periodLabel: { tab: 'content' },
    emphasis: { tab: 'design', section: 'Emphasis' },
    ...sectionColorGroups,
    ...sectionMotionGroups,
    ...sectionCustomGroups,
  },
  slots: { default: { allow: [...PRICING_PLAN_CHILDREN] } },
  inlineEditable: 'name',
  /* The card's own text (block-parts DESIGN §1); its body is composed from slot children. */
  parts: {
    name: {
      kind: 'text',
      bind: 'name',
      label: { en: 'Plan name', ar: 'اسم الخطة' },
      aliases: ['title', 'heading', 'plan', 'العنوان', 'الاسم', 'الخطة'],
    },
    price: {
      kind: 'text',
      bind: 'price',
      label: { en: 'Price', ar: 'السعر' },
      aliases: ['amount', 'cost', 'سعر', 'المبلغ'],
    },
    period: {
      kind: 'text',
      bind: 'periodLabel',
      label: { en: 'Billing period', ar: 'فترة الدفع' },
      aliases: ['per month', 'billing', 'الفترة', 'شهريًا'],
    },
    badge: {
      kind: 'text',
      bind: 'badge',
      label: { en: 'Badge', ar: 'الشارة' },
      aliases: ['popular', 'tag', 'ribbon', 'شارة', 'الأكثر طلبًا'],
    },
  },
  examples: pricingPlanExamples,
});

export type PricingPlanProps = z.output<typeof pricingPlanSchema.props>;
