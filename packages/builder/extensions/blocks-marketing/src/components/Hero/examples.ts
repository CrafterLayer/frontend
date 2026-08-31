import type { JsonValue } from '@craftkit/builder-schema';

/** Few-shots for AI context assembly — written FOR the model. */
export const heroExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'هيرو فخم غامق لمتجر عطور',
    node: {
      type: 'hero',
      props: {
        variant: 'editorial',
        eyebrow: 'مجموعة العود الخاصة',
        tone: 'dark',
        align: 'center',
        spacing: 'lg',
        width: 'wide',
        layoutDirection: 'row',
        layoutJustify: 'center',
        layoutAlign: 'center',
        layoutGap: 'lg',
        layoutWrap: 'wrap',
        heading: 'عود يليق بذوقك',
        body: 'تركيبات فاخرة تدوم طويلاً',
        trustLine: 'شحن مجاني · استبدال خلال 30 يوماً',
      },
    },
  },
  {
    prompt: 'minimal light hero for a SaaS analytics tool',
    node: {
      type: 'hero',
      props: {
        variant: 'split',
        eyebrow: 'Analytics without blind spots',
        tone: 'light',
        align: 'end',
        spacing: 'md',
        width: 'narrow',
        layoutDirection: 'column',
        layoutJustify: 'start',
        layoutAlign: 'end',
        layoutGap: 'sm',
        layoutWrap: 'nowrap',
        heading: 'See your numbers clearly',
        body: 'Realtime analytics without the noise.',
      },
    },
  },
];
