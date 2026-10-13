import type { JsonValue } from '@craftkit/builder-schema';

export const pullQuoteExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'a large editorial pull quote from our founder between two sections',
    node: {
      type: 'pullQuote',
      props: {
        quote:
          'We stopped guessing what our customers wanted. Now we ask, we listen, and we ship the answer within a week.',
        author: 'Lina Haddad',
        role: 'Founder, Studio North',
        imageSrc:
          'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1600&q=80',
        imageAlt: 'Smiling woman in a grey blazer by an office window',
        variant: 'plain',
        size: 'xl',
        fontFamily: 'serif',
      },
    },
  },
  {
    prompt: 'اقتباس بارز من مقال صحفي عن الشركة مع رابط المصدر',
    node: {
      type: 'pullQuote',
      props: {
        quote: 'أعادت هذه الشركة تعريف معنى الضيافة في المدينة: تفاصيل صغيرة، واهتمام لا يغيب.',
        author: 'سارة العتيبي',
        role: 'محررة الثقافة',
        source: 'صحيفة الرياض',
        sourceHref: 'https://example.com/article',
        variant: 'rule',
        size: 'lg',
        align: 'start',
        tone: 'light',
      },
    },
  },
  {
    prompt: 'a customer quote in a card on a dark band',
    node: {
      type: 'pullQuote',
      props: {
        quote: 'The first tool our whole team opened without being asked twice.',
        author: 'Omar Farouk',
        role: 'Head of Operations',
        source: 'Northwind case study',
        variant: 'card',
        size: 'md',
        tone: 'dark',
        showMark: false,
      },
    },
  },
];
