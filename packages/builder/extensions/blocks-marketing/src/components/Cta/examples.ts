import type { JsonValue } from '@craftkit/builder-schema';

export const ctaExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'زر تسوق الآن أساسي',
    node: {
      type: 'cta',
      props: { label: 'تسوّق الآن', href: '/shop', emphasis: 'primary', size: 'lg', width: 'full' },
    },
  },
  {
    prompt: 'secondary learn-more button with a free-trial note',
    node: {
      type: 'cta',
      props: {
        label: 'Learn more',
        href: '#features',
        emphasis: 'link',
        note: 'Free 14-day trial',
        size: 'sm',
        width: 'fit',
      },
    },
  },
];
