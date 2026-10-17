import type { JsonValue } from '@craftkit/builder-schema';

/**
 * Few-shots for AI context assembly — written FOR the model.
 *
 * Both put the aurora where a person actually wants it: behind the top of a
 * page. The second turns the drift off, so the assistant learns that stillness
 * is a choice rather than an absence of one.
 */
export const auroraExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'a hero with a soft animated gradient behind it',
    node: {
      type: 'auroraBackground',
      props: { intensity: 'normal', animate: true, minHeight: 'half' },
    },
  },
  {
    prompt: 'خلفية متدرجة هادئة بدون حركة',
    node: {
      type: 'auroraBackground',
      props: { intensity: 'subtle', animate: false, minHeight: 'none' },
    },
  },
];
