import type { JsonValue } from '@craftkit/builder-schema';

/**
 * Few-shots for AI context assembly — written FOR the model.
 *
 * Neither carries panel data, and that absence is the lesson: the panels are
 * `tabPanel` NODES in this block's slot, each owning its own label. An example
 * showing `tabs: [{ label, content }]` would teach the shape that makes a
 * pricing table inside a tab impossible.
 */
export const tabsExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'monthly and yearly pricing behind tabs',
    node: { type: 'tabs', props: { align: 'center' } },
  },
  {
    prompt: 'تبويبات للميزات حسب الفريق',
    node: { type: 'tabs', props: { align: 'start' } },
  },
];
