import type { JsonValue } from '@craftkit/builder-schema';

/** Few-shots for AI context assembly — written FOR the model. */
export const badgeExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'a "New" tag next to a feature title',
    node: { type: 'badge', props: { label: 'New', variant: 'accent', size: 'small' } },
  },
  {
    prompt: 'شارة "الأكثر شيوعاً" على الباقة الوسطى',
    node: { type: 'badge', props: { label: 'الأكثر شيوعاً', variant: 'success', size: 'regular' } },
  },
];
