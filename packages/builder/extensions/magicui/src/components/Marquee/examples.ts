import type { JsonValue } from '@craftkit/builder-schema';

export const marqueeExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'a premium moving partner logo row',
    node: {
      type: 'marquee',
      props: {
        label: 'Trusted partners',
        items: [
          { title: 'Northstar', meta: 'Strategy' },
          { title: 'Monument', meta: 'Product' },
          { title: 'Fieldwork', meta: 'Research' },
          { title: 'Continuum', meta: 'Technology' },
          { title: 'Afterglow', meta: 'Design' },
        ],
        presentation: 'logos',
        speed: 'slow',
        edgeFade: true,
      },
    },
  },
  {
    prompt: 'شريط آراء عملاء متحرك وهادئ',
    node: {
      type: 'marquee',
      props: {
        label: 'آراء العملاء',
        items: [
          { title: 'ليان', description: 'أصبح الإطلاق أوضح وأسرع.', meta: 'منتج' },
          { title: 'سامي', description: 'فريق يفهم المشكلة قبل رسم الواجهة.', meta: 'تقنية' },
          { title: 'نور', description: 'نتيجة هادئة ومدروسة من أول مرة.', meta: 'تصميم' },
        ],
        presentation: 'cards',
        rows: 'two',
        direction: 'reverse',
        tone: 'surface',
      },
    },
  },
];
