import type { JsonValue } from '@craftkit/builder-schema';

export const ctaExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'زر تسوق الآن أساسي',
    node: { type: 'cta', props: { label: 'تسوّق الآن', emphasis: 'primary' } },
  },
  {
    prompt: 'secondary learn-more button with a free-trial note',
    node: {
      type: 'cta',
      props: { label: 'Learn more', emphasis: 'ghost', note: 'Free 14-day trial' },
    },
  },
];
