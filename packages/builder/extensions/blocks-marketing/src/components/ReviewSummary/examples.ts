import type { JsonValue } from '@craftkit/builder-schema';

export const reviewSummaryExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'an average rating with a star breakdown and three recent reviews for our clinic',
    node: {
      type: 'reviewSummary',
      props: {
        eyebrow: 'Patient reviews',
        heading: 'Rated 4.9 by the people we care for',
        average: 4.9,
        totalLabel: 'Based on 864 Google reviews',
        breakdown: [
          { label: '5 stars', count: 801 },
          { label: '4 stars', count: 42 },
          { label: '3 stars', count: 12 },
          { label: '2 stars', count: 5 },
          { label: '1 star', count: 4 },
        ],
        reviews: [
          {
            quote: 'Calm, careful and on time. The hygienist explained every step.',
            author: 'Hana M.',
            meta: 'March 2026',
            rating: 5,
          },
          {
            quote: 'Booked online at night and was seen the next morning.',
            author: 'Yousef A.',
            meta: 'Verified patient',
            rating: 5,
          },
          {
            quote: 'Great result; parking nearby is the only downside.',
            author: 'Claire D.',
            rating: 4,
          },
        ],
        actionLabel: 'Read all reviews',
        actionHref: 'https://example.com/reviews',
      },
    },
  },
  {
    prompt: 'ملخص تقييمات العملاء مع متوسط التقييم وتوزيع النجوم',
    node: {
      type: 'reviewSummary',
      props: {
        heading: 'ماذا يقول عملاؤنا',
        body: 'تقييمات حقيقية من عملائنا خلال العام الماضي.',
        average: 4.6,
        totalLabel: 'من ٥٢٠ تقييماً',
        ratingLabel: '{rating} من ٥ نجوم',
        numberLanguage: 'ar',
        breakdown: [
          { label: '٥ نجوم', count: 380 },
          { label: '٤ نجوم', count: 96 },
          { label: '٣ نجوم', count: 28 },
          { label: 'نجمتان', count: 9 },
          { label: 'نجمة', count: 7 },
        ],
        reviews: [
          {
            quote: 'خدمة سريعة وتعامل راقٍ، والأسعار واضحة من البداية.',
            author: 'عبدالله',
            meta: 'الرياض',
            rating: 5,
          },
          { quote: 'التوصيل تأخر قليلاً لكن الجودة ممتازة.', author: 'نورة', rating: 4 },
        ],
        tone: 'light',
      },
    },
  },
];
