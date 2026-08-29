import type { JsonValue } from '@craftkit/builder-schema';

/** Few-shots for AI context assembly — written FOR the model. */
export const pageHeaderExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'هيدر بسيط باسم المتجر وثلاثة روابط',
    node: {
      type: 'pageHeader',
      props: {
        brand: 'متجر العود',
        links: [
          { label: 'المنتجات', href: '/products' },
          { label: 'من نحن', href: '/about' },
          { label: 'تواصل', href: '/contact' },
        ],
        actionLabel: 'تسوّق الآن',
        background: 'surface',
        textColor: 'text',
      },
    },
  },
  {
    prompt: 'a dark sticky header with an accent action',
    node: {
      type: 'pageHeader',
      props: {
        brand: 'Startly',
        tagline: 'Ship faster',
        sticky: true,
        background: 'surfaceInverse',
        textColor: 'textInverse',
        actionLabel: 'Get started',
        width: 'wide',
      },
    },
  },
];
