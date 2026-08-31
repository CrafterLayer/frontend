import type { JsonValue } from '@craftkit/builder-schema';

export const breadcrumbsExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'a clean breadcrumb trail from home to the current product',
    node: {
      type: 'breadcrumbs',
      props: {
        label: 'Product breadcrumb',
        items: [
          { label: 'Home', href: '/' },
          { label: 'Shop', href: '/shop' },
          { label: 'Lighting', href: '/shop/lighting' },
          { label: 'Orbit pendant', current: true },
        ],
        separator: 'chevron',
        collapse: 'responsive',
        size: 'medium',
        tone: 'default',
        align: 'start',
      },
    },
  },
  {
    prompt: 'an inverse breadcrumb for a dark documentation header',
    node: {
      type: 'breadcrumbs',
      props: {
        label: 'Documentation breadcrumb',
        items: [
          { label: 'Docs', href: '/docs' },
          { label: 'Components', href: '/docs/components' },
          { label: 'Breadcrumbs', current: true },
        ],
        separator: 'slash',
        collapse: 'none',
        size: 'small',
        tone: 'inverse',
        align: 'start',
      },
    },
  },
  {
    prompt: 'مسار تنقل عربي من الرئيسية إلى صفحة المنتج الحالية',
    node: {
      type: 'breadcrumbs',
      props: {
        label: 'مسار التنقل',
        items: [
          { label: 'الرئيسية', href: '/' },
          { label: 'المتجر', href: '/shop' },
          { label: 'الإضاءة', current: true },
        ],
        separator: 'chevron',
        collapse: 'responsive',
        size: 'medium',
        tone: 'default',
        align: 'start',
      },
    },
  },
];
