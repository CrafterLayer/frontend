import type { JsonValue } from '@craftkit/builder-schema';

export const promoBannerExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'premium split promotional banner for a product launch',
    node: {
      type: 'promoBanner',
      props: {
        label: 'Now available',
        headline: 'A calmer way to run ambitious launches',
        body: 'Bring planning, approvals, and launch intelligence into one shared operating view.',
        actions: [
          { label: 'Start free', href: '/signup', emphasis: 'primary' },
          { label: 'Book a walkthrough', href: '/demo', emphasis: 'secondary' },
        ],
        imageSrc:
          'https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&w=1600&q=80',
        imageAlt: 'Product team collaborating around a shared table',
        showMedia: true,
        variant: 'split',
        panelStyle: 'inverse',
        mediaPosition: 'end',
        mediaAspect: 'square',
        padding: 'spacious',
        radius: 'xl',
        align: 'start',
        tone: 'transparent',
        spacing: 'lg',
        width: 'wide',
      },
    },
  },
  {
    prompt: 'بانر عرض عربي فاخر مع صورة خلفية',
    node: {
      type: 'promoBanner',
      props: {
        label: 'عرض موسمي',
        headline: 'مساحة جديدة ليومك، بسعر خاص هذا الأسبوع',
        body: 'احجز إقامتك القادمة واستمتع بترقية مجانية وإفطار يومي لشخصين.',
        actions: [
          { label: 'احجز العرض', href: '/offers/autumn', emphasis: 'primary' },
          { label: 'شاهد التفاصيل', href: '#details', emphasis: 'secondary' },
        ],
        imageSrc:
          'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1600&q=80',
        imageAlt: 'ردهة فندق عصرية بإضاءة دافئة',
        showMedia: true,
        variant: 'media',
        panelStyle: 'surface',
        mediaPosition: 'start',
        mediaAspect: 'wide',
        padding: 'comfortable',
        radius: 'xl',
        align: 'start',
        tone: 'light',
        spacing: 'lg',
        width: 'wide',
      },
    },
  },
];
