import type { JsonValue } from '@craftkit/builder-schema';

export const processStepsExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'four-step process section for a premium digital studio',
    node: {
      type: 'processSteps',
      props: {
        eyebrow: 'Our approach',
        heading: 'Strategy and craft, connected from day one',
        body: 'Every engagement moves through the same accountable stages while leaving room for the work to evolve.',
        variant: 'cards',
        layout: 'horizontal',
        columns: '4',
        showNumbers: true,
        align: 'start',
        tone: 'transparent',
        spacing: 'lg',
        width: 'wide',
        steps: [
          {
            title: 'Listen deeply',
            body: 'Map the audience, context, and commercial target.',
            meta: 'Week 01',
          },
          {
            title: 'Make it tangible',
            body: 'Prototype the story and the decisive interactions.',
            meta: 'Week 02',
          },
          {
            title: 'Build the system',
            body: 'Create the production experience and reusable rules.',
            meta: 'Week 03',
          },
          {
            title: 'Launch with proof',
            body: 'Validate quality, publish, and measure the outcome.',
            meta: 'Week 04',
          },
        ],
      },
    },
  },
  {
    prompt: 'خطوات عمل عربية عمودية لخدمة استشارية',
    node: {
      type: 'processSteps',
      props: {
        eyebrow: 'طريقة العمل',
        heading: 'من التحدي إلى نتيجة واضحة',
        body: 'مسار عملي يحافظ على وضوح القرار في كل مرحلة.',
        variant: 'minimal',
        layout: 'vertical',
        columns: '3',
        showNumbers: true,
        align: 'start',
        tone: 'light',
        spacing: 'lg',
        width: 'standard',
        steps: [
          { title: 'نفهم الصورة', body: 'نجمع الاحتياجات ونحدد النتيجة المطلوبة.', meta: 'اكتشاف' },
          { title: 'نصمم المسار', body: 'نحوّل الأفكار إلى تجربة قابلة للاختبار.', meta: 'تصميم' },
          { title: 'نطلق بثقة', body: 'نبني ونراجع وننشر مع معايير جودة واضحة.', meta: 'تنفيذ' },
        ],
      },
    },
  },
];
