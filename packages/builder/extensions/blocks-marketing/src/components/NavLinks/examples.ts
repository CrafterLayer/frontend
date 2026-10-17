import type { JsonValue } from '@craftkit/builder-schema';

export const navLinksExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'روابط تنقّل عربية أفقية للرئيسية والمنتجات والتواصل',
    node: {
      type: 'navLinks',
      props: {
        links: [
          { label: 'الرئيسية', href: '/' },
          { label: 'المنتجات', href: '/products' },
          { label: 'تواصل معنا', href: '/contact' },
        ],
        direction: 'row',
        style: 'underline',
        textCase: 'normal',
        fontWeight: 'medium',
        gap: 'md',
        wrap: 'wrap',
      },
    },
  },
  {
    prompt: 'vertical footer links for company pages',
    node: {
      type: 'navLinks',
      props: {
        links: [
          { label: 'About', href: '/about' },
          { label: 'Careers', href: '/careers' },
          { label: 'Contact', href: '/contact' },
        ],
        direction: 'column',
        style: 'plain',
        textCase: 'normal',
        fontWeight: 'regular',
        gap: 'sm',
        wrap: 'nowrap',
      },
    },
  },
];
