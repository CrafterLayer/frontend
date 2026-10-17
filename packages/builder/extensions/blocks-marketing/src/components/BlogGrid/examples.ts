import type { JsonValue } from '@craftkit/builder-schema';

export const blogGridExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'a premium featured insights section for a SaaS company',
    node: {
      type: 'blogGrid',
      props: {
        eyebrow: 'Field notes',
        heading: 'Practical thinking for ambitious product teams',
        body: 'Research, lessons, and operating principles from teams building the next generation of software.',
        actionLabel: 'Read insight',
        showImages: true,
        variant: 'featured',
        columns: '3',
        align: 'start',
        tone: 'transparent',
        spacing: 'lg',
        width: 'wide',
        posts: [
          {
            title: 'Why the best product systems feel almost invisible',
            excerpt:
              'A field guide to reducing friction without erasing the character that makes a product memorable.',
            href: '/insights/invisible-systems',
            category: 'Product design',
            author: 'Maya Chen',
            publishedLabel: 'August 24, 2026',
            dateTime: '2026-08-24',
            readingTime: '7 min read',
            imageSrc:
              'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1600&q=80',
            imageAlt: 'Laptop and product notes arranged on a focused studio desk',
            featured: true,
          },
          {
            title: 'A calmer operating rhythm for fast teams',
            excerpt:
              'How fewer rituals and clearer decisions create more room for meaningful work.',
            href: '/insights/calm-operating-rhythm',
            category: 'Operations',
            readingTime: '5 min read',
          },
          {
            title: 'Measure trust, not just conversion',
            excerpt:
              'The product signals that reveal whether customers will still choose you next year.',
            href: '/insights/measure-trust',
            category: 'Growth',
            readingTime: '6 min read',
          },
        ],
      },
    },
  },
  {
    prompt: 'قسم مقالات عربي احترافي بدون صور',
    node: {
      type: 'blogGrid',
      props: {
        eyebrow: 'من المدونة',
        heading: 'أفكار تساعدك على البناء بوضوح',
        body: 'مقالات عملية عن التصميم، المنتج، والنمو المستدام.',
        actionLabel: 'اقرأ المقال',
        showImages: false,
        variant: 'editorial',
        columns: '2',
        align: 'start',
        tone: 'light',
        spacing: 'lg',
        width: 'wide',
        posts: [
          {
            title: 'كيف تختصر الطريق من الفكرة إلى الإطلاق',
            excerpt: 'خطوات واضحة لاتخاذ القرارات المهمة مبكرًا.',
            href: '/ar/blog/from-idea-to-launch',
            category: 'المنتج',
            author: 'ليان خليل',
          },
          {
            title: 'نظام تصميم ينمو مع فريقك',
            excerpt: 'بناء لغة مشتركة من دون إضافة طبقات من التعقيد.',
            href: '/ar/blog/design-system',
            category: 'التصميم',
          },
        ],
      },
    },
  },
];
