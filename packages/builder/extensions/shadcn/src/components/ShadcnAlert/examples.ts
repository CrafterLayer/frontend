import type { JsonValue } from '@craftkit/builder-schema';

/** Few-shots for AI context assembly — written FOR the model. */
export const shadcnAlertExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'a notice about scheduled maintenance',
    node: { type: 'shadcnAlert', props: { title: 'Scheduled maintenance', variant: 'info' } },
  },
  {
    prompt: 'تنبيه مهم بأن الباقة المجانية ستنتهي',
    node: {
      type: 'shadcnAlert',
      props: { title: 'باقتك المجانية تنتهي قريباً', variant: 'critical' },
    },
  },
];
