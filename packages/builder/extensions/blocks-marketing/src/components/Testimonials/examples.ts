import type { JsonValue } from '@craftkit/builder-schema';

export const testimonialsExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'شهادتا عميلين لمتجر',
    node: {
      type: 'testimonials',
      props: {
        eyebrow: 'ثقة تُبنى بالتجربة',
        heading: 'قالوا عنا',
        body: 'تجارب حقيقية من عملاء يعودون إلينا كل مرة.',
        columns: '2',
        align: 'center',
        tone: 'light',
        spacing: 'lg',
        width: 'wide',
        variant: 'spotlight',
        items: [
          { quote: 'أفضل تجربة شراء مرّت عليّ.', author: 'سارة', role: 'عميلة دائمة', rating: 5 },
          { quote: 'الشحن وصل بيوم واحد!', author: 'خالد', rating: 5 },
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
        body: 'One clear signal from the people maintaining the system.',
        columns: '1',
        align: 'start',
        tone: 'transparent',
        spacing: 'md',
        width: 'narrow',
        variant: 'wall',
        items: [
          {
            quote: 'The deterministic kernel made our tests boring — in the best way.',
            author: 'Rana',
            role: 'Staff Engineer',
            company: 'Northstar',
            rating: 5,
          },
        ],
      },
    },
  },
];
