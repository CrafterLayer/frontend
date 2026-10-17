import type { JsonValue } from '@craftkit/builder-schema';

export const buttonExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'a confident primary call to action button',
    node: {
      type: 'button',
      props: {
        label: 'Start building',
        href: '/signup',
        variant: 'solid',
        size: 'large',
        radius: 'pill',
        icon: 'arrow',
        iconPosition: 'end',
      },
    },
  },
  {
    prompt: 'زر عربي ثانوي بعرض كامل',
    node: {
      type: 'button',
      props: {
        label: 'استعرض التفاصيل',
        href: '/ar/details',
        variant: 'outline',
        size: 'medium',
        width: 'full',
        icon: 'arrow',
        iconPosition: 'end',
      },
    },
  },
];
