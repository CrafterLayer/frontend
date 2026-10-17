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
            src: 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?auto=format&fit=crop&w=1800&q=80',
            alt: 'Sunlit courtyard framed by pale stone walls',
            caption: 'Courtyard House — morning light across the central garden.',
            href: 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?auto=format&fit=crop&w=2400&q=90',
            featured: true,
          },
          {
            src: 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1600&q=80',
            alt: 'Oak shelving and a built-in reading bench',
            caption: 'A library designed as part of the architecture.',
          },
          {
            src: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1600&q=80',
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
            src: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1600&q=80',
            alt: 'جناح واسع بإضاءة طبيعية وأثاث هادئ',
            caption: 'الجناح الرئيسي',
          },
          {
            src: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1600&q=80',
            alt: 'شرفة حجرية تطل على التلال',
            caption: 'إطلالة الغروب',
          },
          {
            src: 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1600&q=80',
            alt: 'ردهة بمواد طبيعية وتفاصيل مصنوعة يدوياً',
            caption: 'ردهة الضيوف',
          },
        ],
      },
    },
  },
];
