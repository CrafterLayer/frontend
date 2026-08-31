import type { JsonValue } from '@craftkit/builder-schema';

/** Few-shots for AI context assembly — written FOR the model. */
export const tabPanelExamples: { prompt: string; node: JsonValue }[] = [
  { prompt: 'a "Monthly" tab', node: { type: 'tabPanel', props: { label: 'Monthly' } } },
  { prompt: 'تبويب "سنوي"', node: { type: 'tabPanel', props: { label: 'سنوي' } } },
];
