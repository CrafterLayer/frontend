import type { JsonValue } from '@craftkit/builder-schema';

export const testimonialsExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'شهادتا عميلين لمتجر',
    node: {
      type: 'testimonials',
      props: {
        heading: 'قالوا عنا',
        items: [
          { quote: 'أفضل تجربة شراء مرّت عليّ.', author: 'سارة', role: 'عميلة دائمة' },
          { quote: 'الشحن وصل بيوم واحد!', author: 'خالد' },
        ],
      },
    },
  },
  {
    prompt: 'one strong developer testimonial',
    node: {
      type: 'testimonials',
      props: {
        heading: 'Developers agree',
        items: [
          {
            quote: 'The deterministic kernel made our tests boring — in the best way.',
            author: 'Rana',
            role: 'Staff Engineer',
          },
        ],
      },
    },
  },
];
