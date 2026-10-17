import type { JsonValue } from '@craftkit/builder-schema';

export const appDownloadExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'promote our mobile app with store buttons and a phone screenshot',
    node: {
      type: 'appDownload',
      props: {
        eyebrow: 'The Northwind app',
        heading: 'Your deliveries, tracked from your pocket',
        body: 'Book a pickup, follow every parcel live and pay in one tap — on iPhone and Android.',
        features: [
          'Live tracking with a two-minute arrival window',
          'Saved addresses and one-tap rebooking',
          'Receipts and invoices in one place',
        ],
        stores: [
          {
            icon: 'phone',
            kicker: 'Download on the',
            label: 'App Store',
            href: 'https://example.com/ios',
          },
          {
            icon: 'play',
            kicker: 'Get it on',
            label: 'Google Play',
            href: 'https://example.com/android',
          },
        ],
        note: 'Rated 4.8 by 12,000 people',
        imageSrc:
          'https://images.unsplash.com/photo-1551650975-87deedd944c3?auto=format&fit=crop&w=1600&q=80',
        imageAlt: 'Hand holding a phone with a finance dashboard app',
        layout: 'split',
        mediaPosition: 'end',
        tone: 'light',
      },
    },
  },
  {
    prompt: 'قسم لتحميل تطبيق المطعم من المتاجر',
    node: {
      type: 'appDownload',
      props: {
        eyebrow: 'تطبيقنا',
        heading: 'اطلب وجبتك المفضلة بلمسة واحدة',
        body: 'تابع طلبك لحظة بلحظة، واجمع النقاط مع كل طلب.',
        features: ['توصيل خلال ٣٠ دقيقة', 'عروض حصرية لمستخدمي التطبيق'],
        stores: [
          {
            icon: 'phone',
            kicker: 'حمّله من',
            label: 'App Store',
            href: 'https://example.com/ios',
          },
          {
            icon: 'play',
            kicker: 'احصل عليه من',
            label: 'Google Play',
            href: 'https://example.com/android',
          },
          { icon: 'globe', label: 'اطلب من الموقع', href: '/order' },
        ],
        layout: 'centered',
        showDevice: false,
        tone: 'dark',
      },
    },
  },
];
