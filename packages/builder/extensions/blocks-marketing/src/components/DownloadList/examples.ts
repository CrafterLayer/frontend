import type { JsonValue } from '@craftkit/builder-schema';

export const downloadListExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'a downloads section with our company profile, price list and brand kit',
    node: {
      type: 'downloadList',
      props: {
        eyebrow: 'Resources',
        heading: 'Everything to take with you',
        body: 'The documents partners and press ask us for most.',
        files: [
          {
            title: 'Company profile 2026',
            description: 'Who we are, what we do and the clients we do it for.',
            format: 'PDF',
            size: '3.2 MB',
            href: '/files/company-profile-2026.pdf',
          },
          {
            title: 'Price list',
            description: 'Every service with its starting price.',
            format: 'PDF',
            size: '480 KB',
            href: '/files/price-list.pdf',
          },
          {
            title: 'Brand kit',
            description: 'Logos, colours and type for partners and press.',
            format: 'ZIP',
            size: '18 MB',
            href: 'https://cdn.example.com/brand-kit.zip',
          },
        ],
        downloadLabel: 'Download',
        layout: 'list',
      },
    },
  },
  {
    prompt: 'ملفات للتحميل: قائمة الطعام والملف التعريفي',
    node: {
      type: 'downloadList',
      props: {
        heading: 'ملفات للتحميل',
        files: [
          { title: 'قائمة الطعام', format: 'PDF', size: '١٫٢ م.ب', href: '/files/menu.pdf' },
          {
            title: 'الملف التعريفي للشركة',
            description: 'نبذة عن خدماتنا وفروعنا.',
            format: 'PDF',
            size: '٤ م.ب',
            href: '/files/profile.pdf',
          },
          { title: 'نموذج طلب فعالية', format: 'DOCX', href: '/files/event-request.docx' },
        ],
        downloadLabel: 'تحميل',
        layout: 'cards',
        tone: 'light',
      },
    },
  },
];
