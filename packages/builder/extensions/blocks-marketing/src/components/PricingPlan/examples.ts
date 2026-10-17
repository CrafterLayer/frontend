import type { JsonValue } from '@craftkit/builder-schema';

/**
 * Few-shots for AI context assembly — written FOR the model.
 *
 * Both name a real plan rather than "Plan 1", and one is featured, so the
 * assistant learns that emphasis is a property of ONE card rather than a
 * separate block type. Neither carries a feature list: the list lives in the
 * slot, and showing it here would teach the wrong shape.
 */
export const pricingPlanExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'the starter plan',
    node: {
      type: 'pricingPlan',
      props: { name: 'Starter', price: '$0', period: 'month', emphasis: 'normal' },
    },
  },
  {
    prompt: 'الخطة الأشهر، بسعر شهري',
    node: {
      type: 'pricingPlan',
      props: { name: 'Pro', price: '$29', period: 'month', emphasis: 'featured' },
    },
  },
];
