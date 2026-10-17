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
  {
    prompt: 'a moving row of client case studies with photos that link to each story',
    node: {
      type: 'marquee',
      props: {
        label: 'Client stories',
        items: [
          {
            title: 'Harbor Health',
            description: 'Referrals resolved in days, not weeks.',
            meta: 'Healthcare',
            imageUrl:
              'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=400&q=80',
            imageAlt: 'Clinician reviewing a tablet',
            href: '/work/harbor-health',
          },
          {
            title: 'Ledger & Co',
            description: 'One clear view of company cash flow.',
            meta: 'Finance',
            imageUrl:
              'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=400&q=80',
            imageAlt: 'Dashboard with cash flow charts',
            href: '/work/ledger',
          },
          {
            title: 'Fieldwork',
            description: 'Research that ships into the product.',
            meta: 'Research',
            href: '/work/fieldwork',
          },
        ],
        presentation: 'cards',
        speed: 'slow',
        pauseLabel: 'Pause stories',
        resumeLabel: 'Play stories',
      },
    },
  },
];
