import type { JsonValue } from '@craftkit/builder-schema';

export const featuresExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'ثلاث مزايا لمنصة تحليلات',
    node: {
      type: 'features',
      props: {
        heading: 'لماذا نحن؟',
        columns: '3',
        items: [
          { title: 'سرعة فائقة', body: 'لوحات تتحدث لحظياً بدون انتظار.' },
          { title: 'خصوصية أولاً', body: 'بياناتك تبقى عندك دائماً.' },
          { title: 'تكامل سهل', body: 'اربط أدواتك بدقائق.' },
        ],
      },
    },
  },
  {
    prompt: 'two-column feature grid for a developer tool',
    node: {
      type: 'features',
      props: {
        heading: 'Built for developers',
        columns: '2',
        items: [
          { title: 'Typed end to end', body: 'Contracts checked at every boundary.' },
          { title: 'Deterministic', body: 'Same input, same output, every run.' },
        ],
      },
    },
  },
];
