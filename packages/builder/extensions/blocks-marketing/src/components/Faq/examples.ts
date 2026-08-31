import type { JsonValue } from '@craftkit/builder-schema';

export const faqExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'professional FAQ cards for a B2B software product',
    node: {
      type: 'faq',
      props: {
        eyebrow: 'Answers, upfront',
        heading: 'Everything you need to make a confident decision',
        body: 'Straight answers about setup, security, and how your team can get value quickly.',
        layout: 'columns',
        variant: 'cards',
        openFirst: true,
        showNumbers: false,
        align: 'start',
        tone: 'light',
        spacing: 'lg',
        width: 'wide',
        items: [
          {
            question: 'How long does setup take?',
            answer: 'Most teams connect their core tools and publish a first workflow in less than one working day.',
          },
          {
            question: 'Can we start with one team?',
            answer: 'Yes. Start with a focused workspace, prove the operating model, and expand without rebuilding it.',
          },
          {
            question: 'How is sensitive data protected?',
            answer: 'Role-based access, auditable activity, and configurable retention keep governance close to the work.',
          },
          {
            question: 'What support is included?',
            answer: 'Every plan includes guided onboarding, a shared help center, and support from product specialists.',
          },
        ],
      },
    },
  },
  {
    prompt: 'أسئلة شائعة عربية مرقمة لخدمة طبية',
    node: {
      type: 'faq',
      props: {
        eyebrow: 'معلومات تهمك',
        heading: 'أسئلة شائعة قبل موعدك الأول',
        body: 'إجابات واضحة لتصل إلى الموعد وأنت مرتاح ومستعد.',
        layout: 'single',
        variant: 'divided',
        openFirst: true,
        showNumbers: true,
        align: 'start',
        tone: 'transparent',
        spacing: 'lg',
        width: 'narrow',
        items: [
          {
            question: 'كيف أحجز موعداً؟',
            answer: 'اختر التخصص والوقت المناسب، ثم أكّد بيانات التواصل. ستصلك رسالة تأكيد مباشرة.',
          },
          {
            question: 'ماذا أحضر معي؟',
            answer: 'أحضر الهوية وأي تقارير أو أدوية حالية تساعد الطبيب على فهم حالتك كاملة.',
          },
          {
            question: 'هل يمكن تغيير الموعد؟',
            answer: 'يمكنك تغيير الموعد أو إلغاؤه من صفحة الحجز حتى 24 ساعة قبل الموعد.',
          },
        ],
      },
    },
  },
];
