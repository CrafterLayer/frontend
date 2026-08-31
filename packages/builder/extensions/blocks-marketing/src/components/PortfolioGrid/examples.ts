import type { JsonValue } from '@craftkit/builder-schema';

export const portfolioGridExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'a premium portfolio grid with measurable product outcomes',
    node: {
      type: 'portfolioGrid',
      props: {
        eyebrow: 'Selected work',
        heading: 'Products shaped around the outcome, not the noise',
        body: 'A selection of strategy, design, and engineering partnerships that moved meaningful business metrics.',
        actionLabel: 'Read the case study',
        showMetrics: true,
        variant: 'grid',
        columns: '3',
        align: 'start',
        tone: 'transparent',
        spacing: 'lg',
        width: 'wide',
        items: [
          {
            category: 'Financial technology',
            title: 'A calmer way to understand company cash flow',
            summary:
              'We rebuilt a fragmented finance workflow into one clear operating view for founders and finance teams.',
            imageSrc: '/images/work/ledger.jpg',
            imageAlt: 'Financial dashboard showing cash flow trends and forecasts',
            href: '/work/ledger',
            metrics: [
              { label: 'Faster reporting', value: '4.2×' },
              { label: 'Weekly adoption', value: '86%' },
              { label: 'Support reduction', value: '31%' },
            ],
          },
          {
            category: 'Healthcare',
            title: 'Care coordination without the paperwork maze',
            summary:
              'A role-aware platform that helps clinical teams resolve referrals before patients fall through the cracks.',
            imageSrc: '/images/work/care.jpg',
            imageAlt: 'Care coordination timeline for a patient referral',
            href: '/work/care-coordination',
            metrics: [
              { label: 'Resolution time', value: '−42%' },
              { label: 'Staff satisfaction', value: '9.1/10' },
            ],
          },
          {
            category: 'Commerce',
            title: 'A storefront designed to earn the second purchase',
            summary:
              'Editorial storytelling and a faster purchase path gave a growing homeware brand room to scale.',
            href: '/work/homeware',
            metrics: [
              { label: 'Repeat orders', value: '+28%' },
              { label: 'Conversion', value: '+19%' },
            ],
          },
        ],
      },
    },
  },
  {
    prompt: 'قسم أعمال عربي احترافي بتخطيط تحريري',
    node: {
      type: 'portfolioGrid',
      props: {
        eyebrow: 'أعمال مختارة',
        heading: 'نتائج واضحة لمنتجات تستحق أن تُستخدم',
        body: 'شراكات في الاستراتيجية والتصميم والتطوير صنعت أثرًا يمكن قياسه.',
        actionLabel: 'اقرأ دراسة الحالة',
        showMetrics: true,
        variant: 'editorial',
        columns: '2',
        align: 'start',
        tone: 'light',
        spacing: 'lg',
        width: 'wide',
        items: [
          {
            category: 'التقنية المالية',
            title: 'رؤية أوضح للتدفق النقدي',
            summary:
              'حوّلنا عمليات مالية متفرقة إلى مساحة عمل واحدة تساعد الفرق على اتخاذ القرار بثقة.',
            href: '/ar/work/finance',
            metrics: [
              { label: 'سرعة التقارير', value: '٤٫٢×' },
              { label: 'الاستخدام الأسبوعي', value: '٨٦٪' },
            ],
          },
          {
            category: 'التجارة',
            title: 'متجر يربط القصة بقرار الشراء',
            summary:
              'تجربة تحريرية سريعة ساعدت العلامة على رفع التحويل وبناء علاقة أطول مع عملائها.',
            href: '/ar/work/commerce',
            metrics: [{ label: 'نمو التحويل', value: '+١٩٪' }],
          },
        ],
      },
    },
  },
];
