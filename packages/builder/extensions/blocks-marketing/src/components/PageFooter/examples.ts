import type { JsonValue } from '@craftkit/builder-schema';

/** Few-shots for AI context assembly — written FOR the model. */
export const pageFooterExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'فوتر بعمودين وسطر حقوق',
    node: {
      type: 'pageFooter',
      props: {
        statement: 'نصنع أدوات تحرير تُثبت ما تفعله.',
        columns: [
          { heading: 'المنتج', links: [{ label: 'المزايا', href: '/features' }] },
          { heading: 'الشركة', links: [{ label: 'من نحن', href: '/about' }] },
        ],
        legal: '© 2026 CraftKit',
      },
    },
  },
  {
    prompt: 'a dark footer with a legal line',
    node: {
      type: 'pageFooter',
      props: {
        background: 'surfaceInverse',
        textColor: 'textInverse',
        legal: '© 2026 Startly. All rights reserved.',
        spacing: 'lg',
      },
    },
  },
];
