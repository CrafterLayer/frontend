import type { JsonValue } from '@craftkit/builder-schema';

/** Few-shots for AI context assembly (page usage inside documents). */
export const pageExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'ابدأ صفحة فارغة',
    node: { type: 'page', props: { title: '' } },
  },
  {
    prompt: 'start a landing page titled Home',
    node: { type: 'page', props: { title: 'Home' } },
  },
];
