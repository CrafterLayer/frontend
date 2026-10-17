import type { JsonValue } from '@craftkit/builder-schema';

export const caseStudyExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt:
      'a customer case study with the challenge, our approach, the results in numbers and a quote',
    node: {
      type: 'caseStudy',
      props: {
        eyebrow: 'Case study',
        client: 'Northwind Logistics',
        heading: 'How Northwind cut delivery times by a third',
        body: 'A regional courier moved dispatch, tracking and invoicing onto one platform in six weeks.',
        metrics: [
          { value: '32%', label: 'faster deliveries' },
          { value: '4.8', label: 'customer rating, up from 4.1' },
          { value: '6 weeks', label: 'from kickoff to launch' },
        ],
        points: [
          {
            label: 'Challenge',
            text: 'Three systems, no shared view of a parcel, and drivers phoning dispatch for every change.',
          },
          {
            label: 'Approach',
            text: 'One live dispatch board, route suggestions for drivers, and automatic customer updates.',
          },
          {
            label: 'Result',
            text: 'Same-day delivery in two new cities without adding a single dispatcher.',
          },
        ],
        quote: 'For the first time, everyone looks at the same parcel at the same moment.',
        quoteAuthor: 'Omar Farouk',
        quoteRole: 'Head of Operations, Northwind',
        imageSrc:
          'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1600&q=80',
        imageAlt: 'Product team talking through work at their desks',
        actionLabel: 'Read the full story',
        actionHref: '/case-studies/northwind',
      },
    },
  },
  {
    prompt: 'دراسة حالة لعميل مع الأرقام والنتائج',
    node: {
      type: 'caseStudy',
      props: {
        eyebrow: 'قصة نجاح',
        client: 'مطاعم السنبلة',
        heading: 'ضاعفنا الطلبات عبر الإنترنت خلال ثلاثة أشهر',
        metrics: [
          { value: '٢×', label: 'الطلبات الإلكترونية' },
          { value: '٤٠٪', label: 'عملاء عائدون' },
        ],
        points: [
          { label: 'التحدي', text: 'قائمة طعام قديمة وتجربة طلب بطيئة على الجوال.' },
          { label: 'الحل', text: 'موقع جديد سريع وقائمة رقمية مرتبطة بالمطبخ مباشرة.' },
        ],
        quote: 'أصبح الطلب من الجوال أسهل من الاتصال.',
        quoteAuthor: 'خالد المطيري',
        quoteRole: 'المدير العام',
        mediaPosition: 'start',
        tone: 'light',
      },
    },
  },
];
