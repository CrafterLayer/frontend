import type { JsonValue } from '@craftkit/builder-schema';

export const newsletterExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'premium split newsletter signup for a design publication',
    node: {
      type: 'newsletter',
      props: {
        eyebrow: 'The Sunday edit',
        heading: 'One thoughtful idea for better digital work',
        body: 'A concise weekly note on products, systems, and the people shaping them.',
        emailLabel: 'Work email',
        placeholder: 'name@company.com',
        buttonLabel: 'Join the list',
        privacy: 'No noise. Unsubscribe in one click. Read our privacy policy.',
        action: '/newsletter/subscribe',
        variant: 'split',
        formLayout: 'row',
        align: 'start',
        tone: 'transparent',
        spacing: 'lg',
        width: 'wide',
      },
    },
  },
  {
    prompt: 'نموذج نشرة عربية بسيط داخل بطاقة',
    node: {
      type: 'newsletter',
      props: {
        eyebrow: 'رسالة كل أسبوع',
        heading: 'أفكار عملية تساعد مشروعك على النمو',
        body: 'ملخص قصير وواضح من تجارب حقيقية، يصل إلى بريدك صباح الخميس.',
        emailLabel: 'البريد الإلكتروني',
        placeholder: 'name@example.com',
        buttonLabel: 'اشترك الآن',
        privacy: 'لن نشارك بريدك مع أي جهة، ويمكنك إلغاء الاشتراك في أي وقت.',
        action: '/subscribe',
        variant: 'card',
        formLayout: 'row',
        align: 'start',
        tone: 'light',
        spacing: 'lg',
        width: 'standard',
      },
    },
  },
];
