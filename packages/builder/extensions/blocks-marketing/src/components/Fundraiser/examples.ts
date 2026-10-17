import type { JsonValue } from '@craftkit/builder-schema';

export const fundraiserExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'a fundraising section for our school library with a progress bar and donate button',
    node: {
      type: 'fundraiser',
      props: {
        eyebrow: 'Community appeal',
        heading: 'Help us open the new reading room',
        body: 'Every gift buys books, shelves and quiet corners for 600 pupils.',
        raised: 68250,
        goal: 100000,
        currency: '$',
        stats: [
          { value: '1,204', label: 'donors' },
          { value: '18', label: 'days left' },
        ],
        amounts: [
          { label: '$25', href: '/donate?amount=25' },
          { label: '$50', href: '/donate?amount=50' },
          { label: '$100', href: '/donate?amount=100' },
        ],
        actionLabel: 'Donate now',
        actionHref: '/donate',
        note: 'Gifts are tax-deductible. We publish every receipt.',
        imageSrc:
          'https://images.unsplash.com/photo-1505664194779-8beaceb93744?auto=format&fit=crop&w=1600&q=80',
        imageAlt: 'Library of bound law books beside a classical bust',
        layout: 'split',
        align: 'start',
      },
    },
  },
  {
    prompt: 'حملة تبرعات لحفر بئر مع شريط التقدم',
    node: {
      type: 'fundraiser',
      props: {
        heading: 'ساهم في حفر بئر لقرية كاملة',
        body: 'تبرعك يوفر مياهاً نظيفة لأكثر من ٨٠٠ شخص.',
        raised: 145000,
        goal: 200000,
        currency: 'ر.س',
        currencyPosition: 'after',
        raisedLabel: 'جُمع من أصل',
        goalLabel: 'الهدف',
        numberLanguage: 'ar',
        progressLabel: 'نسبة الإنجاز',
        stats: [
          { value: '٣٬٢٠٠', label: 'متبرع' },
          { value: '١٢', label: 'يوماً متبقياً' },
        ],
        actionLabel: 'تبرّع الآن',
        actionHref: '/donate',
        layout: 'card',
        tone: 'light',
      },
    },
  },
];
