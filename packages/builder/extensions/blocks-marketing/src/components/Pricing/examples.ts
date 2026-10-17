import type { JsonValue } from '@craftkit/builder-schema';

/**
 * Few-shots for AI context assembly — written FOR the model.
 *
 * Neither example carries a `plans` array, and that absence is the lesson. The
 * plans are `pricingPlan` NODES that go in this block's slot, so the assistant
 * has to learn that this section owns the heading and the column count and
 * nothing else. An example showing plan data here would teach exactly the shape
 * that made a button inside a card impossible.
 */
export const pricingExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'ثلاث باقات شهرية والوسطى مميزة',
    node: {
      type: 'pricing',
      props: {
        eyebrow: 'الخطط',
        heading: 'الباقات',
        body: 'اختر الخطة المناسبة اليوم ويمكنك الترقية في أي وقت.',
        columns: '3',
        align: 'center',
        tone: 'dark',
        spacing: 'lg',
        width: 'wide',
      },
    },
  },
  {
    prompt: 'simple two-plan yearly pricing',
    node: {
      type: 'pricing',
      props: {
        heading: 'Simple pricing',
        body: 'Start small and scale when your team is ready.',
        columns: '2',
        align: 'center',
        tone: 'transparent',
        spacing: 'lg',
        width: 'standard',
      },
    },
  },
];
