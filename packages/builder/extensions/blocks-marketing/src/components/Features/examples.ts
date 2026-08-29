import type { JsonValue } from '@craftkit/builder-schema';

export const featuresExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'ثلاث مزايا لمنصة تحليلات',
    node: {
      type: 'features',
      props: {
        heading: 'لماذا نحن؟',
        body: 'كل ما تحتاجه لاتخاذ قرار أسرع بثقة.',
        columns: '3',
        align: 'center',
        tone: 'light',
        spacing: 'lg',
        width: 'standard',
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
        body: 'The foundations your team expects, without the ceremony.',
        columns: '2',
        align: 'start',
        tone: 'transparent',
        spacing: 'md',
        width: 'narrow',
        items: [
          { title: 'Typed end to end', body: 'Contracts checked at every boundary.' },
          { title: 'Deterministic', body: 'Same input, same output, every run.' },
        ],
      },
    },
  },
];
