import type { JsonValue } from '@craftkit/builder-schema';

export const beforeAfterExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'a before and after slider for a living room makeover',
    node: {
      type: 'beforeAfter',
      props: {
        eyebrow: 'Home staging',
        heading: 'Same room, three days later',
        body: 'Drag the handle to see what new light, fabric and a timber wall did for this apartment.',
        beforeSrc:
          'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1600&q=80',
        beforeAlt: 'Living room with a long sofa and leather ottomans',
        afterSrc:
          'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=80',
        afterAlt: 'Open-plan living room with a white sofa and a timber wall',
        caption: 'Riyadh apartment, staged in March 2026.',
        aspect: 'wide',
        align: 'center',
      },
    },
  },
  {
    prompt: 'صور قبل وبعد لتجديد صالة المعيشة',
    node: {
      type: 'beforeAfter',
      props: {
        eyebrow: 'مشاريعنا',
        heading: 'الفرق واضح من النظرة الأولى',
        beforeSrc:
          'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1600&q=80',
        beforeAlt: 'صالة معيشة مضيئة بنوافذ طويلة',
        afterSrc:
          'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1600&q=80',
        afterAlt: 'صالة معيشة بأريكة طويلة ومقاعد جلدية صغيرة',
        beforeLabel: 'قبل',
        afterLabel: 'بعد',
        sliderLabel: 'اسحب للمقارنة بين قبل وبعد',
        start: 40,
        aspect: 'landscape',
        tone: 'light',
      },
    },
  },
];
