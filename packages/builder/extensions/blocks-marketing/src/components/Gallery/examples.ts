import type { JsonValue } from '@craftkit/builder-schema';

export const galleryExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'an editorial architecture gallery with one featured image and concise captions',
    node: {
      type: 'gallery',
      props: {
        eyebrow: 'Selected spaces',
        heading: 'Quiet architecture, shaped around everyday rituals',
        body: 'A study in warm materials, natural light, and details that become more useful over time.',
        layout: 'editorial',
        columns: '3',
        aspect: 'landscape',
        imageFit: 'cover',
        showCaptions: true,
        captionStyle: 'below',
        linkImages: true,
        linkLabel: 'Open project image',
        newTab: true,
        align: 'start',
        tone: 'transparent',
        spacing: 'lg',
        width: 'wide',
        items: [
          {
            src: '/images/projects/courtyard-house.jpg',
            alt: 'Sunlit courtyard framed by pale stone walls',
            caption: 'Courtyard House — morning light across the central garden.',
            href: '/images/projects/courtyard-house-full.jpg',
            featured: true,
          },
          {
            src: '/images/projects/library-detail.jpg',
            alt: 'Oak shelving and a built-in reading bench',
            caption: 'A library designed as part of the architecture.',
          },
          {
            src: '/images/projects/stair-detail.jpg',
            alt: 'Sculptural staircase with a slim metal handrail',
            caption: 'A restrained transition between private and shared rooms.',
          },
        ],
      },
    },
  },
  {
    prompt: 'معرض صور عربي احترافي لمشروع ضيافة فاخر',
    node: {
      type: 'gallery',
      props: {
        eyebrow: 'من التجربة',
        heading: 'تفاصيل تصنع إقامة لا تُنسى',
        body: 'مساحات هادئة تجمع الحرفة المحلية مع راحة معاصرة.',
        layout: 'grid',
        columns: '3',
        aspect: 'square',
        imageFit: 'cover',
        showCaptions: true,
        captionStyle: 'overlay',
        linkImages: false,
        align: 'start',
        tone: 'dark',
        spacing: 'lg',
        width: 'wide',
        items: [
          {
            src: '/images/hospitality/suite.jpg',
            alt: 'جناح واسع بإضاءة طبيعية وأثاث هادئ',
            caption: 'الجناح الرئيسي',
          },
          {
            src: '/images/hospitality/terrace.jpg',
            alt: 'شرفة حجرية تطل على التلال',
            caption: 'إطلالة الغروب',
          },
          {
            src: '/images/hospitality/lounge.jpg',
            alt: 'ردهة بمواد طبيعية وتفاصيل مصنوعة يدوياً',
            caption: 'ردهة الضيوف',
          },
        ],
      },
    },
  },
];
