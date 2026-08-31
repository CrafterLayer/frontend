import type { JsonValue } from '@craftkit/builder-schema';

export const progressExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'a polished project completion indicator at sixty-four percent',
    node: {
      type: 'progress',
      props: {
        label: 'Project progress',
        value: 64,
        max: 100,
        showValue: true,
        size: 'medium',
        variant: 'accent',
        radius: 'pill',
      },
    },
  },
  {
    prompt: 'a compact success progress bar for completed onboarding steps',
    node: {
      type: 'progress',
      props: {
        label: 'Onboarding complete',
        value: 5,
        max: 5,
        showValue: true,
        size: 'small',
        variant: 'success',
        radius: 'pill',
      },
    },
  },
  {
    prompt: 'مؤشر تقدم كبير يوضح إنجاز ٧ من ١٠ خطوات',
    node: {
      type: 'progress',
      props: {
        label: 'اكتمل إعداد المتجر',
        value: 7,
        max: 10,
        showValue: true,
        size: 'large',
        variant: 'accent',
        radius: 'large',
      },
    },
  },
];
