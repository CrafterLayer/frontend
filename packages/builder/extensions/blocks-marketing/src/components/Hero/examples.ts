import type { JsonValue } from '@craftkit/builder-schema';

/** Few-shots for AI context assembly — written FOR the model. */
export const heroExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'هيرو فخم غامق لمتجر عطور',
    node: {
      type: 'hero',
      props: {
        tone: 'dark',
        align: 'center',
        heading: 'عود يليق بذوقك',
        body: 'تركيبات فاخرة تدوم طويلاً',
      },
    },
  },
  {
    prompt: 'minimal light hero for a SaaS analytics tool',
    node: {
      type: 'hero',
      props: {
        tone: 'light',
        align: 'start',
        heading: 'See your numbers clearly',
        body: 'Realtime analytics without the noise.',
      },
    },
  },
];
