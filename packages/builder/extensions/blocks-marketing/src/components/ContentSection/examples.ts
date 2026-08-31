import type { JsonValue } from '@craftkit/builder-schema';

export const contentSectionExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'split story section for a modern architecture studio',
    node: {
      type: 'content-section',
      props: {
        eyebrow: 'Designed around people',
        heading: 'Spaces that feel inevitable, never imposed',
        body: 'We bring research, material intelligence, and quiet precision together to create places that age with character.',
        layout: 'split',
        mediaPosition: 'end',
        imageFit: 'cover',
        imageSrc:
          'https://images.unsplash.com/photo-1487958449943-2429e8be8625?auto=format&fit=crop&w=1600&q=80',
        imageAlt: 'Modern timber and glass home surrounded by trees',
        caption: 'North House — completed 2025',
        highlights: [
          {
            title: 'Context first',
            body: 'Every decision begins with the site and the people who use it.',
          },
          {
            title: 'Built to endure',
            body: 'Low-impact materials selected for performance and graceful aging.',
          },
        ],
        link: { label: 'Explore our approach', href: '/approach' },
        align: 'start',
        tone: 'light',
        spacing: 'lg',
        width: 'wide',
      },
    },
  },
  {
    prompt: 'قسم محتوى عربي تحريري لخدمة استشارية',
    node: {
      type: 'content-section',
      props: {
        eyebrow: 'من الفكرة إلى الأثر',
        heading: 'استراتيجية يفهمها الفريق ويستطيع تنفيذها',
        body: 'نحوّل الأسئلة المعقدة إلى أولويات واضحة، ونبني مع فريقك نظام عمل يستمر بعد انتهاء المشروع.',
        layout: 'editorial',
        highlights: [
          { title: 'تشخيص واقعي', body: 'نبدأ من البيانات والسلوك الفعلي، لا من الافتراضات.' },
          { title: 'تسليم قابل للعمل', body: 'كل توصية مرتبطة بمالك وخطوة وقياس نجاح.' },
        ],
        link: { label: 'تعرّف على منهجيتنا', href: '/method' },
        align: 'start',
        tone: 'transparent',
        spacing: 'lg',
        width: 'standard',
      },
    },
  },
];
