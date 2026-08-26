import type { JsonValue } from '@craftkit/builder-schema';

export const pricingExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'ثلاث باقات شهرية والوسطى مميزة',
    node: {
      type: 'pricing',
      props: {
        heading: 'الباقات',
        plans: [
          { name: 'البداية', price: '٩$', period: 'month', features: ['مشروع واحد', 'دعم بريدي'] },
          {
            name: 'النمو',
            price: '٢٩$',
            period: 'month',
            features: ['مشاريع بلا حدود', 'دعم أولوية'],
            highlighted: true,
          },
          { name: 'الشركات', price: 'تواصل معنا', period: 'year', features: ['تخصيص كامل'] },
        ],
      },
    },
  },
  {
    prompt: 'simple two-plan yearly pricing',
    node: {
      type: 'pricing',
      props: {
        heading: 'Simple pricing',
        plans: [
          { name: 'Solo', price: '$90', period: 'year', features: ['1 seat'] },
          {
            name: 'Team',
            price: '$290',
            period: 'year',
            features: ['10 seats'],
            highlighted: true,
          },
        ],
      },
    },
  },
];
